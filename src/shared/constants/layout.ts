/*
 * App-shell ke fixed chrome ki heights - EK source of truth.
 *
 * Web mein yeh value `76` teen alag files mein hardcoded thi
 * (RoomChatWindow, RoomInputOverlay, PostDetailModal) aur BottomNav ki
 * height badalne par sirf kuch jagah update hui - baaki jagah 4px ka gap
 * reh gaya. Isliye ek hi constant, sab yahin se padhein.
 *
 * Aage se BottomNav ki height badle to SIRF yahan badlo.
 *
 * WEB -> RN CHANGES:
 * - `BOTTOM_NAV_TW` (Tailwind `h-20` / `bottom-20` ka scale number) hata
 *   diya - RN project mein Tailwind classes nahi, StyleSheet chalta hai,
 *   sirf px value kaam ki hai.
 * - Yeh sirf nav bar ki apni height hai. Phone ke bottom safe-area (home
 *   indicator / gesture bar) ALAG se aata hai - use
 *   `useSafeAreaInsets().bottom` se jodo. Helper neeche diya hai.
 */
export const BOTTOM_NAV_PX = 80;

/** Nav bar ki total height = fixed nav height + device ka bottom safe-area inset. */
// FIX: BottomNav ki asli rendered height sirf BOTTOM_NAV_PX hai (usme insets.bottom
// add nahi hota), aur Community/Rooms/DM overlays bhi `bottom: BOTTOM_NAV_PX` use
// karte hain. Pehle yahan `+ bottomInset` tha -> Profile/Shop/LimitedStore nav ke
// upar `insets.bottom` jitna gap chhod dete the jisme neeche ki feed dikhti thi.
// `bottomInset` param signature compatible rakhne ke liye bacha hai (ab ignore).
export const getBottomNavTotal = (_bottomInset: number = 0): number => BOTTOM_NAV_PX;