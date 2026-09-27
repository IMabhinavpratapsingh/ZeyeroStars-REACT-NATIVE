import React, { memo, useMemo, useRef } from 'react';
import { View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  ClipPath,
  LinearGradient,
  Stop,
  G,
  Path,
  Rect,
} from 'react-native-svg';

type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_PX: Record<BadgeSize, number> = {
  xs: 11,
  sm: 14,
  md: 18,
  lg: 28,
};

let __badgeUid = 0;

/**
 * WEB -> RN CHANGE: `<svg>` -> `react-native-svg`. `<span title=...>` ka
 * tooltip RN mein koi hover concept na hone ki wajah se drop kiya - use
 * `accessibilityLabel` se replace kiya hai (screen readers ke liye).
 *
 * SHIMMER NOTE: web version CSS animation class (`verified-badge-shine` /
 * `.verified-badge-sweep` keyframe jo shimmer rect ko x=-40 se x=40 tak
 * slide karati thi) SVG ke bahar (CSS file mein) define thi. RN mein
 * animated components CSS se nahi, JS/reanimated se chalte hain - abhi
 * `shine` prop sirf shimmer gradient/rect draw karta hai par usko ANIMATE
 * nahi karta (static rehta hai). Animate karna ho to
 * `Animated.createAnimatedComponent(Rect)` + reanimated `useAnimatedProps`
 * se `x` ko loop mein -40 -> 40 tak le jaana hoga - bata dena, agla step
 * mein laga dunga.
 */
interface VerifiedBadgeProps {
  size?: BadgeSize;
  shine?: boolean;
  title?: string;
}

const VerifiedBadge = ({ size = 'md', shine = false, title = 'Verified' }: VerifiedBadgeProps) => {
  const px = SIZE_PX[size] || SIZE_PX.md;
  const uidRef = useRef<string>();
  if (!uidRef.current) uidRef.current = `vbadge-${++__badgeUid}`;
  const uid = uidRef.current;

  // 8-point scalloped seal - center circle (12) + 8 petal circles (radius 8)
  // equal distance (11) par center ke around - classic verified badge
  // jaisa "flower seal" shape banata hai.
  const petals = useMemo(
    () => [
      [30.16, 24.21],
      [24.21, 30.16],
      [15.79, 30.16],
      [9.84, 24.21],
      [9.84, 15.79],
      [15.79, 9.84],
      [24.21, 9.84],
      [30.16, 15.79],
    ],
    []
  );

  const SealShape = ({ fill }: { fill?: string }) => (
    <>
      <Circle cx={20} cy={20} r={12} fill={fill} />
      {petals.map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={8} fill={fill} />
      ))}
    </>
  );

  return (
    <View style={{ width: px, height: px }} accessibilityLabel={title}>
      <Svg viewBox="0 0 40 40" width={px} height={px}>
        <Defs>
          <ClipPath id={uid}>
            <SealShape />
          </ClipPath>
          <LinearGradient id={`${uid}-shimmer`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
            <Stop offset="50%" stopColor="#ffffff" stopOpacity={0.85} />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Light orange seal body - koi shine/glow nahi, bas flat color */}
        <SealShape fill="#ffb066" />

        {/* Z glyph */}
        <Path
          d="M13.5 14.5 H25 L14.5 25.5 H26.5"
          fill="none"
          stroke="#ffffff"
          strokeWidth={3.1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Shimmer sweep - seal shape ke andar hi clip hota hai (static; see note above) */}
        {shine && (
          <G clipPath={`url(#${uid})`}>
            <Rect x={-40} y={0} width={24} height={40} fill={`url(#${uid}-shimmer)`} />
          </G>
        )}
      </Svg>
    </View>
  );
};

export default memo(VerifiedBadge);