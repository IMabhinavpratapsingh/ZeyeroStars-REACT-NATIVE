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

// Home slot plain nav icon nahi - yeh khud "+" quick-actions FAB hai:
//   - Home/feed screen par ho aur sheet band ho  -> "+" (tap => sheet khulta hai)
//   - Home par ho aur sheet khuli ho              -> "×" (tap => sheet band hoti hai)
//   - Kisi aur screen (Rooms/DM/Shop/Game) par ho -> "×" (tap => seedha Home wapas aa jaate hain)
// Black background, white icon + white border - protruding (upar nikla
// hua) rounded-square button.
//
// WEB -> RN CHANGE:
// Web version yeh button `createPortal(document.body)` se mount karta
// tha + `useViewportKeyboard`'s `stableHeight` se manually "top" position
// calculate karta tha - sirf isliye ki Dashboard root ka `overflow-hidden`
// (WebView mein) fixed children ko clip kar deta tha, AUR taaki Android
// keyboard resize se button upar na uchhal jaaye.
// RN mein dono wajah khatam ho jaati hain:
//   1. RN Views clip nahi karti jab tak khud `overflow: 'hidden'` na ho -
//      koi WebView-jaisा global clipping issue hai hi nahi.
//   2. Yeh button BottomNav ke andar hi (screen layout ka normal hissa)
//      render hota hai, `position: 'absolute'` se sirf nav-bar ke upar
//      protrude karta hai - `useViewportKeyboard`/portal ki zaroorat
//      nahi. (Jab room-chat jaisi screen mein keyboard khulta hai, woh
//      screen aam taur par apna khud ka nav-less full-screen view hota
//      hai, isliye BottomNav us waqt anyway mounted nahi hota.)
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

  return (
    <View style={styles.navButton}>
      <View style={styles.homeSpacer} />
      <Text style={styles.navLabel}>Home</Text>
      {!hidden && (
        <Pressable
          onPress={onPress}
          accessibilityLabel={showAsClose ? 'Close / go home' : 'Open quick actions'}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          {showAsClose ? <Ionicons name="close" size={20} color="#fff" /> : <Ionicons name="add" size={22} color="#fff" />}
          {badge ? <View style={styles.fabBadge} /> : null}
        </Pressable>
      )}
    </View>
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

const FAB_SIZE = 48;

const styles = StyleSheet.create({
  bar: {
    height: BOTTOM_NAV_PX,
    backgroundColor: '#141420', // star-900
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
  homeSpacer: {
    width: 44,
    height: 44,
    marginBottom: 2,
  },
  fab: {
    position: 'absolute',
    top: -(FAB_SIZE / 2 + 10), // nav-bar ke upar protrude
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: 16,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  fabPressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: '#141420', // star-900
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