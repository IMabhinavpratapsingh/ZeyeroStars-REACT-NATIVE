import AsyncStorage from '@react-native-async-storage/async-storage';

// confirmBus.ts/alertBus.ts jaisa hi pattern - koi bhi file `await
// showRulesWarning("room")` bula sakti hai, koi prop-drilling ya
// per-component modal state nahi chahiye. RulesWarningHost (root
// _layout.tsx mein ek hi baar mounted) hi sirf subscriber hai jo actually
// render karta hai; user "Continue" dabate hi promise resolve ho jaata hai.
//
// "Don't show this again" ek AsyncStorage flag hai - jab tak user khud
// wo checkbox tick na kare, yeh warning HAR baar dikhega jab bhi koi
// join action (room/world chat/community) ho.
//
// IMPORTANT (web -> RN difference): localStorage.getItem SYNC tha,
// isliye hasOptedOutOfRulesWarning() turant true/false de deta tha.
// AsyncStorage async hai - isliye ab ek in-memory cache (optOutCache)
// rakha hai jo app start pe loadRulesWarningOptOut() se bhara jaata hai.
// Uske baad hasOptedOutOfRulesWarning() turant (sync) cached value deta
// hai - bilkul pehle jaisa.

let optOutCache = false;

const STORAGE_KEY = 'z_rules_dont_show_again';

// App start pe (root _layout.tsx) ek baar call karo taaki cache bhar jaye.
export async function loadRulesWarningOptOut(): Promise<void> {
  try {
    optOutCache = (await AsyncStorage.getItem(STORAGE_KEY)) === '1';
  } catch {
    optOutCache = false;
  }
}

export type RulesWarningRequest = {
  context: string;
  resolve: (value: boolean) => void;
};

let listener: ((req: RulesWarningRequest) => void) | null = null;

export function subscribeRulesWarning(fn: (req: RulesWarningRequest) => void): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

// Sync read - loadRulesWarningOptOut() app start pe already call ho chuka
// hona chahiye (warna default false milega, matlab warning dikhegi, jo
// safe default hai).
export function hasOptedOutOfRulesWarning(): boolean {
  return optOutCache;
}

export async function setDontShowRulesWarningAgain(value: boolean): Promise<void> {
  try {
    optOutCache = value;
    if (value) await AsyncStorage.setItem(STORAGE_KEY, '1');
    else await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// context: chhota label jo modal ke subtitle mein dikhta hai, e.g.
// "room", "world chat", "community". Resolve HAMESHA
// `true` hi hota hai (yeh ek permission-gate nahi, sirf ek reminder
// hai) - agar user pehle hi "don't show again" tick kar chuka hai to
// modal dikhaye bina hi turant resolve ho jaata hai.
export function showRulesWarning(context = 'this'): Promise<boolean> {
  if (hasOptedOutOfRulesWarning()) return Promise.resolve(true);
  return new Promise((resolve) => {
    if (!listener) {
      resolve(true);
      return;
    }
    listener({ context, resolve });
  });
}

export default showRulesWarning;