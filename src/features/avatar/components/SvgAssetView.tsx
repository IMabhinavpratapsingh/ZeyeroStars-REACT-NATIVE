import React, { memo, useEffect, useState } from 'react';
import { Image } from 'expo-image';

/**
 * `require('x.svg')` ka result dikhane ki EK hi jagah (AvatarLayers,
 * AvatarItemThumb, EquippedItemsModal - teeno yahi use karte hain).
 *
 * Old web frontend jaisa hi: wahan har SVG ka URL milta tha aur
 * `<img src={url}>` se dikhta tha. RN mein wahi kaam `expo-image` ka
 * `<Image source={require('x.svg')} />` karta hai - Metro `.svg` ko plain
 * asset maanta hai (require ek asset id deta hai), expo-image usse khud
 * uri mein badal ke SVG decode karke dikha deta hai. Koi metro.config /
 * transformer / manual XML nahi chahiye, aur expo-image ka apna
 * memory+disk cache mil jaata hai.
 *
 * - preserveAspectRatio="none" (avatar layers ko box poora bharna hai) ->
 *   contentFit="fill", baaki sab jagah -> "contain".
 * - Agar kabhi react-native-svg-transformer lagao to `require` COMPONENT
 *   dega - woh case bhi yahan handle hai (Comp branch).
 */

export const toSvgComponent = (asset: any): React.ComponentType<any> | null => {
  if (!asset || typeof asset === 'number') return null;
  const candidate = asset.default ?? asset;
  const isComponent =
    typeof candidate === 'function' ||
    (typeof candidate === 'object' && candidate !== null && '$$typeof' in candidate);
  return isComponent ? candidate : null;
};

interface SvgAssetViewProps {
  asset: any;
  width?: number | string;
  height?: number | string;
  preserveAspectRatio?: string;
  /** asset null ho ya image load fail ho - tab yeh dikhta hai */
  fallback?: React.ReactNode;
}

const SvgAssetView = ({
  asset,
  width = '100%',
  height = '100%',
  preserveAspectRatio,
  fallback = null,
}: SvgAssetViewProps) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [asset]);

  const Comp = toSvgComponent(asset);
  if (Comp) return <Comp width={width} height={height} preserveAspectRatio={preserveAspectRatio} />;
  if (!asset || failed) return <>{fallback}</>;

  return (
    <Image
      source={asset}
      style={{ width: width as any, height: height as any }}
      contentFit={preserveAspectRatio === 'none' ? 'fill' : 'contain'}
      cachePolicy="memory-disk"
      onError={(e) => {
        console.warn('SVG image load fail:', (e as any)?.error || e);
        setFailed(true);
      }}
      accessibilityIgnoresInvertColors
    />
  );
};

export default memo(SvgAssetView);