import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Image } from 'expo-image';
import { AVATAR_PHOTO_RECT, buildAvatarPlaneXml } from '../utils/avatarPlane';

/**
 * AvatarPlane.svg = ek photo-frame design: "photoarea" = jahan asli user
 * photo (URL se) render hoti hai, "frame" = uske around ka decorative ring
 * (abhi placeholder, baad me real art se replace hoga).
 *
 * WEB -> RN CHANGES (detail ke liye utils/avatarPlane.ts ka comment dekho):
 * - Runtime fetch + DOMParser + getBBox + btoa (web) -> sab build-time par
 *   pre-process ho chuka hai. Isliye yahan koi async load / skeleton /
 *   `failed` fallback state nahi bachi - base turant render hota hai.
 * - `<img src=dataUri>` -> react-native-svg `<SvgXml>` (preserveAspectRatio
 *   "none", web jaisa hi - parent ka box already sahi ratio ka hota hai).
 * - Photo `<img>` -> expo-image `<Image>` (`cachePolicy="disk"`, dekho
 *   avatarCache.ts ka comment), rounded-full = bade borderRadius se.
 *
 * Yeh component parent ka poora box (absoluteFill) bharta hai - parent
 * (AvatarLayers) pehle hi box ko avatar ke canvas-ratio par letterbox kar
 * chuka hota hai, isliye yahan koi aur size calculation nahi.
 *
 * Skin-color customization hata di gayi hai - base hamesha ek fixed
 * DEFAULT_SKIN_COLOR me render hota hai.
 */
const DEFAULT_SKIN_COLOR = '#F1C27D';
const PLANE_XML = buildAvatarPlaneXml(DEFAULT_SKIN_COLOR);

const pct = (frac: number) => `${frac * 100}%` as `${number}%`;

interface AvatarBaseProps {
  photoUrl?: string | null;
}

const AvatarBase = ({ photoUrl = null }: AvatarBaseProps) => {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <SvgXml xml={PLANE_XML} width="100%" height="100%" preserveAspectRatio="none" />
      {!!photoUrl && (
        <View
          style={[
            styles.photoWrap,
            {
              left: pct(AVATAR_PHOTO_RECT.xFrac),
              top: pct(AVATAR_PHOTO_RECT.yFrac),
              width: pct(AVATAR_PHOTO_RECT.wFrac),
              height: pct(AVATAR_PHOTO_RECT.hFrac),
            },
          ]}
        >
          <Image
            source={{ uri: photoUrl }}
            style={styles.photo}
            contentFit="cover"
            cachePolicy="disk"
            transition={120}
            accessibilityLabel="avatar photo"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  photoWrap: {
    position: 'absolute',
    borderRadius: 9999, // rounded-full (photo area square hai -> perfect circle)
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
});

export default memo(AvatarBase);