import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatePresence, MotiView } from 'moti';

/**
 * Generic full-screen loading overlay - room/battle (ya kahin bhi) mein
 * ENTER karte waqt thodi der ke liye dikhaya jaata hai, taaki screen ka
 * achanak "pop" hona confusing na lage (pehle pata hi nahi chalta tha ki
 * loading ho rahi hai ya kuch atak gaya hai).
 *
 * show: overlay dikhana hai ya nahi
 * text: neeche chhota label (default "Loading...")
 * zIndex: optional - kisi upar wali screen ke saath conflict na ho isliye
 *         (useTopZIndex se pass karo agar kisi aur cheez ke upar dikhana ho)
 *
 * Design: poori screen thodi darker ho jaati hai (RN mein cheap real-time
 * backdrop-blur available nahi hai, isliye sirf darkened overlay - blur
 * chahiye to `expo-blur`'s `<BlurView>` laga sakte hain), beech mein ek
 * gol badge hai jiske andar "Z" hai - wo Z fade -> full visible -> fade ->
 * full visible loop mein chalta rehta hai (breathing pulse), jab tak
 * `show` false na ho jaaye.
 */
interface LoadingOverlayProps {
  show: boolean;
  text?: string;
  zIndex?: number;
}

const LoadingOverlay = ({ show, text = 'Loading...', zIndex = 200 }: LoadingOverlayProps) => {
  return (
    <AnimatePresence>
      {show && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ type: 'timing', duration: 200 }}
          style={[styles.backdrop, { zIndex }]}
        >
          {/* Z badge - opacity + scale loop: fade -> full -> fade -> full (infinite) */}
          <MotiView
            from={{ opacity: 1, scale: 1 }}
            animate={{ opacity: 0.25, scale: 0.94 }}
            transition={{
              type: 'timing',
              duration: 1300,
              loop: true,
              repeatReverse: true,
              easing: (t) => t, // easeInOut ke qareeb, Moti built-in easing curve
            }}
            style={styles.badge}
          >
            <Text style={styles.badgeText} selectable={false}>
              Z
            </Text>
          </MotiView>

          {!!text && <Text style={styles.label}>{text}</Text>}
        </MotiView>
      )}
    </AnimatePresence>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: '#1e1e2a', // star-800
    borderWidth: 1,
    borderColor: '#2a2a38', // star-700
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  badgeText: {
    fontSize: 30,
    fontWeight: '800',
    color: '#6366f1', // star-primary-500
  },
  label: {
    marginTop: 16,
    fontSize: 13,
    fontWeight: '600',
    color: '#d4d4d8', // star-300
    letterSpacing: 0.3,
  },
});

export default memo(LoadingOverlay);