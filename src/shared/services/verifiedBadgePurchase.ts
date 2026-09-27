import { Platform } from 'react-native';
import {
  initConnection,
  endConnection,
  requestSubscription,
  requestPurchase,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getSubscriptions,
  getProducts,
  type Purchase,
  type PurchaseError,
  type Subscription,
  type Product,
} from 'react-native-iap';
import { verifyVerifiedSubscription } from './verifiedBadgeApi';
import { verifyZMoneyPurchase } from './zMoneyApi';

// WEB/CAPACITOR -> RN DIFFERENCE:
// Capacitor version 'cordova-plugin-purchase' (window.CdvPurchase) use
// karta tha - wo Capacitor-only hai, Expo/React Native mein bilkul
// support nahi hota. Isliye poora purchase flow 'react-native-iap' library
// se rewrite kiya gaya hai. Business logic (product ids, verify+finish
// sequence, success/error callbacks) wahi rakha hai jo capacitor wale
// verifiedBadgePurchase.js mein tha.

// Play Console me banaya hua subscription Product ID (screenshot me "1")
export const VERIFIED_PRODUCT_ID = '1';
const PRODUCT_ID = VERIFIED_PRODUCT_ID;
// Sirf tab dikhta hai jab Play Store se live localized price fetch na ho
// paaye - warna asli price hamesha user ke currency/region ke hisaab se
// live aata hai (INR sabke liye hardcode nahi karna, kisi aur country me
// ye galat hoga).
const VERIFIED_FALLBACK_PRICE = '₹99/month';

// Play Console me banaye hue one-time (consumable) products - "Buy" offers.
// amount = kitna z_money milega. fallbackPrice sirf tab dikhta hai jab live
// localized price Play Store se fetch na ho paaye.
export const Z_MONEY_PRODUCTS = [
  { id: '2', amount: 10, fallbackPrice: '₹10' },
  { id: '3', amount: 100, fallbackPrice: '₹90' },
  { id: '4', amount: 1000, fallbackPrice: '₹800' },
  { id: '5', amount: 1, fallbackPrice: '₹4' }, // India only, purchase option id = 5
];
const Z_MONEY_PRODUCT_IDS = Z_MONEY_PRODUCTS.map((p) => p.id);

let initialized = false;
let initPromise: Promise<void> | null = null;
let subscriptions: Subscription[] = [];
let products: Product[] = [];
let purchaseUpdateSub: { remove: () => void } | null = null;
let purchaseErrorSub: { remove: () => void } | null = null;

// Callback jo caller (jaise VerifiedBadge purchase button) set kar sakta hai
// taaki purchase success/fail hone par UI update kar sake.
let onSuccessCallback: ((data: unknown) => void) | null = null;
let onErrorCallback: ((msg: string) => void) | null = null;

// Z Money (one-time) purchase ke liye alag callbacks - jahan bhi
// "+10 z_money credited" wala UI update karna ho wahan ye set karo.
let onZMoneySuccessCallback: ((data: unknown) => void) | null = null;
let onZMoneyErrorCallback: ((msg: string) => void) | null = null;

export function setVerifiedBadgePurchaseHandlers({
  onSuccess,
  onError,
}: { onSuccess?: (data: unknown) => void; onError?: (msg: string) => void } = {}) {
  onSuccessCallback = onSuccess || null;
  onErrorCallback = onError || null;
}

export function setZMoneyPurchaseHandlers({
  onSuccess,
  onError,
}: { onSuccess?: (data: unknown) => void; onError?: (msg: string) => void } = {}) {
  onZMoneySuccessCallback = onSuccess || null;
  onZMoneyErrorCallback = onError || null;
}

/**
 * App start hone par (root _layout.tsx se) ek baar call karo. In-app
 * purchases sirf real Android device/emulator pe kaam karti hain (Expo dev
 * client / production build me), Expo Go me nahi.
 */
