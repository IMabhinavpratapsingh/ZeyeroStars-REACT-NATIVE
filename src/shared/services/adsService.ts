// AdMob via react-native-google-mobile-ads (Capacitor @capacitor-community/admob
// ki jagah).
//
// Install:
//   npx expo install react-native-google-mobile-ads
// app.json:
//   "plugins": [["react-native-google-mobile-ads", {
//      "androidAppId": "ca-app-pub-3940256099942544~3347511713",   // TEST app id - real se replace karna
//      "iosAppId": "ca-app-pub-3940256099942544~1458002511"
//   }]]
// Development build chahiye (Expo Go mein nahi chalta).
//
// Test IDs: TestIds.* Google ke official test ad units hain (purane string
// IDs jaise hi). Real AdMob account bante hi IS_TESTING = false karke apne
// asli ad unit IDs daalna.

import mobileAds, {
  AdEventType,
  InterstitialAd,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

// __DEV__ = dev/debug build mein test ads (apne hi real ads pe click karna AdMob ban karwa sakta hai),
// release build mein apne asli ad units. Zaroorat ho to yahan manually true/false kar sakte ho.
const IS_TESTING = __DEV__;

const AD_UNITS = {
  interstitial: IS_TESTING ? TestIds.INTERSTITIAL : 'ca-app-pub-4364886892235302/9414380573',
  rewarded: IS_TESTING ? TestIds.REWARDED : 'ca-app-pub-4364886892235302/2597605063',
  // Feed ka native ad (NativeAdCard.tsx) - AdMob mein "Native advanced" ad unit banana.
  native: IS_TESTING ? TestIds.NATIVE : 'ca-app-pub-4364886892235302/3806744950',
};

export function getNativeAdUnitId(): string {
  return AD_UNITS.native;
}

// Preload ka event kabhi na aaye (network hang) to promise hamesha ke liye
// atak na jaaye - 30s baad chhod do, agli preload dobara try kar sakti hai.
const PRELOAD_TIMEOUT_MS = 30_000;

let initPromise: Promise<unknown> | null = null;

/**
 * SDK ek hi baar initialize hona chahiye. initPromise se guard kiya hai taaki
 * initAds() aur showRoomInterstitial/preloadRewardedAd jaise parallel callers
 * do baar initialize na kar baithein (race condition).
 */
function ensureInitialized() {
  if (!initPromise) {
    initPromise = mobileAds()
      .initialize()
      .catch((err: any) => {
        initPromise = null; // fail hua to agli baar dobara try ho sake
        throw err;
      });
  }
  return initPromise;
}

/**
 * NativeAdCard jaise components load se pehle isse await karte hain - SDK
 * ek hi baar initialize hota hai (initPromise guard), initAds() ke saath
 * race nahi hota.
 */
export function ensureAdsInitialized() {
  return ensureInitialized();
}

export async function initAds(): Promise<void> {
  await ensureInitialized();
  await preloadInterstitial();
  await preloadRewardedAd();
}

// ============================================================================
// Interstitial
// ============================================================================

let interstitial: InterstitialAd | null = null;
let interstitialLoaded = false;
let interstitialPreload: Promise<void> | null = null;

function preloadInterstitial(): Promise<void> {
  if (interstitialLoaded) return Promise.resolve();
  if (interstitialPreload) return interstitialPreload;

  interstitialPreload = (async () => {
    try {
      await ensureInitialized();

      await new Promise<void>((resolve) => {
        const ad = InterstitialAd.createForAdRequest(AD_UNITS.interstitial);
        interstitial = ad;

        const unsubs: (() => void)[] = [];
        const cleanup = () => unsubs.forEach((u) => u());
        const timer = setTimeout(() => {
          cleanup();
          resolve();
        }, PRELOAD_TIMEOUT_MS);

        unsubs.push(
          ad.addAdEventListener(AdEventType.LOADED, () => {
            clearTimeout(timer);
            interstitialLoaded = true;
            resolve();
          })
        );
        unsubs.push(
          ad.addAdEventListener(AdEventType.ERROR, (err: any) => {
            clearTimeout(timer);
            console.error('Interstitial preload failed:', err);
            cleanup();
            resolve();
            // Fail hua to 15s baad dobara try (temporary failure ke liye)
            setTimeout(() => preloadInterstitial(), 15_000);
          })
        );
        // Ad band hote hi agla turant load - kabhi bhi ready rahe.
        unsubs.push(
          ad.addAdEventListener(AdEventType.CLOSED, () => {
            cleanup();
            interstitialLoaded = false;
            interstitialPreload = null;
            preloadInterstitial();
          })
        );

        ad.load();
      });
    } catch (err) {
      console.error('Interstitial preload failed:', err);
    } finally {
      interstitialPreload = null;
    }
  })();

  return interstitialPreload;
}

/**
 * Room join ya room close/exit - DONO baar, HAR baar call karo.
 * Koi frequency cap nahi hai - jab bhi ye chalega, interstitial dikhega
 * (agar load ho chuka hai). Fire-and-forget hai (caller await nahi karta).
 */
export async function showRoomInterstitial(): Promise<void> {
  const ad = interstitial;
  if (!ad || !interstitialLoaded) {
    console.error('Interstitial show skipped (abhi load nahi hua tha)');
    preloadInterstitial();
    return;
  }

  interstitialLoaded = false;
  try {
    await ad.show();
    // Agla preload CLOSED listener (upar) khud kar dega.
  } catch (err) {
    console.error('Interstitial show failed:', err);
    preloadInterstitial();
  }
}

// ============================================================================
// Rewarded video - "Watch Ad, Get Reward"
//
// Reward ka asli credit (Z money, daily cap, cooldown) hamesha BACKEND se
// hota hai (/rewards/ad/claim) - yeh service sirf ad load/show karta hai
// aur "poori dekh li" wala event caller tak deliver karta hai. Kabhi bhi
// client-side khud reward mat do.
// ============================================================================

let rewarded: RewardedAd | null = null;
let rewardedAdLoaded = false;
let rewardedPreload: Promise<void> | null = null;
const readyListeners = new Set<() => void>();

function setRewardedLoaded(value: boolean) {
  if (rewardedAdLoaded === value) return;
  rewardedAdLoaded = value;
  readyListeners.forEach((fn) => fn());
}

export function preloadRewardedAd(): Promise<void> {
  if (rewardedAdLoaded) return Promise.resolve();
  if (rewardedPreload) return rewardedPreload;

  rewardedPreload = (async () => {
    try {
      await ensureInitialized();

      await new Promise<void>((resolve) => {
        const ad = RewardedAd.createForAdRequest(AD_UNITS.rewarded);
        rewarded = ad;

        const unsubs: (() => void)[] = [];
        const cleanup = () => unsubs.forEach((u) => u());
        const timer = setTimeout(() => {
          cleanup();
          resolve();
        }, PRELOAD_TIMEOUT_MS);

        unsubs.push(
          ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
            clearTimeout(timer);
            cleanup();
            setRewardedLoaded(true);
            resolve();
          })
        );
        unsubs.push(
          ad.addAdEventListener(AdEventType.ERROR, (err: any) => {
            clearTimeout(timer);
            console.error('Rewarded ad preload failed:', err);
            cleanup();
            setRewardedLoaded(false);
            resolve();
          })
        );

        ad.load();
      });
    } catch (err) {
      setRewardedLoaded(false);
      console.error('Rewarded ad preload failed:', err);
    } finally {
      rewardedPreload = null;
    }
  })();

  return rewardedPreload;
}

