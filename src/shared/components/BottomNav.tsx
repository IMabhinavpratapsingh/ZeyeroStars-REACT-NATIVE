import React, { memo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BOTTOM_NAV_PX } from '../constants/layout';

const DOUBLE_TAP_MS = 300;

interface NavButtonProps {
  label: string;
  icon: string;
  onPress?: () => void;
  badge?: number;
  active?: boolean;
}

const NavButton = ({ label, icon, onPress, badge = 0, active }: NavButtonProps) => (
  <Pressable onPress={onPress} style={styles.navButton}>
    <View style={styles.iconWrap}>
      <Ionicons name={icon as any} size={22} color={active ? '#ffffff' : '#f4f4f5'} />
      {badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </View>
    <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
      {label}
    </Text>
  </Pressable>
);

// Home slot ab ek seedha "Home" button hai (Instagram ke home-tab icon
// jaisa hi behaviour), quick-actions "+" se poori tarah alag ho gaya hai
// (woh ab apni floating FAB hai, feed screen ke upar - dekho dashboard.tsx
// + QuickActionsFab.tsx):
//   - SINGLE TAP -> `onSingleTap` (koi bhi Rooms/DM/Community overlay khula
//     ho to woh band karke feed par wapas; already feed par ho to no-op).
//   - DOUBLE TAP -> `onDoubleTap` (Instagram jaisa: feed list top par
//     scroll + reload) - sirf tab fire hota hai jab already home par ho
//     aur koi overlay khula na ho (`canDoubleTap`), warna do quick taps
//     bhi do alag single-tap navigation hi count honge.
// Double-tap detection yahin local hai (RN mein built-in onDoubleTap nahi
// hota) - ek chhota window (300ms) ke andar dusra tap aaye to double count.
const HomeActionButton = ({
  isHomeActive,
  canDoubleTap,
  onSingleTap,
  onDoubleTap,
}: {
  isHomeActive: boolean;
  canDoubleTap: boolean;
  onSingleTap?: () => void;
  onDoubleTap?: () => void;
}) => {
  const lastTapRef = useRef(0);

  const handlePress = () => {
    const now = Date.now();
    const isDoubleTap = canDoubleTap && now - lastTapRef.current < DOUBLE_TAP_MS;
    lastTapRef.current = now;

    if (isDoubleTap) {
      lastTapRef.current = 0; // teesra jaldi tap phir se double na ban jaaye
      onDoubleTap?.();
      return;
    }
    onSingleTap?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityLabel="Home"
      style={({ pressed }) => [styles.navButton, pressed && styles.homeButtonPressed]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={isHomeActive ? 'home' : 'home-outline'} size={24} color="#ffffff" />
      </View>
      <Text style={[styles.navLabel, isHomeActive && styles.navLabelActive]} numberOfLines={1}>
        Home
      </Text>
    </Pressable>
  );
};

/**
 * Profile button Header ke top-left mein hai. Sirf 5 items hain (Rooms,
 * DM, Home, Communities, Game) - isliye HomeAction button beech mein (3rd
 * of 5) automatically perfectly center baithta hai.
 *
 * NOTE: is component ki height `BOTTOM_NAV_PX` (shared/constants/layout.ts)
 * se EXACTLY match honi chahiye - Room screen aur keyboard-aware panels
 * apni height usi value se compute karte hain. Mismatch = un screens ke
 * neeche se background peek karne wala gap.
 */
interface BottomNavProps {
  onRoomsClick?: () => void;
  onDMClick?: () => void;
  onCommunitiesClick?: () => void;
  onGameClick?: () => void;
  dmBadgeCount?: number;
  isHomeActive?: boolean;
  // Single tap: feed par wapas (overlay khula ho to pehle wahi band).
  onHomeSingleTap?: () => void;
  // Double tap: feed list top par scroll + reload - sirf tab possible jab
  // already home par ho aur koi overlay khula na ho.
  onHomeDoubleTap?: () => void;
  isRoomsActive?: boolean;
  isDMActive?: boolean;
  isCommunitiesActive?: boolean;
  isGameActive?: boolean;
}

const BottomNav = ({
  onRoomsClick,
  onDMClick,
  onCommunitiesClick,
  onGameClick,
  dmBadgeCount = 0,
  isHomeActive = false,
  onHomeSingleTap,
  onHomeDoubleTap,
  isRoomsActive = false,
  isDMActive = false,
  isCommunitiesActive = false,
  isGameActive = false,
}: BottomNavProps) => {
  return (
    <View style={styles.bar}>
      <NavButton label="Rooms" icon="chatbubble-outline" onPress={onRoomsClick} active={isRoomsActive} />
      <NavButton label="DM" icon="send-outline" onPress={onDMClick} badge={dmBadgeCount} active={isDMActive} />
      <HomeActionButton
        isHomeActive={isHomeActive}
        canDoubleTap={isHomeActive}
        onSingleTap={onHomeSingleTap}
        onDoubleTap={onHomeDoubleTap}
      />
      <NavButton label="Community" icon="people-outline" onPress={onCommunitiesClick} active={isCommunitiesActive} />
      <NavButton label="Game" icon="game-controller-outline" onPress={onGameClick} active={isGameActive} />
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    height: BOTTOM_NAV_PX,
    backgroundColor: '#000000', // star-900
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  navButton: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 32,
    height: 32,
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#dc2626', // star-danger-600
    borderWidth: 1,
    borderColor: '#141420', // star-900
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  navLabel: {
    color: '#f4f4f5', // star-100
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  navLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  homeButtonPressed: {
    opacity: 0.7,
  },
});

export default memo(BottomNav);