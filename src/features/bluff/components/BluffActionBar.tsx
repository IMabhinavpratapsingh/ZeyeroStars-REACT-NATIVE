import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ACCUSE_LABEL, ACCEPT_LABEL } from '../theme/bluffTheme';

// Jab previous player ne cards khela ho aur ab tumhari turn ho, tumhare
// paas do raaste hain: ACCUSE (challenge karo) ya apne cards khel kar
// implicitly accept kar do (BluffHandTray se). Ye bar sirf ACCUSE ka
// prominent button dikhata hai aur ek chhota reminder.
interface BluffActionBarProps {
  visible: boolean;
  prevPlayerName?: string;
  prevPlayCount?: number;
  onAccuse: () => void;
}

const BluffActionBar = ({ visible, prevPlayerName, prevPlayCount = 0, onAccuse }: BluffActionBarProps) => {
  if (!visible) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.text}>
          <Text style={styles.bold}>{prevPlayerName}</Text> played{' '}
          <Text style={styles.bold}>{prevPlayCount}</Text> card{prevPlayCount > 1 ? 's' : ''}.{'\n'}
          Trust them, or call it out?
        </Text>
        <Pressable onPress={onAccuse} style={styles.button}>
          <Ionicons name="warning-outline" size={14} color="#fff" />
          <Text style={styles.buttonText}>{ACCUSE_LABEL}</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>{ACCEPT_LABEL}: just play your own cards below</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 8 },
  row: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262626',
    backgroundColor: 'rgba(10,10,10,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  text: { flex: 1, fontSize: 11, color: '#c2c2c2', lineHeight: 16 },
  bold: { fontWeight: '700', color: '#fff' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#dc2626',
  },
  buttonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  hint: { textAlign: 'center', fontSize: 10, color: '#3f3f3f', marginTop: 4 },
});

export default memo(BluffActionBar);
