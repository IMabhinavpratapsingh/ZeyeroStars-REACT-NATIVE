import React, { memo, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const THRESHOLD = 60;
const MAX_DRAG = 70;

/**
 * Instagram jaisa swipe-to-reply. Left ya right, jis taraf se swipe start ho
 * (align ke hisaab se), threshold cross karte hi onReply() call ho jata hai.
 *
 * WEB -> RN CHANGE:
 * Web version mein "PERF NOTE" tha - touchmove par setState() na kar ke
 * seedha DOM ref.style.transform (rAF ke saath) set kiya jaata tha taaki
 * poora bubble re-render na ho. RN mein isi philosophy ka NATIVE
 * equivalent `react-native-gesture-handler` + `react-native-reanimated`
 * hai: gesture poore UI THREAD par chalta hai (JS thread ko chhuta bhi
 * nahi), aur `useAnimatedStyle` seedha native view props update karta hai
 * - koi React re-render, koi rAF/ref-juggling ki zaroorat nahi, aur purane
 * web-version se bhi zyada smooth (JS thread kabhi involve hi nahi hota).
 *
 * `onReply` sirf gesture khatam hone par, JS thread par (`runOnJS`) call
 * hota hai - jaisa pehle touch-end par hota tha.
 */
interface SwipeableBubbleProps {
  children: ReactNode;
  align?: 'start' | 'end';
  onReply: () => void;
  replyIcon?: ReactNode;
}

const SwipeableBubble = ({ children, align, onReply, replyIcon }: SwipeableBubbleProps) => {
  const translateX = useSharedValue(0);
  const iconOpacity = useSharedValue(0);
  const isEnd = align === 'end';

  // IMPORTANT (scroll fix): Pan ko sirf HORIZONTAL drag par activate hona
  // chahiye. Pehle koi offset nahi tha, isliye bubble par ungli rakh ke
  // vertical scroll karne par bhi Pan jeet jaata tha aur FlatList/ScrollView
  // ka scroll cancel ho jaata tha (chat "scroll nahi ho raha").
  //  - activeOffsetX: sirf reply-wali direction mein ~12px horizontal drag
  //    par activate.
  //  - failOffsetX: ulti direction mein drag => fail (scroll/parent ko do).
  //  - failOffsetY: ~12px vertical drag => fail, list scroll ho jaaye.
  // useMemo: gesture har render par dobara na bane (onReply stable hona
  // chahiye - caller useCallback de).
  const pan = useMemo(() => {
    const g = Gesture.Pan()
      .failOffsetY([-12, 12])
      .onUpdate((e) => {
        const clamped = isEnd ? Math.min(0, e.translationX) : Math.max(0, e.translationX);
        const offset = Math.max(Math.min(clamped, MAX_DRAG), -MAX_DRAG);
        translateX.value = offset;
        iconOpacity.value = Math.min(Math.abs(offset) / THRESHOLD, 1);
      })
      .onEnd(() => {
        const offset = translateX.value;
        translateX.value = withTiming(0, { duration: 200 });
        iconOpacity.value = withTiming(0, { duration: 200 });
        if (Math.abs(offset) >= THRESHOLD) {
          runOnJS(onReply)();
        }
      });
    return isEnd ? g.activeOffsetX(-12).failOffsetX(12) : g.activeOffsetX(12).failOffsetX(-12);
  }, [isEnd, onReply, translateX, iconOpacity]);

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
  }));

  return (
    <View style={[styles.row, { justifyContent: isEnd ? 'flex-end' : 'flex-start' }]}>
      <Animated.View style={[styles.icon, isEnd ? { right: -28 } : { left: -28 }, iconStyle]}>
        {replyIcon ?? <Ionicons name="arrow-undo-outline" size={18} color="#a1a1aa" />}
      </Animated.View>

      {/*
        IMPORTANT: max-width yahan lagaya hai, DMChatWindow ke andar wali
        bubble pe nahi - is View ka parent `width: '100%'` hai, isliye "%"
        width yahan reliably resolve hoti hai. Pehle yeh constraint andar
        (content ke paas) tha, jiska parent khud shrink-to-fit tha - us
        wajah se chhote messages ("Hii" jaise) ke liye calculated width
        text se bhi choti ho sakti thi, aur word bubble ke bahar overflow
        ho jaata tha.
      */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.bubbleWrap, bubbleStyle]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    position: 'absolute',
  },
  bubbleWrap: {
    maxWidth: '75%',
  },
});

export default memo(SwipeableBubble);