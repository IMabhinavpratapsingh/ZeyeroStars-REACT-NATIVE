import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { FeedScope } from '../services/feedApi';

// Home feed ka source: poori duniya (Global) ya sirf meri joined communities.
const OPTIONS: { key: FeedScope; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'global', label: 'Global', icon: 'globe-outline' },
  { key: 'joined', label: 'Joined Communities', icon: 'people-outline' },
];

export default function FeedScopeToggle({
  scope,
  onChange,
}: {
  scope: FeedScope;
  onChange: (scope: FeedScope) => void;
}) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((o) => {
        const active = scope === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            hitSlop={6}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Ionicons name={o.icon} size={14} color={active ? '#000000' : '#a1a1aa'} />
            <Text style={[styles.label, active && styles.labelActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  pillActive: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  label: { color: '#a1a1aa', fontSize: 12, fontWeight: '700' },
  labelActive: { color: '#000000' },
});