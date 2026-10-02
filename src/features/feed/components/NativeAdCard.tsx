import { memo, useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
} from 'react-native-google-mobile-ads';
import { ensureAdsInitialized, getNativeAdUnitId } from '../../../shared/services/adsService';

// Feed mein har 4th post ke baad dikhne wala AdMob Native ad (FeedList.tsx
// isse render karta hai).
//
// react-native-google-mobile-ads v17.0.0 mein docs wala `useNativeAd` hook
// NAHI hai (wo naye version mein aaya) - isliye ad yahin
// NativeAd.createForAdRequest se load hota hai aur unmount par destroy().
//
// Google ke NativeAsset rules:
//  - har asset (Text/Image) NativeAsset ka DIRECT child ho, beech mein koi
//    View/Touchable wrap NAHI (warna click/impression track nahi hota) - CTA
//    isiliye Text hi hai, button nahi.
//  - "Ad" attribution dikhana zaroori hai.
//  - load na ho / no-fill ho to card poora gayab (null) - blank gap nahi.
const NativeAdCard = memo(function NativeAdCard() {
  const [ad, setAd] = useState<NativeAd | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: NativeAd | null = null;

    (async () => {
      try {
        await ensureAdsInitialized();
        const nativeAd = await NativeAd.createForAdRequest(getNativeAdUnitId());
        if (cancelled) {
          nativeAd.destroy(); // load hote-hote card unmount ho gaya
          return;
        }
        loaded = nativeAd;
        setAd(nativeAd);
      } catch (err) {
        // no-fill / network error - feed ko kuch nahi hona chahiye, card hi nahi dikhega.
        console.warn('NativeAdCard: ad load failed', err);
      }
    })();

    return () => {
      cancelled = true;
      loaded?.destroy();
    };
  }, []);

  if (!ad) return null;

  return (
    <NativeAdView nativeAd={ad} style={styles.card}>
      <View style={styles.header}>
        {!!ad.icon && (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: ad.icon.url }} style={styles.icon} />
          </NativeAsset>
        )}
        <View style={styles.headerText}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={styles.headline} numberOfLines={2}>
              {ad.headline}
            </Text>
          </NativeAsset>
          <View style={styles.metaRow}>
            <Text style={styles.adBadge}>Ad</Text>
            {!!ad.advertiser && (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text style={styles.advertiser} numberOfLines={1}>
                  {ad.advertiser}
                </Text>
              </NativeAsset>
            )}
          </View>
        </View>
      </View>

      {!!ad.body && (
        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text style={styles.body} numberOfLines={3}>
            {ad.body}
          </Text>
        </NativeAsset>
      )}

      {!!ad.mediaContent && <NativeMediaView style={styles.media} resizeMode="cover" />}

      {!!ad.callToAction && (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text style={styles.cta}>{ad.callToAction}</Text>
        </NativeAsset>
      )}
    </NativeAdView>
  );
});

export default NativeAdCard;

const styles = StyleSheet.create({
  // PostCard (FeedList.tsx) jaisa hi card: same padding + neeche ki border.
  card: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  icon: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#18181b' },
  headerText: { flex: 1 },
  headline: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  adBadge: {
    color: '#facc15',
    fontSize: 10,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: '#facc15',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  advertiser: { color: '#71717a', fontSize: 11, flexShrink: 1 },
  body: { color: '#e4e4e7', fontSize: 14, lineHeight: 19 },
  media: { width: '100%', borderRadius: 10, marginTop: 10, backgroundColor: '#18181b', overflow: 'hidden' },
  cta: {
    marginTop: 12,
    backgroundColor: '#4f46e5',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
});