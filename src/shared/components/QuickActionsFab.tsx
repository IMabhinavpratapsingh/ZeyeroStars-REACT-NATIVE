import React, { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { requestOpenQuickActions } from '../utils/quickActionsBus';

/**
 * Feed list ka floating quick-actions trigger ("++" button jo maanga gaya
 * tha) - BottomNav ke Home button se poori tarah alag ho chuka hai (woh ab
 * sirf Home hai). Bottom-nav se UPAR, right side par float karta hai, aur
 * sirf feed list ke saath render hota hai - dashboard.tsx isse `showCreate`/
 * `openedPost` (Create Post / Post Detail modal) khule hote hi unmount kar
 * deta hai, isliye modal ke upar kabhi nahi dikhega.
 *
 * Tap karne par sirf `(tabs)/_layout.tsx` ke persistent QuickActionsSheet
 * ko khulwaane ka event bhejta hai (`quickActionsBus`) - sheet khud ek
 * full-screen RN `<Modal>` hai, isliye is button ke z-index/position se
 * uska render kahin bhi affect nahi hota.
 */
const QuickActionsFab = () => (
  <Pressable
    onPress={() => requestOpenQuickActions()}
    accessibilityLabel="Quick actions"
    style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
  >
    <Ionicons name="add" size={28} color="#ffffff" />
  </Pressable>
);

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16, // BottomNav dashboard.tsx ke apne container ke NEECHE, sibling hai - is 16px se theek upar float karta hai
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4f46e5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});

export default memo(QuickActionsFab);