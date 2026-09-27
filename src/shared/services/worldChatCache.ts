import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import networkManager from './NetworkManager';

/**
 * World Chat ka module-level cache - jaisa dmMessagesCache.ts DM history
 * ke liye karta hai, waisa hi yeh World Chat ke liye.
 *
 * Listener yahan MODULE LEVEL par ek hi baar (file import hote hi) lagta
 * hai - Room/DM/Shop/Community kisi bhi screen par ho, World Chat window
 * khuli ho ya band - yeh hamesha background mein sun raha hota hai aur
 * messages yahin (in-memory) collect karta rehta hai. Window jab bhi
 * dobara khuli, seedha yehi cached messages turant dikh jaate hain.
 * (Isliye is file ko app start ke aas-paas kahin import zaroor rakhna -
 * jab tak import nahi hoti, listener bhi nahi lagta.)
 *
 * Sirf last MAX_MESSAGES (100) hi rakhte hain - purane FIFO trim se hat jaate hain.
 *
 * PERSISTENCE: app background me jaaye (AppState != 'active') to current
 * last-100 messages AsyncStorage me save hote hain; agli baar app khulte hi
 * wapas load ho jaate hain.
 *
 * WEB -> RN DIFFERENCE: localStorage sync tha, AsyncStorage async - saved
 * messages thodi der baad (hydrate) aate hain. Is beech agar naye messages
 * aa gaye to woh saved messages ke NEECHE hi jud jaate hain (order sahi rehta
 * hai), aur hydrate khatam hone se pehle persist() kabhi storage ko partial
 * data se overwrite nahi karta.
 * Capacitor `appStateChange` + `visibilitychange` + `pagehide` ki jagah ab
 * sirf RN `AppState` kaafi hai.
 */
const MAX_MESSAGES = 100;
const STORAGE_KEY = 'zcache_world_chat_messages';

export interface WorldChatMessage {
  key: string;
  sender_id: string | number;
  username: string;
  content: string;
  at: Date;
}

let messages: WorldChatMessage[] = [];
const listeners = new Set<(msgs: WorldChatMessage[]) => void>();

const notify = () => {
  listeners.forEach((fn) => {
    try {
      fn(messages);
    } catch (e) {
      console.error('worldChatCache listener error:', e);
    }
  });
};

const hydratePromise: Promise<void> = (async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    // `at` JSON.stringify me ISO string ban jaata hai - wapas asli Date
    // object banana zaroori hai (formatBubbleTime() date methods use karta hai).
    const saved: WorldChatMessage[] = parsed.map((m: any) => ({ ...m, at: new Date(m.at) }));
    messages = [...saved, ...messages].slice(-MAX_MESSAGES);
    notify();
  } catch {
    // corrupt/blocked storage - khaali se shuru, koi problem nahi
  }
})();

function persist() {
  hydratePromise
    .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(messages)))
    .catch(() => {
      // storage full/blocked ho to bhi app chalti rahe - persist skip
    });
}

AppState.addEventListener('change', (state) => {
  if (state !== 'active') persist();
});

networkManager.addListener((data) => {
  if (data?.type !== 'world_message') return;
  const msg: WorldChatMessage = {
    key: `${data.sender_id}-${Date.now()}-${Math.random()}`,
    sender_id: data.sender_id,
    username: data.username,
    content: data.content,
    at: new Date(),
  };
  // Sirf last 100 - purane khud hi cache se nikal jaate hain.
  messages = [...messages, msg].slice(-MAX_MESSAGES);
  notify();
});

export function getWorldChatMessages(): WorldChatMessage[] {
  return messages;
}

// Returns an unsubscribe function - jaisa networkManager.addListener().
export function subscribeWorldChat(fn: (msgs: WorldChatMessage[]) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}