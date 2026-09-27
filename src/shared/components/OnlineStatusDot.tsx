import React from 'react';
import { StyleSheet, View } from 'react-native';
import usePresence from '../hooks/usePresence';

/**
 * Round pfp ke bottom-left corner par chhota status dot - green (online) /
 * grey (offline). Parent avatar wrapper ko `position: 'relative'` hona
 * chahiye (round pfp wrappers already relative/absolute context ke andar
 * hote hain, isliye yeh khud `absolute` positioned hai). `size` dot ke
 * diameter (px) ko control karta hai - bada pfp = bada dot.
 *
 * WEB -> RN CHANGE: `border-star-900` (Tailwind color token) ka direct RN
 * equivalent hardcode kar diya hai (#0f0f14-ish dark bg) - agar aapka
 * theme file alag shade use karta hai to yahan se import kar lena.
 */
interface OnlineStatusDotProps {
  userId: string | number;
  size?: number;
}

const BORDER_COLOR = '#1a1a24'; // star-900 ke barabar - theme se replace kar sakte ho

const OnlineStatusDot = ({ userId, size = 12 }: OnlineStatusDotProps) => {
  const isOnline = usePresence(userId);

  // Jab tak pehla presence-check complete nahi hota, kuch mat dikhao -
  // warna offline se online (ya ulta) ek flash dikhega.
  if (isOnline === undefined) return null;

  return (
    <View
      style={[
        styles.dot,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: isOnline ? '#22c55e' : '#6b7280', // green-500 / gray-500
        },
      ]}
      accessibilityLabel={isOnline ? 'Online' : 'Offline'}
    />
  );
};

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    borderWidth: 2,
    borderColor: BORDER_COLOR,
  },
});

export default OnlineStatusDot;