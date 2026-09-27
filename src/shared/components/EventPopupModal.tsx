import React, { memo, useEffect, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../config/config';
import useTopZIndex from '../hooks/useTopZIndex';
import useBackButtonHandler from '../hooks/useBackButtonHandler';
import useStableCallback from '../hooks/useStableCallback';
import { FadeIn, CardPop } from './motion/ScreenTransition';

/**
 * Game khulte hi dikhne wala event/announcement popup - DB ke
 * 'event_popups' table se (event_name, image_url, link_url). Image/button
 * tap karne se link_url browser mein khulta hai. Active popup na ho to
 * kuch render nahi hota.
 *
 * WEB -> RN CHANGES:
 * - `window.open(..., '_blank')` -> `Linking.openURL`.
 * - `max-h-[70vh]` -> useWindowDimensions se 70% height; image ka aspect
 *   ratio `onLoad` se nikalta hai taaki contain mode mein poori dikhe.
 * - Backdrop tap = close, card par tap backdrop tak nahi jaata.
 * - Android hardware back = close.
 */
interface EventPopup {
  event_name?: string | null;
  image_url?: string | null;
  link_url?: string | null;
}

interface EventPopupModalProps {
  show: boolean;
  onClose: () => void;
}

const EventPopupModal = ({ show, onClose }: EventPopupModalProps) => {
  const zIndex = useTopZIndex(show);
  const { height: windowH } = useWindowDimensions();
  const [popup, setPopup] = useState<EventPopup | null>(null);
  const [loading, setLoading] = useState(false);
  const [aspect, setAspect] = useState(1);

  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(show && !!popup, handleClose);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    setLoading(true);
    axios
      .get(`${API_BASE}/event-popup/active`)
      .then((res) => {
        if (!cancelled) setPopup(res.data?.popup || null);
      })
      .catch((err) => console.error('Event popup fetch error:', err?.response?.data || err?.message))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [show]);

  // popup ek baar fetch ho jaaye to null nahi hota - exit animation ke liye
  // fields available rehte hain. Sirf "popup hai hi nahi" case guard hai.
  if (!popup) return null;
  const shouldShow = show && !loading;

  const handleOpenLink = () => {
    if (popup.link_url) {
      Linking.openURL(popup.link_url).catch((e) => console.error('Open link failed:', e));
    }
  };

  return (
    <FadeIn show={shouldShow} style={[styles.overlay, { zIndex, elevation: 20 }]}>
      <Pressable style={styles.center} onPress={onClose}>
        <CardPop style={styles.card}>
          {/* Card ke andar tap backdrop (close) tak na jaaye */}
          <Pressable onPress={() => {}}>
            <Pressable onPress={onClose} hitSlop={6} style={styles.closeBtn} accessibilityLabel="Close">
              <Ionicons name="close" size={16} color="#ffffff" />
            </Pressable>

            {!!popup.image_url && (
              <Pressable onPress={handleOpenLink} disabled={!popup.link_url}>
                <Image
                  source={{ uri: popup.image_url }}
                  accessibilityLabel={popup.event_name || 'Event'}
                  resizeMode="contain"
                  onLoad={(e) => {
                    const { width, height } = e.nativeEvent.source;
                    if (width && height) setAspect(width / height);
                  }}
                  style={[styles.image, { aspectRatio: aspect, maxHeight: windowH * 0.7 }]}
                />
              </Pressable>
            )}

            {!!popup.event_name && (
              <View style={styles.info}>
                <Text style={styles.name}>{popup.event_name}</Text>
                {!!popup.link_url && (
                  <Pressable
                    onPress={handleOpenLink}
                    style={({ pressed }) => [styles.linkBtn, pressed && styles.linkBtnPressed]}
                  >
                    <Text style={styles.linkText}>Check it out</Text>
                    <Ionicons name="arrow-forward" size={16} color="#ffffff" />
                  </Pressable>
                )}
              </View>
            )}
          </Pressable>
        </CardPop>
      </Pressable>
    </FadeIn>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 384,
    backgroundColor: '#1e1e2a', // star-800
    borderWidth: 1,
    borderColor: '#2a2a38', // star-700
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  image: {
    width: '100%',
    backgroundColor: '#141420', // star-900
  },
  info: {
    padding: 16,
    alignItems: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  linkBtn: {
    marginTop: 12,
    width: '100%',
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#4f46e5', // star-primary-600
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  linkBtnPressed: { backgroundColor: '#6366f1' }, // star-primary-500
  linkText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});

export default memo(EventPopupModal);