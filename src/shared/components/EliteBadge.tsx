import React, { memo, useMemo, useRef } from 'react';
import { View } from 'react-native';
import Svg, {
  Defs,
  ClipPath,
  Polygon,
  RadialGradient,
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

// VerifiedBadge.tsx jaisa hi structure/sizing - alag badge hai (Elite),
// dono ek player ke paas ek saath dikh sakte hain (is_verified aur
// is_elite dono independent flags hain).
//
// SHIMMER NOTE: VerifiedBadge.tsx jaisa hi - `shine` abhi static hai,
// animate nahi hota (web mein CSS keyframe tha). Bata dena agar reanimated
// se animate karwana hai.
interface EliteBadgeProps {
  size?: BadgeSize;
  shine?: boolean;
  title?: string;
}

const EliteBadge = ({ size = 'md', shine = true, title = 'Elite' }: EliteBadgeProps) => {
  const px = SIZE_PX[size] || SIZE_PX.md;
  const uidRef = useRef<string>();
  if (!uidRef.current) uidRef.current = `ebadge-${++__badgeUid}`;
  const uid = uidRef.current;

  // 8-point SHARP spike seal (alternating long spike / short inner point,
  // koi curve nahi) - Verified ke round scalloped shape se bilkul alag,
  // "nukila" red seal jaisa lage.
  const spikePoints = useMemo(() => {
    const cx = 20;
    const cy = 20;
    const outerR = 19;
    const innerR = 10.5;
    const spikes = 8;
    const pts: string[] = [];
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / spikes) * i - Math.PI / 2;
      pts.push(`${(cx + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`);
    }
    return pts.join(' ');
  }, []);

  return (
    <View style={{ width: px, height: px }} accessibilityLabel={title}>
      <Svg viewBox="0 0 40 40" width={px} height={px}>
        <Defs>
          <ClipPath id={uid}>
            <Polygon points={spikePoints} />
          </ClipPath>
          <RadialGradient id={`${uid}-glow`} cx="50%" cy="42%" r="65%">
            <Stop offset="0%" stopColor="#ff6b5c" />
            <Stop offset="55%" stopColor="#e6231b" />
            <Stop offset="100%" stopColor="#a30f0f" />
          </RadialGradient>
          <LinearGradient id={`${uid}-shimmer`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
            <Stop offset="50%" stopColor="#ffffff" stopOpacity={0.9} />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Red spiky seal body - sharp nukile corners, Verified ke gol shape se alag */}
        <Polygon
          points={spikePoints}
          fill={`url(#${uid}-glow)`}
          stroke="#7a0a0a"
          strokeWidth={0.6}
          strokeLinejoin="round"
        />

        {/* Z glyph */}
        <Path
          d="M13.5 14.5 H26.5 L14.5 25.5 H26.5"
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

export default memo(EliteBadge);