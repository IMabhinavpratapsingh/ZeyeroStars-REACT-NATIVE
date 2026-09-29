import React, { type ReactNode, useEffect } from 'react';
import { AnimatePresence, MotiView } from 'moti';
import { StyleSheet, useWindowDimensions, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import useTopZIndex from '../../hooks/useTopZIndex';
import { BOTTOM_NAV_PX } from '../../constants/layout';

// Shared Motion primitives - taaki har modal mein transition config baar
// baar copy-paste na karna pade. Har ek AnimatePresence khud carry karta
// hai, isliye standalone kahin bhi (koi bhi `show` boolean ke saath)
// drop-in use ho sakta hai - parent mein kuch restructure nahi karna
// padta.
//
// WEB -> RN CHANGE:
// `motion/react` (web) -> `moti` (RN, reanimated ke upar bana hua) - API
// shape same rakha hai (`show`, `initial/animate/exit/transition`) taaki
// migration mein soch-samajh kam lagani pade. Farak: web mein transitions
// arbitrary CSS props (className, style) par lagte the; RN mein sirf
// specific numeric style props (opacity, translateX/Y, scale) animate
// karo - StyleSheet ka poora object animate nahi hota.
//
// `style` yahan sirf StyleProp<ViewStyle> leta hai - web wale spread mein
// className/onClick jaisी DOM props bhi ja sakti thi, RN View mein wo
// nahi chalti.
interface TransitionProps {
  show: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

// CardPop apne aap AnimatePresence/`show` handle nahi karta - ye hamesha
// kisi parent ke andar use hota hai jo khud already conditionally render
// karta hai (e.g. `{visible && <View><CardPop>...`) ya kisi FadeIn
// backdrop ke andar. Isliye iska props type TransitionProps se `show`
// omit karta hai - baaki (children, style) same rehta hai.
type CardPopProps = Omit<TransitionProps, 'show'>;

export const FadeIn = ({ show, children, style }: TransitionProps) => (
  <AnimatePresence>
    {show && (
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ type: 'timing', duration: 180, easing: Easing.out(Easing.ease) }}
        style={style}
      >
        {children}
      </MotiView>
    )}
  </AnimatePresence>
);

// Web ka `CardPop` forwardRef leta tha (kabhi kabhi parent DOM node chahiye
// hota tha, e.g. outside-click detection ke liye). RN mein outside-tap
// aam taur par ek full-screen Pressable backdrop se hota hai
// (DisconnectedOverlay jaisी jagah dekho), isliye ref ki zaroorat
// generally nahi padti - phir bhi View ref forward kar rahe hain taaki
// drop-in compatible rahe.
export const CardPop = React.forwardRef<React.ElementRef<typeof MotiView>, CardPopProps>(
  ({ children, style }, ref) => (
    <MotiView
      ref={ref}
      from={{ translateY: 24, opacity: 0, scale: 0.98 }}
      animate={{ translateY: 0, opacity: 1, scale: 1 }}
      exit={{ translateY: 16, opacity: 0, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 340, damping: 32 }}
      style={style}
    >
      {children}
    </MotiView>
  )
);
CardPop.displayName = 'CardPop';