export function isRewardedAdReady(): boolean {
  return rewardedAdLoaded;
}

// RN extra: web mein isRewardedAdReady() sirf render ke waqt padhi jaati thi
// (flag badalne par UI re-render nahi hota tha). Ab useSyncExternalStore /
// useEffect se subscribe karke button ko ad load hote hi enable kar sakte ho:
//   const ready = useSyncExternalStore(subscribeRewardedAdReady, isRewardedAdReady);
export function subscribeRewardedAdReady(fn: () => void): () => void {
  readyListeners.add(fn);
  return () => {
    readyListeners.delete(fn);
  };
}

/**
 * Rewarded ad dikhata hai aur user ke reward kama ke ad band karne par
 * `onRewarded` chalata hai (jisme caller backend ko /rewards/ad/claim call
 * karega) - promise `onRewarded` khatam hone par resolve hota hai. Agar user
 * reward se pehle hi ad band kar de (skip/exit) ya ad load na ho, to yeh
 * reject/throw karta hai aur `onRewarded` kabhi nahi chalta.
 */
export async function showRewardedAd(onRewarded: () => void | Promise<void>): Promise<void> {
  try {
    const ad = rewarded;
    if (!ad || !rewardedAdLoaded) throw new Error('Rewarded ad not loaded yet');
    setRewardedLoaded(false);

    await new Promise<void>((resolve, reject) => {
      let earned = false;
      const unsubs: (() => void)[] = [];
      const finish = (fn: () => void) => {
        unsubs.forEach((u) => u());
        fn();
      };

      unsubs.push(
        ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          earned = true;
        })
      );
      unsubs.push(
        ad.addAdEventListener(AdEventType.CLOSED, () =>
          finish(() => (earned ? resolve() : reject(new Error('Ad closed before reward was earned'))))
        )
      );
      unsubs.push(ad.addAdEventListener(AdEventType.ERROR, (err: any) => finish(() => reject(err))));

      ad.show().catch((err: any) => finish(() => reject(err)));
    });

    await onRewarded();
  } catch (err) {
    console.error('Rewarded ad show failed (shayad abhi load nahi hua tha, ya user ne skip kar diya):', err);
    throw err;
  } finally {
    preloadRewardedAd(); // agli baar ke liye turant naya load
  }
}