import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

/**
 * Reddit jaisa post image box:
 *  - box hamesha full-width; height image ke aspect ratio se aati hai
 *  - height ek MAX (maxH) par clamp - bahut lambi photo post ko lamba nahi karti
 *  - image kabhi crop nahi hoti (contain); box se match na ho to peeche
 *    usi image ka blur backdrop (bars nahi dikhte)
 *  - zoomable=true ho to tap par fullscreen viewer: lambi photo poori
 *    scroll karke dekh sakte hain
 */
const MIN_H = 120;
const FALLBACK_RATIO = 1; // load hone se pehle square placeholder
// Ratio module-level cache: list recycle/remount par image dobara load hone se
// pehle hi sahi height milti hai -> layout jump nahi, scroll smooth.
const ratioCache = new Map<string, number>();

type Props = { uri: string; zoomable?: boolean };

export default function PostImage({ uri, zoomable = false }: Props) {
  const { width: winW, height: winH } = useWindowDimensions();
  const [boxW, setBoxW] = useState(0);
  const [ratio, setRatio] = useState<number | null>(ratioCache.get(uri) ?? null); // width / height
  const [viewer, setViewer] = useState(false);

  const maxH = Math.min(winH * 0.6, (boxW || winW) * 1.25);
  const rawH = (boxW || winW) / (ratio || FALLBACK_RATIO);
  const boxH = Math.max(MIN_H, Math.min(rawH, maxH));
  const isClamped = ratio != null && rawH > maxH + 1;

  const body = (
    <View style={[styles.box, { height: boxH }]} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
      {/* Blur backdrop sirf tab jab box se image match nahi karti (lambi photo) -
          blurRadius Android par bahut heavy hai, har post par lagana scroll lag karta tha. */}
      {isClamped && (
        <>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={25} cachePolicy="memory-disk" />
          <View style={[StyleSheet.absoluteFill, styles.dim]} />
        </>
      )}
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit={isClamped ? 'contain' : 'cover'}
        cachePolicy="memory-disk"
        recyclingKey={uri}
        onLoad={(e) => {
          const { width, height } = e.source;
          if (width && height) {
            const r = width / height;
            ratioCache.set(uri, r);
            setRatio((prev) => (prev === r ? prev : r));
          }
        }}
      />
      {isClamped && (
        <View style={styles.tallChip}>
          <Ionicons name="expand-outline" size={12} color="#fff" />
        </View>
      )}
    </View>
  );

  if (!zoomable) return body;

  const fullW = winW;
  const fullH = fullW / (ratio || FALLBACK_RATIO);
  return (
    <>
      <Pressable onPress={() => setViewer(true)}>{body}</Pressable>
      <Modal visible={viewer} transparent animationType="fade" onRequestClose={() => setViewer(false)} statusBarTranslucent>
        <View style={styles.viewerBg}>
          <StatusBar hidden />
          <ScrollView
            contentContainerStyle={[styles.viewerContent, fullH < winH && { minHeight: winH }]}
            showsVerticalScrollIndicator={false}
            maximumZoomScale={4}
            minimumZoomScale={1}
          >
            <Pressable onPress={() => setViewer(false)}>
              <Image source={{ uri }} style={{ width: fullW, height: fullH }} contentFit="contain" />
            </Pressable>
          </ScrollView>
          <Pressable style={styles.closeBtn} onPress={() => setViewer(false)} hitSlop={12}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 4,
    backgroundColor: '#18181b',
  },
  dim: { backgroundColor: 'rgba(0,0,0,0.35)' },
  tallChip: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 5,
  },
  viewerBg: { flex: 1, backgroundColor: '#000' },
  viewerContent: { justifyContent: 'center', alignItems: 'center' },
  closeBtn: {
    position: 'absolute',
    top: 40,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    padding: 8,
  },
});