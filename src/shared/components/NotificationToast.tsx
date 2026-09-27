import React, { memo } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FullWindowOverlay } from 'react-native-screens';
import { AnimatePresence, MotiView } from 'moti';
import useAvatarImage from '../../features/avatar/hooks/useAvatarImage';
import type { InAppNotification } from '../hooks/useNotification';

/**
 * In-app message toast (top se slide-in). `useNotification()` ka `notif`
 * yahan pass hota hai; `notif` null hote hi fade-out ke saath gayab.
 *
 * WEB -> RN CHANGES:
 * - Portal + `position: fixed` + WebView clipping workaround ab zaroori nahi -
 *   RN mein overflow-hidden ancestor ka woh bug hota hi nahi. Toast root
 *   layout mein mount karo (AlertPopupHost ke saath); iOS par
 *   `FullWindowOverlay` se <Modal> ke upar bhi dikhta hai.
 *   (Android par khule <Modal> ke peeche chhup sakta hai - RN limitation.)
 * - Safe-area top inset add kiya (notch ke neeche dikhe).
 * - Wrapper `pointerEvents="box-none"` - toast ke bahar ke taps neeche wali
 *   screen tak jaate hain.
 * - Hook hamesha sabse upar call hota hai (conditional return se pehle) -
 *   hooks-order rule wahi purana.
 */
interface NotificationToastProps {
  notif: InAppNotification | null;
  onClick?: () => void;
}

const NotificationToast = ({ notif, onClick }: NotificationToastProps) => {
  const insets = useSafeAreaInsets();
  const avatarSrc = useAvatarImage(
    notif?.user?.id,
    notif?.user?.avatar_url,
    notif?.user?.avatar_version
  );

  const username: string = notif?.user?.username || '?';

  const layer = (
    <View style={[styles.layer, { top: insets.top + 8 }]} pointerEvents="box-none">
      <AnimatePresence>
        {notif && (
          <MotiView
            key="notification-toast"
            from={{ translateY: -30, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            exit={{ translateY: -20, opacity: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 240 }}
            style={styles.wrap}
          >
            <Pressable onPress={onClick} style={styles.card}>
              <View style={styles.avatar}>
                {avatarSrc ? (
                  <Image source={{ uri: avatarSrc }} style={styles.avatarImg} />
                ) : (
                  <Text style={styles.avatarLetter}>{username.charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.textWrap}>
                <Text style={styles.title} numberOfLines={1}>
                  {username} {notif.label || 'sent you a message'}
                </Text>
                <Text style={styles.body} numberOfLines={1}>
                  {typeof notif.content === 'string' ? notif.content : ''}
                </Text>
              </View>
            </Pressable>
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );

  if (Platform.OS === 'ios') {
    return notif ? <FullWindowOverlay>{layer}</FullWindowOverlay> : null;
  }
  return layer;
};

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999999,
    elevation: 50,
  },
  wrap: {
    width: '90%',
    maxWidth: 384,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e1e2a', // star-800
    borderWidth: 1,
    borderColor: '#2a2a38', // star-700
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4f46e5', // star-primary-600
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarLetter: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  body: {
    fontSize: 12,
    color: '#9ca3af', // star-400
    marginTop: 1,
  },
});

export default memo(NotificationToast);