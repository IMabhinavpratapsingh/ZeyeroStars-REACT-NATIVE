import React, { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import BluffCard from './BluffCard';
import BluffGunDuel, { type BluffDuelResult } from './BluffGunDuel';
import AvatarLayers from '../../avatar/components/AvatarLayers';
import { sigilById, DOOM_LABEL, type SigilId } from '../theme/bluffTheme';

export interface BluffRevealResult extends BluffDuelResult {
  cards: SigilId[];
  callSigilId: SigilId | null;
  wasTruthful: boolean;
  loserName?: string;
  accuserName?: string;
  prevPlayerName?: string;
  /** jis player ke cards accuse hue (bluff ho ya sach) - avatar card ke liye */
  prevAvatar?: { equippedByCategory?: any; photoUrl?: string | null };
  accuserIsSelf?: boolean;
  loserIsSelf?: boolean;
  prevIsSelf?: boolean;
}

// Colour themes - bluff pakda gaya = red, galat accuse = green.
const THEME = {
  bluff: { main: '#ef4444', soft: '#f87171', deep: '#7f1d1d', border: '#dc2626', bg: ['#2a0a12', '#12060b'] as const },
  truth: { main: '#22c55e', soft: '#4ade80', deep: '#14532d', border: '#16a34a', bg: ['#07230f', '#050f08'] as const },
};

const joinNames = (ids: string[]) => {
  const names = ids.map((id) => sigilById(id)?.name || id);
  if (names.length <= 1) return names[0] || '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
};

const Shards = ({ color }: { color: string }) => (
  <Svg style={StyleSheet.absoluteFill} pointerEvents="none" viewBox="0 0 100 100" preserveAspectRatio="none">
    <Polygon points="2,12 9,6 7,20" fill={color} opacity={0.22} />
    <Polygon points="94,30 99,22 98,38" fill={color} opacity={0.2} />
    <Polygon points="4,70 12,62 10,80" fill={color} opacity={0.16} />
    <Polygon points="90,82 97,74 96,92" fill={color} opacity={0.16} />
  </Svg>
);

// Challenge resolve hone par: "CAUGHT BLUFFING!" / "NOT BLUFFING!" panel -
// accused player ka avatar card, verdict text, actual cards, phir gun-duel.
// Server hi verdict decide karta hai - yahan sirf presentation.
const BluffRevealPanel = ({ result }: { result: BluffRevealResult | null }) => {
  const enter = useSharedValue(0);
  const slam = useSharedValue(0);
  const shake = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!result) return;
    enter.value = 0;
    slam.value = 0;
    shake.value = 0;
    enter.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    slam.value = withDelay(120, withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }));
    shake.value = withDelay(
      360,
      withSequence(
        withTiming(-4, { duration: 50 }),
        withTiming(4, { duration: 50 }),
        withTiming(-3, { duration: 50 }),
        withTiming(0, { duration: 50 })
      )
    );
    pulse.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [result, enter, slam, shake, pulse]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ scale: 0.94 + 0.06 * enter.value }, { translateX: shake.value }],
  }));
  const bannerStyle = useAnimatedStyle(() => ({
    opacity: slam.value,
    transform: [{ scale: 1.35 - 0.35 * slam.value }, { rotate: '-2deg' }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.25 + 0.55 * pulse.value }));

  if (!result) return null;
  const {
    cards, callSigilId, wasTruthful, loserName, accuserName, prevPlayerName, eliminated,
    prevAvatar, accuserIsSelf, loserIsSelf, prevIsSelf,
  } = result;
  const call = sigilById(callSigilId);
  const t = wasTruthful ? THEME.truth : THEME.bluff;

  const wrongIds = Array.from(new Set(cards.filter((c) => c !== callSigilId && c !== 'wild')));
  const accusedName = prevIsSelf ? 'You' : prevPlayerName || 'Player';
  const eyebrow = wasTruthful
    ? accuserIsSelf ? 'YOU ACCUSED' : `${(accuserName || 'PLAYER').toUpperCase()} ACCUSED`
    : accuserIsSelf ? 'YOU CAUGHT' : `${(accuserName || 'PLAYER').toUpperCase()} CAUGHT`;
  const verdictWord = wasTruthful ? 'Honest!' : 'Bluffing!';
  const who = prevIsSelf ? 'You' : 'They';
  const detail = wasTruthful
    ? `${who} really played ${call?.name || 'the call'}.`
    : `${who} claimed ${call?.name || '?'}, but had ${joinNames(wrongIds)}.`;
  const pillText = wasTruthful ? 'ACCUSE FAILED' : 'ACCUSE CONFIRMED';
  const tag = wasTruthful ? 'HONEST' : 'ACCUSED';

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.panel, { borderColor: t.border }, panelStyle]}>
        <LinearGradient colors={t.bg} style={StyleSheet.absoluteFill} />
        <Shards color={t.main} />
        <MaterialCommunityIcons name="pistol" size={110} color={t.main} style={styles.gunArt} />

        {/* Banner */}
        <Animated.View style={[styles.banner, { backgroundColor: t.deep, borderColor: t.main }, bannerStyle]}>
          <View style={[styles.bangCircle, { borderColor: t.soft }]}>
            <Text style={[styles.bang, { color: t.soft }]}>!</Text>
          </View>
          <Text style={styles.bannerText} numberOfLines={1} adjustsFontSizeToFit>
            {wasTruthful ? 'NOT ' : 'CAUGHT '}
            <Text style={{ color: t.soft }}>BLUFFING!</Text>
          </Text>
        </Animated.View>

        {/* Accused + verdict */}
        <View style={styles.row}>
          <View style={[styles.avatarCard, { borderColor: t.main }]}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.avatarGlow, { borderColor: t.soft }, glowStyle]} />
            <View style={StyleSheet.absoluteFill}>
              <AvatarLayers equippedByCategory={prevAvatar?.equippedByCategory} photoUrl={prevAvatar?.photoUrl} exactFit />
            </View>
            <View style={[styles.tag, { backgroundColor: t.border }]}>
              <MaterialCommunityIcons name="crown" size={10} color="#fde68a" />
              <Text style={styles.tagText}>{tag}</Text>
            </View>
            <View style={styles.avatarName}>
              <Text style={styles.avatarNameText} numberOfLines={1}>{accusedName}</Text>
            </View>
          </View>

          <View style={styles.right}>
            <View style={styles.verdictBox}>
              <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text>
              <Text style={styles.accusedName} numberOfLines={1} adjustsFontSizeToFit>{accusedName}</Text>
              <Text style={[styles.verdictWord, { color: t.main }]}>{verdictWord}</Text>
              <Text style={styles.detail}>{detail}</Text>
            </View>

            <View style={styles.cardsBox}>
              <Text style={styles.cardsLabel}>ACTUAL CARDS</Text>
              <View style={styles.cardsRow}>
                {cards.map((sigilId, i) => (
                  <BluffCard key={i} sigilId={sigilId} revealed faceUp size="md" />
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Outcome pill */}
        <View style={[styles.pill, { borderColor: t.main, backgroundColor: t.deep }]}>
          <Ionicons name="locate" size={20} color="#fff" />
          <Text style={styles.pillText}>{pillText}</Text>
        </View>

        <BluffGunDuel result={result} />

        <View style={[styles.chip, eliminated ? styles.chipDanger : styles.chipNeutral]}>
          <Text style={[styles.chipText, eliminated ? styles.chipTextDanger : styles.chipTextNeutral]}>
            {eliminated
              ? `${loserIsSelf ? 'You are' : `${loserName} is`} eliminated 💀`
              : `${loserIsSelf ? 'You take' : `${loserName} takes`} a ${DOOM_LABEL}`}
          </Text>
        </View>
        <Text style={styles.next}>The next turn begins...</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    zIndex: 10,
  },
  panel: {
    width: '100%',
    maxWidth: 380,
    borderWidth: 1.5,
    borderRadius: 18,
    padding: 12,
    paddingTop: 22,
    overflow: 'hidden',
  },
  gunArt: { position: 'absolute', right: -26, top: 70, opacity: 0.14, transform: [{ rotate: '-12deg' }] },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: 14,
    maxWidth: '100%',
  },
  bangCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bang: { fontSize: 16, fontWeight: '900', lineHeight: 18 },
  bannerText: { color: '#fff', fontSize: 24, fontWeight: '900', fontStyle: 'italic', letterSpacing: 0.5, flexShrink: 1 },
  row: { flexDirection: 'row', gap: 10 },
  avatarCard: {
    width: 104,
    height: 138,
    borderRadius: 14,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  avatarGlow: { borderWidth: 3, borderRadius: 14, zIndex: 2 },
  tag: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    zIndex: 3,
  },
  tagText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  avatarName: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 4, zIndex: 3 },
  avatarNameText: { color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  right: { flex: 1, gap: 8 },
  verdictBox: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  eyebrow: { color: '#a3a3a3', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  accusedName: { color: '#fff', fontSize: 20, fontWeight: '900', fontStyle: 'italic' },
  verdictWord: { fontSize: 15, fontWeight: '800', fontStyle: 'italic', marginTop: -2 },
  detail: { color: '#d4d4d4', fontSize: 11, marginTop: 3, lineHeight: 15 },
  cardsBox: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 6,
    alignItems: 'center',
  },
  cardsLabel: { color: '#a3a3a3', fontSize: 8, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  cardsRow: { flexDirection: 'row', gap: 5 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    marginTop: 12,
    paddingHorizontal: 26,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1.5,
  },
  pillText: { color: '#fff', fontSize: 16, fontWeight: '900', fontStyle: 'italic', letterSpacing: 0.5 },
  chip: { alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  chipDanger: { backgroundColor: 'rgba(220,38,38,0.2)', borderColor: '#b91c1c' },
  chipNeutral: { backgroundColor: 'rgba(22,22,22,0.6)', borderColor: '#262626' },
  chipText: { fontSize: 12, fontWeight: '600' },
  chipTextDanger: { color: '#fca5a5' },
  chipTextNeutral: { color: '#c2c2c2' },
  next: { color: '#9a9a9a', fontSize: 10, textAlign: 'center', marginTop: 6 },
});

export default memo(BluffRevealPanel);