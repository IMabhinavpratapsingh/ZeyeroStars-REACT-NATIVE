import React, { memo, useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import AvatarBase from './AvatarBase';
import SvgAssetView, { toSvgComponent } from './SvgAssetView';
import { getAssetUrl, AVATAR_ASPECT_RATIO_NUM } from '../utils/avatarAssets';

/**
 * equippedByCategory: { back: [3, 9], front: [7], background: 2, frame: 5 }
 * Chaar category hain (neeche se upar, z-order me):
 * - background: sabse neeche (back se bhi peeche)
 * - back: avatar_url ki photo ke PICHHE (max 5, sab stack hote hain)
 * - front: photo ke AAGE (max 5, sab stack hote hain)
 * - frame: sabse upar (front se bhi upar) - pfp ke around decorative border
 *
 * exactFit: jab parent KHUD hi exactly AVATAR_ASPECT_RATIO ke hisaab se
 * sized ho (jaise RoomFloorView ka card) - tab seedha 100% x 100% le lete
 * hain, letterbox calculation skip. Default (false) baaki saari jagah
 * (profile, feed, leaderboard, chat, customize-preview) ke liye letterbox.
 *
 * WEB -> RN CHANGES:
 * - ResizeObserver -> `onLayout` (outer box ka size). Logic wahi: "contain"
 *   fit - avatar ka asli ratio (AVATAR_ASPECT_RATIO_NUM) outer box ke andar
 *   bina crop hue poora dikhao.
 * - `<img src=svgUrl>` -> registry se mila SVG COMPONENT (react-native-svg-
 *   transformer) `width/height="100%"` ke saath. `object-fill` =
 *   preserveAspectRatio="none" (box ka ratio pehle se sahi hai).
 * - `select-none pointer-events-none` -> pointerEvents="none".
 */
export type EquippedByCategory = Record<
  string,
  (string | number)[] | string | number | null | undefined
>;

// toSvgComponent ab SvgAssetView.tsx mein hai (SVG ko file se padhkar SvgXml se
// dikhane wala logic bhi wahin hai); purane imports na tootein isliye re-export.
export { toSvgComponent };

const toIdList = (v: EquippedByCategory[string]): (string | number)[] =>
  Array.isArray(v) ? v : v != null ? [v] : [];

const AssetLayer = memo(({ asset }: { asset: any }) => {
  if (!asset) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <SvgAssetView asset={asset} preserveAspectRatio="none" />
    </View>
  );
});
AssetLayer.displayName = 'AssetLayer';

interface AvatarLayersProps {
  equippedByCategory?: EquippedByCategory;
  photoUrl?: string | null;
  exactFit?: boolean;
  /**
   * 'all' (default): poora avatar. 'background': SIRF background asset.
   * 'foreground': background ke bina baaki sab (back/photo/front/frame).
   * Room floor par background alag layer mein render hota hai taaki kisi
   * ka bhi background kisi doosre ki pfp/frame ke upar na aaye.
   */
  layer?: 'all' | 'background' | 'foreground';
}

const AvatarLayers = ({
  equippedByCategory = {},
  photoUrl = null,
  exactFit = false,
  layer = 'all',
}: AvatarLayersProps) => {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  const backgroundAsset = getAssetUrl('background', equippedByCategory.background as any);
  const backIds = toIdList(equippedByCategory.back);
  const frontIds = toIdList(equippedByCategory.front);
  const frameAsset = getAssetUrl('frame', equippedByCategory.frame as any);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      if (exactFit) return;
      const { width: cw, height: ch } = e.nativeEvent.layout;
      if (!cw || !ch) return;
      // "contain" fit
      let w = ch * AVATAR_ASPECT_RATIO_NUM;
      let h = ch;
      if (w > cw) {
        w = cw;
        h = cw / AVATAR_ASPECT_RATIO_NUM;
      }
      setBox((prev) =>
        prev && Math.abs(prev.width - w) < 0.5 && Math.abs(prev.height - h) < 0.5
          ? prev
          : { width: w, height: h }
      );
    },
    [exactFit]
  );

  return (
    <View style={styles.outer} onLayout={onLayout}>
      <View style={exactFit ? styles.fill : box ?? styles.zero}>
        {/* background: sabse peeche */}
        {layer !== 'foreground' && <AssetLayer asset={backgroundAsset} />}

        {layer !== 'background' && (
          <>
            {/* back: photo ke PICHHE */}
            {backIds.map((id) => (
              <AssetLayer key={`back-${id}`} asset={getAssetUrl('back', id)} />
            ))}

            <AvatarBase photoUrl={photoUrl} />

            {/* front: photo ke AAGE */}
            {frontIds.map((id) => (
              <AssetLayer key={`front-${id}`} asset={getAssetUrl('front', id)} />
            ))}

            {/* frame: sabse upar */}
            <AssetLayer asset={frameAsset} />
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  zero: {
    width: 0,
    height: 0,
  },
});

export default memo(AvatarLayers);