export function initVerifiedBadgeStore(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await initConnection();

      purchaseUpdateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
        // NOTE: capacitor wale flow me transaction.verify() ka dummy
        // (khali) receipt aata tha jisse productId galat nikalta tha -
        // isliye productId + purchaseToken seedha purchase object se lo.
        const token = purchase.purchaseTokenAndroid;
        const productId = purchase.productId;

        if (!token) {
          console.error('[verifiedBadgePurchase] purchase token nahi mila:', purchase);
          onErrorCallback?.('Purchase token missing');
          return;
        }

        // Kaunsa product hai us hisaab se sahi backend endpoint call karo -
        // subscription (real recurring paisa) aur one-time z_money ka
        // verification flow backend me alag-alag hai.
        if (Z_MONEY_PRODUCT_IDS.includes(productId)) {
          verifyZMoneyPurchase(productId, token)
            .then(async (res) => {
              // CONSUMABLE - finish/consume turant karo taaki user dobara
              // khareed sake. Consume fail hua to item Play Store ke paas
              // "owned" hi reh jaata hai aur agli purchase "already
              // purchased" bolke reject ho jaati hai.
              try {
                await finishTransaction({ purchase, isConsumable: true });
                onZMoneySuccessCallback?.(res.data);
              } catch (finishErr) {
                console.error('[zMoneyPurchase] finishTransaction FAILED - item Play ke paas owned reh gaya:', finishErr);
                onZMoneyErrorCallback?.('Item credited but not consumed - restart the app to retry consuming it.');
              }
            })
            .catch((err) => {
              console.error('[zMoneyPurchase] server verify failed:', err);
              onZMoneyErrorCallback?.(err?.response?.data?.detail || 'Verification failed');
            });
          return;
        }

        verifyVerifiedSubscription(token)
          .then(async (res) => {
            try {
              await finishTransaction({ purchase, isConsumable: false });
              onSuccessCallback?.(res.data);
            } catch (finishErr) {
              console.error('[verifiedBadgePurchase] finishTransaction FAILED:', finishErr);
              onErrorCallback?.('Subscribed but finish failed - restart the app.');
            }
          })
          .catch((err) => {
            console.error('[verifiedBadgePurchase] server verify failed:', err);
            onErrorCallback?.(err?.response?.data?.detail || 'Verification failed');
          });
      });

      purchaseErrorSub = purchaseErrorListener((error: PurchaseError) => {
        console.error('[verifiedBadgePurchase] store error:', error);
        onErrorCallback?.(error?.message || 'Purchase failed');
      });

      try {
        subscriptions = await getSubscriptions({ skus: [PRODUCT_ID] });
      } catch (e) {
        console.error('[verifiedBadgePurchase] getSubscriptions failed:', e);
      }
      try {
        products = await getProducts({ skus: Z_MONEY_PRODUCT_IDS });
      } catch (e) {
        console.error('[verifiedBadgePurchase] getProducts failed:', e);
      }

      initialized = true;
    } catch (e) {
      console.error('[verifiedBadgePurchase] initConnection failed:', e);
    }
  })();

  return initPromise;
}

export function teardownVerifiedBadgeStore() {
  purchaseUpdateSub?.remove();
  purchaseErrorSub?.remove();
  purchaseUpdateSub = null;
  purchaseErrorSub = null;
  initialized = false;
  initPromise = null;
  endConnection();
}

/**
 * Play Store se is product ka LIVE localized price string nikalta hai
 * (jaise India me "₹99", US me "$1.49" - kabhi hardcode mat karo). Store
 * ready hone se pehle null milega - caller ko fallbackPrice dikhana
 * chahiye tab tak.
 */
export function getProductPrice(productId: string): string | null {
  if (!initialized) return null;
  const sub = subscriptions.find((s) => s.productId === productId);
  if (sub) return sub.localizedPrice ?? null;
  const prod = products.find((p) => p.productId === productId);
  return prod?.localizedPrice ?? null;
}

async function orderProduct(productId: string, isSubscription: boolean, onErr: ((msg: string) => void) | null) {
  if (Platform.OS !== 'android') {
    console.warn('[verifiedBadgePurchase] Purchases sirf native Android app me kaam karti hain');
    onErr?.('Yeh feature sirf app me kaam karega.');
    return;
  }
  if (!initialized) {
    console.error('[verifiedBadgePurchase] store abhi ready nahi hai');
    onErr?.('Store still loading, thodi der me try karo.');
    return;
  }

  try {
    if (isSubscription) {
      await requestSubscription({ sku: productId });
    } else {
      await requestPurchase({ skus: [productId] });
    }
  } catch (e: any) {
    console.error('[verifiedBadgePurchase] order failed:', e);
    onErr?.(e?.message || 'Purchase failed to start.');
  }
}

/**
 * Buy button ke onClick pe ye call karo (Verified badge subscription).
 */
export function buyVerifiedBadge() {
  orderProduct(PRODUCT_ID, true, onErrorCallback);
}

/**
 * Buy button ke onClick pe ye call karo (one-time z_money product).
 * productId Z_MONEY_PRODUCTS me se koi bhi id ho sakta hai ('2'/'3'/'4'/'5').
 */
export function buyZMoney(productId: string) {
  orderProduct(productId, false, onZMoneyErrorCallback);
}