export const SlideUp = ({ show, children, style }: TransitionProps) => (
  <AnimatePresence>
    {show && (
      <MotiView
        from={{ translateY: 600 }}
        animate={{ translateY: 0 }}
        exit={{ translateY: 600 }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        style={style}
      >
        {children}
      </MotiView>
    )}
  </AnimatePresence>
);

// NOTE: web `SlideInRight` mein `x: '100%'` (relative, % based) tha - RN
// mein percentage translate reliably nahi chalta, isliye ek fixed px
// value chahiye. Ideally isse prop bana ke drawer ki actual width pass
// karo; yahan safe default 400px (zyadatar drawer/bottom-sheet widths se
// bada) diya hai.
export const SlideInRight = ({ show, children, style, bouncy = true }: TransitionProps & { bouncy?: boolean }) => (
  <AnimatePresence>
    {show && (
      <MotiView
        from={{ translateX: 400 }}
        animate={{ translateX: 0 }}
        exit={{ translateX: 400 }}
        transition={
          bouncy
            ? { type: 'spring', stiffness: 320, damping: 34 }
            : { type: 'timing', duration: 240, easing: Easing.out(Easing.cubic) }
        }
        style={style}
      >
        {children}
      </MotiView>
    )}
  </AnimatePresence>
);

// ExpandFromTop -> search-bar jaisी cheezon ke liye, jahan tap karte hi
// koi NAYI screen kisi taraf (right/left) se slide ho ke NAHI aani
// chahiye - iski jagah jo cheez already wahin (upar) thi wahi khud
// "transform" ho ke bhar jaani chahiye. Scale + fade, origin top se -
// RN 0.73+ `transformOrigin` ko style ke through support karta hai;
// purane RN par isse hata ke sirf scale+fade kaam karega (bas origin
// center se hoga, top se nahi).
export const ExpandFromTop = ({ show, children, style }: TransitionProps) => (
  <AnimatePresence>
    {show && (
      <MotiView
        from={{ opacity: 0, scale: 0.94, translateY: -10 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        exit={{ opacity: 0, scale: 0.94, translateY: -10 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        style={[{ transformOrigin: 'top center' } as ViewStyle, style]}
      >
        {children}
      </MotiView>
    )}
  </AnimatePresence>
);

export const PopIn = ({ show, children, style }: TransitionProps) => (
  <AnimatePresence>
    {show && (
      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        style={style}
      >
        {children}
      </MotiView>
    )}
  </AnimatePresence>
);

// ---------------------------------------------------------------------------
// PersistentSlide - DM/Rooms tabs jaisi PERSISTENT full-screen overlay ke
// liye (CommunityListScreen/SlideInRight se ALAG banaya, jaan-boojh kar):
//
// SlideInRight (upar) `{show && <MotiView/>}` pattern use karta hai - iska
// matlab `show=false` hote hi (exit animation ke baad) MotiView poori tarah
// UNMOUNT ho jaata hai. Community list ke liye theek hai (khud ek module-level
// cache resource se instant re-render kar leta hai), lekin DM/Rooms ke andar
// live state hai (open chat, WebSocket-driven room floor, inbox scroll
// position) jo remount par kho jaata - EXACTLY wahi "tab switch par sab kuch
// dobara load hota hai" wala bug jo _layout.tsx ke Tabs->Slot fix ne pehle
// solve kiya tha. Isliye PersistentSlide children ko KABHI unmount nahi
// karta - hamesha mounted rehte hain (state safe), sirf translateX se
// slide + `pointerEvents` se hidden state mein touches ko block karta hai.
//
// Isi wajah se yeh Community ke `SlideInRight` (Moti/AnimatePresence) se
// nahi, balki seedha Reanimated (`useSharedValue`/`withTiming`) se likha
// hai - bilkul wahi technique jo `(tabs)/_layout.tsx` ke tab-switch slide
// mein already use ho rahi hai (isliye feel bhi wahi consistent-smooth
// hoga, koi nayi dependency bhi nahi chahiye).
// fullBleed: true ho to overlay screen ke bilkul neeche tak jaata hai
// (BottomNav ke liye jagah nahi chhodta) - DM chat window khulne par use hota
// hai, jab BottomNav hide hota hai aur neeche sirf input field rehti hai.
export const PersistentSlide = ({
  show,
  children,
  style,
  fullBleed = false,
}: TransitionProps & { fullBleed?: boolean }) => {
  const { width } = useWindowDimensions();
  const zIndex = useTopZIndex(show);
  const translateX = useSharedValue(show ? 0 : width);

  useEffect(() => {
    translateX.value = withTiming(show ? 0 : width, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [show, width, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View
      pointerEvents={show ? 'auto' : 'none'}
      // BOTTOM_NAV_PX: CommunityListScreen jaisa hi - `bottom: 0` NAHI,
      // taaki BottomNav (jo neeche, is overlay ke peeche render hota hai)
      // hamesha dikhta rahe, Community mein jaisa dikhta hai waisa hi.
      style={[styles.persistentOverlay, { bottom: fullBleed ? 0 : BOTTOM_NAV_PX, zIndex, elevation: zIndex }, animatedStyle, style]}
    >
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  persistentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
  },
});