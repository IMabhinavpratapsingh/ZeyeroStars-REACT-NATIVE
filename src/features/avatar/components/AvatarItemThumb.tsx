import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SvgAssetView from './SvgAssetView';

/**
 * Selection box me item ki thumbnail dikhata hai.
 *
 * ⚠️ PEHLE WALE VERSION SE BADLAV (yeh file REPLACE karo):
 * Purana version `url` (string) leke fetch() se SVG text padhta tha
 * (getSvgLayout). Lekin RN mein getAssetUrl() ab `require('x.svg')` ka
 * result deta hai (react-native-svg-transformer ka SVG COMPONENT), string
 * URL nahi - isliye fetch(url) chal hi nahi sakta tha. Ab prop `asset` hai:
 *
 *   <AvatarItemThumb asset={getAssetUrl(item.item_category, item.items_id)} />
 *
 * `padding` / `fill` props hata diye (woh getSvgLayout ke crop-zoom ke liye
 * the, jo RN mein viewBox-fallback ki wajah se waise bhi crop nahi karta
 * tha - dekho shared/utils/svgBBox.ts). Ab poora canvas "contain" fit hota
 * hai.
 *
 * NOTE: item SVGs poore avatar canvas (350x250) par bane hain, isliye chhoti
 * item (jaise nose/eyes) thumbnail me chhoti dikhegi. Web jaisa tight-crop
 * chahiye to build-time bbox JSON wala option (svgBBox.ts ka comment,
 * option 1) lagana padega - bata dena to bana dunga.
 */
interface AvatarItemThumbProps {
  asset: any;
  alt?: string;
}

const AvatarItemThumb = ({ asset, alt }: AvatarItemThumbProps) => {
  return (
    <View style={styles.fill} accessibilityLabel={alt}>
      <SvgAssetView
        asset={asset}
        preserveAspectRatio="xMidYMid meet"
        fallback={<Text style={styles.noPreview}>No preview</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  noPreview: {
    fontSize: 11,
    color: '#6e6e6e', // star-500
    textAlign: 'center',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
});

export default memo(AvatarItemThumb);