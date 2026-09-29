import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BluffCard from './BluffCard';
import BluffGunDuel, { type BluffDuelResult } from './BluffGunDuel';
import { sigilById, DOOM_LABEL, type SigilId } from '../theme/bluffTheme';

export interface BluffRevealResult extends BluffDuelResult {
  cards: SigilId[];
  callSigilId: SigilId | null;
  wasTruthful: boolean;
  loserName?: string;
  accuserName?: string;
  prevPlayerName?: string;
}

// Challenge resolve hone par: cards reveal, verdict (truthful/bluff), aur
// galat bolne wale ke saath gun-duel animation. Server hi verdict decide
// karta hai - yahan sirf presentation.
const BluffRevealPanel = ({ result }: { result: BluffRevealResult | null }) => {
  if (!result) return null;
  const { cards, callSigilId, wasTruthful, loserName, accuserName, prevPlayerName, eliminated } = result;
  const call = sigilById(callSigilId);

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Cards Revealed</Text>

        <View style={styles.cardsRow}>
          {cards.map((sigilId, i) => (
            <BluffCard key={i} sigilId={sigilId} revealed faceUp size="md" />
          ))}
        </View>

        <Text style={styles.callText}>
          Call was <Text style={[styles.callName, { color: call?.color }]}>{call?.name}</Text>
        </Text>

        <Text style={[styles.verdict, wasTruthful ? styles.verdictTrue : styles.verdictFalse]}>
          {wasTruthful ? 'Truthful Play' : 'Caught Bluffing'}
        </Text>

        <Text style={styles.subText}>
          {wasTruthful ? `${accuserName} called it wrong.` : `${prevPlayerName} was bluffing.`}
        </Text>

        <BluffGunDuel result={result} />

        <View style={[styles.chip, eliminated ? styles.chipDanger : styles.chipNeutral]}>
          <Text style={[styles.chipText, eliminated ? styles.chipTextDanger : styles.chipTextNeutral]}>
            {eliminated ? `${loserName} is eliminated 💀` : `${loserName} takes a ${DOOM_LABEL}`}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 10,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
  },
  eyebrow: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: '#9a9a9a', marginBottom: 8 },
  cardsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  callText: { fontSize: 12, color: '#9a9a9a', marginBottom: 4 },
  callName: { fontWeight: '700' },
  verdict: { fontSize: 18, fontWeight: '800' },
  verdictTrue: { color: '#4ade80' },
  verdictFalse: { color: '#f87171' },
  subText: { fontSize: 12, color: '#c2c2c2', marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, marginTop: 4 },
  chipDanger: { backgroundColor: 'rgba(220,38,38,0.2)', borderColor: '#b91c1c' },
  chipNeutral: { backgroundColor: 'rgba(22,22,22,0.6)', borderColor: '#262626' },
  chipText: { fontSize: 12, fontWeight: '600' },
  chipTextDanger: { color: '#fca5a5' },
  chipTextNeutral: { color: '#c2c2c2' },
});

export default memo(BluffRevealPanel);
