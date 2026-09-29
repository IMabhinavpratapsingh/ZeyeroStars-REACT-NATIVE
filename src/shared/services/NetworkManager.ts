import AsyncStorage from '@react-native-async-storage/async-storage';
import { WS_BASE } from '../config/config';

// Backoff for reconnect() when the socket dies immediately after opening
// (bad network, server hiccup, stale token, etc.) - without this, every
// onclose fired handleReconnect() again with zero delay, which fired
// another onclose almost instantly, which fired handleReconnect again...
// a tight connect/close loop (visible in server logs as the same
// connect->"user not in queue"->close lines repeating rapidly). Capped
// exponential backoff (1s, 2s, 4s... up to 15s) fixes it; a real open
// connection resets the backoff back to 0.
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 15000;

// IMPORTANT (web -> RN difference): web mein localStorage.getItem("z_token")
// SYNC tha - connect() ke andar seedha turant token mil jaata tha.
// AsyncStorage hamesha ASYNC hai. Fix: token ko yahin ek in-memory cache
// (tokenCache) mein rakhte hain. Login.tsx mein login success ke baad
// networkManager.setToken(token) call karo (AsyncStorage.setItem() bhi
// khud kar dega) - uske baad connect() turant (sync) cached value use
// kar sakta hai.
let tokenCache: string | null = null;

export const loadNetworkToken = async (): Promise<void> => {
  tokenCache = await AsyncStorage.getItem('z_token');
};

// API files (roomsApi, communitiesApi, ...) yahi se sync token padhti hain -
// web ke `localStorage.getItem("z_token")` ka replacement.
export const getToken = (): string | null => tokenCache;

// Logout / 401 par - in-memory token TURANT (sync) null hota hai, storage
// se hatna async hai.
export const clearToken = async (): Promise<void> => {
  tokenCache = null;
  await AsyncStorage.removeItem('z_token');
};

class NetworkManager {
  private ws: WebSocket | null = null;
  private _onMessage: ((data: any) => void) | null = null;
  private _onDisconnect: (() => void) | null = null;
  private _reconnectAttempts = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connecting = false;
  private _listeners = new Set<(data: any) => void>();
  private _sendQueue: any[] = [];
  private _checkingAlive = false;

  async setToken(token: string): Promise<void> {
    tokenCache = token;
    await AsyncStorage.setItem('z_token', token);
  }

  addListener(fn: (data: any) => void): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  connect(onMessage?: (data: any) => void, onDisconnect?: () => void): void {
    if (onMessage) this._onMessage = onMessage;
    if (onDisconnect) this._onDisconnect = onDisconnect;

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch {
        // ignore
      }
    }

    if (!tokenCache) {
      console.error('NetworkManager.connect: tokenCache empty. Call loadNetworkToken() first (root _layout.tsx on app start) or setToken() after login.');
    }

    this._connecting = true;
    this.ws = new WebSocket(`${WS_BASE}/ws/dm/connect?token=${tokenCache}`);

    this.ws.onopen = () => {
      console.log('Connected to Game Server');
      this._connecting = false;
      this._reconnectAttempts = 0;
      this._flushQueue();
    };

    this.ws.onmessage = (event: any) => {
      const data = JSON.parse(event.data);
      if (this._onMessage) this._onMessage(data);
      this._listeners.forEach((fn) => {
        try {
          fn(data);
        } catch (err) {
          console.error('NetworkManager listener error:', err);
        }
      });
    };

    this.ws.onclose = () => {
      console.log('Disconnected from Server');
      this._connecting = false;
      this.ws = null;
      if (this._onDisconnect) this._onDisconnect();
    };

    this.ws.onerror = () => {
      console.log('WebSocket error');
    };
  }

  // Logout par socket poori tarah band karo (web mein page reload ye kar deta
  // tha, RN mein nahi) - warna purane token ke saath reconnect loop chalta rahega.
  // addListener() wale listeners (worldChatCache jaise) jaan-boojh ke rehne dete hain.
  disconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnectAttempts = 0;
    this._connecting = false;
    this._sendQueue = [];
    this._onMessage = null;
    this._onDisconnect = null;
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  reconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
    }

    const attempt = this._reconnectAttempts;
    const delay = Math.min(RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt), RECONNECT_MAX_DELAY_MS);
    this._reconnectAttempts += 1;

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect();
    }, delay);
  }

  forceReconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnectAttempts = 0;
    this.connect();
  }

  isConnected(): boolean {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  isConnecting(): boolean {
    return this._connecting;
  }

  // Socket abhi open nahi hai to connect karwa ke (max timeoutMs) intezaar karo.
  // Game start jaise actions "No connection" dikha ke wapas jaane ki jagah isse
  // socket ready hone ka wait kar sakte hain.
  waitForConnection(timeoutMs = 4000): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected()) {
        resolve(true);
        return;
      }
      if (!this._connecting) this.forceReconnect();
      const startedAt = Date.now();
      const iv = setInterval(() => {
        if (this.isConnected()) {
          clearInterval(iv);
          resolve(true);
        } else if (Date.now() - startedAt >= timeoutMs) {
          clearInterval(iv);
          resolve(false);
        }
      }, 100);
    });
  }

  ensureAlive(timeoutMs = 2500): Promise<boolean> {
    if (this._checkingAlive) return Promise.resolve(true);

    return new Promise((resolve) => {
      if (!this.isConnected()) {
        this.forceReconnect();
        resolve(false);
        return;
      }

      this._checkingAlive = true;
      let settled = false;
      const finish = (result: boolean) => {
        if (settled) return;
        settled = true;
        this._checkingAlive = false;
        resolve(result);
      };

      const unsubscribe = this.addListener((data) => {
        if (data?.type === 'pong' && !settled) {
          clearTimeout(timer);
          unsubscribe();
          finish(true);
        }
      });

      const timer = setTimeout(() => {
        if (settled) return;
        unsubscribe();
        if (this.ws) {
          try {
            this.ws.onclose = null;
            this.ws.onerror = null;
            this.ws.close();
          } catch {
            // ignore
          }
          this.ws = null;
        }
        this._reconnectAttempts = 0;
        if (this._onDisconnect) {
          this._onDisconnect();
        } else {
          this.reconnect();
        }
        finish(false);
      }, timeoutMs);

      this.send({ type: 'ping' });
    });
  }

  send(data: any): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  sendOrQueue(data: any): boolean {
    if (this.send(data)) return true;

    this._sendQueue.push(data);

    if (!this._connecting && !this._reconnectTimer) {
      if (this.ws) {
        // ws maujood hai lekin OPEN nahi - dobara connect() na karein.
      } else {
        this.reconnect();
      }
    }

    return false;
  }

  private _flushQueue(): void {
    if (!this._sendQueue.length) return;
    const pending = this._sendQueue;
    this._sendQueue = [];
    pending.forEach((msg) => {
      if (!this.send(msg)) {
        this._sendQueue.push(msg);
      }
    });
  }
}

const networkManager = new NetworkManager();
export default networkManager;