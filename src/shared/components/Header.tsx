import React, { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/**
 * Header ab chaar cheezein dikhata hai: bayein taraf Profile button - apni
 * pfp (photo) dikhata hai; koi pfp na ho (ya URL load fail ho jaaye) to
 * default rounded placeholder (User icon) dikhta hai. Uske turant right
 * side "Shop" button hai. Beech mein ek Search bar (tap karte hi asli
 * SearchModal khulta hai - yeh khud ek input nahi hai, bas ek pill-shaped
 * trigger hai), aur dayein taraf Notifications bell (unread hone par red
 * dot).
 *
 * WEB -> RN CHANGE: Tailwind `bg-gradient-to-r` -> `expo-linear-gradient`'s
 * `<LinearGradient>` (`npx expo install expo-linear-gradient`). `<img
 * onError>` -> RN `<Image onError>` (same idea: load fail hote hi
 * placeholder par girta hai).
 */
interface HeaderProps {
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
  hasUnreadNotifications?: boolean;
  onProfileClick?: () => void;
  myAvatarUrl?: string | null;
  onShopClick?: () => void;
  isShopActive?: boolean;
}

const Header = ({
  onSearchClick,
  onNotificationsClick,
  hasUnreadNotifications,
  onProfileClick,
  myAvatarUrl,
  onShopClick,
  isShopActive = false,
}: HeaderProps) => {
  // Photo URL diya gaya ho lekin fetch/load fail ho jaaye (dead link,
  // expired signed URL, network) - us case mein bhi default placeholder
  // par girna chahiye, blank/broken image icon nahi dikhna chahiye.
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = !!myAvatarUrl && !imgFailed;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onProfileClick}
        accessibilityLabel="Profile"
        style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
      >
        {showPhoto ? (
          <Image
            source={{ uri: myAvatarUrl! }}
            accessibilityLabel="Your profile"
            style={styles.avatarImg}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <Ionicons name="person-outline" size={22} color="#f4f4f5" />
        )}
      </Pressable>

      <Pressable
        onPress={onShopClick}
        accessibilityLabel="Shop"
        style={({ pressed }) => [
          styles.iconBtn,
          isShopActive ? styles.iconBtnActive : styles.iconBtnPlain,
          pressed && styles.iconBtnPressed,
        ]}
      >
        <Ionicons name="cart-outline" size={20} color={isShopActive ? '#ffffff' : '#fbbf24'} />
      </Pressable>

      <Pressable
        onPress={onSearchClick}
        accessibilityLabel="Search"
        style={({ pressed }) => [styles.searchBtn, pressed && { transform: [{ scale: 0.98 }] }]}
      >
        <LinearGradient
          colors={['#d946ef', '#dc2626', '#6366f1']} // star-accent-600 -> star-danger-600 -> star-primary-500
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.searchGradient}
        >
          <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.9)" />
          <Text style={styles.searchText} numberOfLines={1}>
            Search
          </Text>
        </LinearGradient>
      </Pressable>

      <Pressable
        onPress={onNotificationsClick}
        accessibilityLabel="Notifications"
        style={({ pressed }) => [styles.iconBtn, styles.iconBtnPlain, pressed && styles.iconBtnPressed]}
      >
        <Ionicons name="notifications-outline" size={20} color="#fbbf24" />
        {hasUnreadNotifications && <View style={styles.redDot} />}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e2a', // star-800
    backgroundColor: '#141420', // star-900
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconBtnPlain: {
    backgroundColor: '#2a2a38', // star-700
  },
  iconBtnActive: {
    backgroundColor: '#4f46e5', // star-primary-600
  },
  iconBtnPressed: {
    opacity: 0.85,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  searchBtn: {
    flex: 1,
    minWidth: 0,
    borderRadius: 999,
    overflow: 'hidden',
  },
  searchGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    flexShrink: 1,
  },
  redDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ef4444', // star-danger-500
    borderWidth: 2,
    borderColor: '#141420', // star-900
  },
});

export default memo(Header);