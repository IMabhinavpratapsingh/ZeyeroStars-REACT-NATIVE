import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BOTTOM_NAV_PX } from '../constants/layout';

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

// Home slot ab ek NORMAL bottom-nav button hai (baaki icons jaisa hi,
// beech mein) - "+" / "X" bas iska icon hai:
//   - Home par ho aur sheet band ho  -> "+" (tap => sheet khulta hai)
//   - Home par ho aur sheet khuli ho -> "×" (tap => sheet band hoti hai)
//   - Kisi aur tab par ho            -> "×" (tap => seedha Home wapas)
// (Pehle yeh nav-bar ke UPAR protrude karne wala floating circular FAB
// tha - ab request par baaki 4 buttons ki tarah bar ke andar hi, beech
// mein fit hota hai, koi position:absolute/overflow nahi.)
const HomeActionButton = ({
  isHomeActive,
  sheetOpen,
  onPress,
  badge,
  hidden,
}: {
  isHomeActive: boolean;
  sheetOpen: boolean;
  onPress?: () => void;
  badge?: boolean;
  hidden?: boolean;
}) => {
  const showAsClose = sheetOpen || !isHomeActive;

  if (hidden) {
    return <View style={styles.navButton} />;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={showAsClose ? 'Close / go home' : 'Open quick actions'}
      style={({ pressed }) => [styles.navButton, pressed && styles.homeButtonPressed]}
    >
      <View style={styles.iconWrap}>
        {showAsClose ? (
          <Ionicons name="close" size={24} color="#ffffff" />
        ) : (
          <Ionicons name="add" size={26} color="#ffffff" />
        )}
        {badge ? <View style={styles.fabBadge} /> : null}
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
  onHomeClick?: () => void;
  onCommunitiesClick?: () => void;
  onGameClick?: () => void;
  dmBadgeCount?: number;
  isHomeActive?: boolean;
  quickActionsOpen?: boolean;
  onHomeActionClick?: () => void;
  homeActionBadge?: boolean;
  isRoomsActive?: boolean;
  isDMActive?: boolean;
  isCommunitiesActive?: boolean;
  isGameActive?: boolean;
  hideHomeFab?: boolean;
}

const BottomNav = ({
  onRoomsClick,
  onDMClick,
  onHomeClick,
  onCommunitiesClick,
  onGameClick,
  dmBadgeCount = 0,
  isHomeActive = false,
  quickActionsOpen = false,
  onHomeActionClick,
  homeActionBadge = false,
  isRoomsActive = false,
  isDMActive = false,
  isCommunitiesActive = false,
  isGameActive = false,
  hideHomeFab = false,
}: BottomNavProps) => {
  return (
    <View style={styles.bar}>
      <NavButton label="Rooms" icon="chatbubble-outline" onPress={onRoomsClick} active={isRoomsActive} />
      <NavButton label="DM" icon="send-outline" onPress={onDMClick} badge={dmBadgeCount} active={isDMActive} />
      <HomeActionButton
        isHomeActive={isHomeActive}
        sheetOpen={quickActionsOpen}
        onPress={onHomeActionClick || onHomeClick}
        badge={homeActionBadge}
        hidden={hideHomeFab}
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
  fabBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#ef4444', // star-danger-500
    borderWidth: 2,
    borderColor: '#000',
  },
});

export default memo(BottomNav);