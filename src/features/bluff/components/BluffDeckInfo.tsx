import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sigilById } from '../theme/bluffTheme';

// BluffDeckInfo - Liar's Bar jaisa counting helper. Is round ke deck mein
// kaun-kaun se sigils hain, aur har ek ke kitne cards ABHI TAK dikhe nahi
// (total copies - mere haath mein jitne hain). Server `deck` payload bhejta
// hai: { sigils, copiesPerSigil, wild, total, hidden }.

interface Props {
  deck?: {
    sigils: string[];
    copiesPerSigil: number;
    wild: number;
    total: number;
    hidden: number;
  } | null;
  hand?: (string | null)[];
  callSigilId?: string | null;
}

const BluffDeckInfo = ({ deck, hand = [], callSigilId }: Props) => {
  if (!deck || !deck.sigils?.length) return null;

  const mine = (id: string) => hand.filter((c) => c === id).length;
  const items = [
    ...deck.sigils.map((id) => ({ id, unseen: Math.max(0, deck.copiesPerSigil - mine(id)) })),
    ...(deck.wild > 0 ? [{ id: 'wild', unseen: Math.max(0, deck.wild - mine('wild')) }] : []),
  ];

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {items.map(({ id, unseen }) => {
          const s = sigilById(id);
          if (!s) return null;
          const isCall = id === callSigilId;
          return (
            <View key={id} style={[styles.pill, isCall && { borderColor: s.color }]}>
              <Ionicons name={s.icon as any} size={13} color={s.color} />
              <Text style={styles.count}>{unseen}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.sub}>
        Unseen cards (not in your hand){deck.hidden > 0 ? ` · ${deck.hidden} undealt` : ''}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginTop: 6 },
  row: { flexDirection: 'row', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  count: { color: '#e5e5e5', fontSize: 12, fontWeight: '700' },
  sub: { color: '#8a8a8a', fontSize: 10, marginTop: 3 },
});

export default memo(BluffDeckInfo);