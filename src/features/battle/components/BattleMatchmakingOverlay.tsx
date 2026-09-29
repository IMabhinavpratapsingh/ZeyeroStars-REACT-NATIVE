import React, { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * searching: matchmaking chal rahi hai kya
 * onCancel: cancel button dabane par
 *
 * BGMI/PUBG jaisa chhota floating widget jo screen ke top par baithta
 * hai. Baaki poori app (DM, rooms, feed) neeche normally usable rehti hai
 * jab tak match nahi milta.
 */
interface BattleMatchmakingOverlayProps {
  searching: boolean;
  onCancel: () => void;
}

const BattleMatchmakingOverlay = ({ searching, onCancel }: BattleMatchmakingOverlayProps) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!searching) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [searching]);

  if (!searching) return null;

  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.pill}>
        <View style={styles.spinnerRing} />

        <View style={styles.textCol}>
          <Text style={styles.title}>Finding opponent...</Text>
          <Text style={styles.timer}>{mins}:{secs}</Text>
        </View>

        <View style={styles.liveDot} />

        <Pressable onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center', zIndex: 160 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#262626',
    borderRadius: 999, paddingLeft: 10, paddingRight: 10, paddingVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, elevation: 10,
    maxWidth: '92%',
  },
  spinnerRing: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#262626', borderTopColor: '#dc2626' },
  textCol: { minWidth: 0 },
  title: { fontSize: 11, fontWeight: '700', color: '#fff' },
  timer: { fontSize: 10, color: '#9a9a9a' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  cancelBtn: { backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginLeft: 2 },
  cancelBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
});

export default memo(BattleMatchmakingOverlay);