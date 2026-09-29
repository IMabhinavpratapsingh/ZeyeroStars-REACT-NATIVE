import React, { memo, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { BOTTOM_NAV_PX } from '../../../shared/constants/layout';

// BottomNav ke "Game" button se khulta hai - full-screen mode-select list
// (Rooms full-screen jaisa hi pattern). Matchmaking (searching) isi screen
// ke andar chalti hai - header ke neeche ek search-bar jaisi pill dikhti
// hai jisme live timer + Cancel button hota hai; jab tak searching chal
// rahi hai screen close nahi ho sakti (back button + X dono disabled).
const GAME_MODES = [
  {
    key: 'chess',
    icon: 'grid-outline',
    title: 'Chess',
    description: 'Offline vs Bot, online coming soon',
    tagIcon: 'person-outline',
    tag: '1 Player',
    accent: '#fb923c',
    highlighted: true,
  },
  {
    key: 'ranked',
    icon: 'trophy-outline',
    title: 'Skill Battle (Ranked)',
    description: 'Climb the ranks and prove your skills',
    tagIcon: 'people-outline',
    tag: '1v1 / Ranked',
    accent: '#eab308',
  },
  {
    key: 'unranked',
    icon: 'shield-outline',
    title: 'Skill Battle (Unranked)',
    description: 'Just for fun, no rank change',
    tagIcon: 'people-outline',
    tag: '1v1 / Casual',
    accent: '#60a5fa',
  },
  {
    key: 'bluff',
    icon: 'eye-off-outline',
    title: 'Bluff Court (Unranked)',
    description: '4-player online, just for fun',
    tagIcon: 'people-outline',
    tag: '4 Players',
    accent: '#a78bfa',
  },
] as const;

interface BattleGameSelectModalProps {
  show: boolean;
  onClose: () => void;
  onSelectChess: () => void;
  onSelectRanked: () => void;
  onSelectUnranked: () => void;
  onSelectBluff: () => void;
  matchmakingSearching: boolean;
  onCancelMatchmaking: () => void;
}

const BattleGameSelectModal = ({
  show,
  onClose,
  onSelectChess,
  onSelectRanked,
  onSelectUnranked,
  onSelectBluff,
  matchmakingSearching,
  onCancelMatchmaking,
}: BattleGameSelectModalProps) => {
  const __z = useTopZIndex(show);
  const [elapsed, setElapsed] = useState(0);

  useBackButtonHandler(show && !matchmakingSearching, onClose);

  useEffect(() => {
    if (!matchmakingSearching) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [matchmakingSearching]);

  if (!show) return null;

  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');

  const handlers: Record<string, () => void> = {
    chess: onSelectChess,
    ranked: onSelectRanked,
    unranked: onSelectUnranked,
    bluff: onSelectBluff,
  };

  return (
    <View style={[styles.container, { zIndex: __z }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerIconBox}>
            <Ionicons name="game-controller" size={24} color="#fb923c" />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Game</Text>
            <Text style={styles.headerSub}>Choose your game mode and play with others</Text>
          </View>
          {!matchmakingSearching && (
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#9a9a9a" />
            </Pressable>
          )}
        </View>

        {matchmakingSearching && (
          <View style={styles.searchPill}>
            <Ionicons name="search-outline" size={16} color="#9a9a9a" />
            <View style={styles.spinnerRing} />
            <View style={styles.searchTextCol}>
              <Text style={styles.searchTitle}>Finding opponent...</Text>
              <Text style={styles.searchTimer}>{mins}:{secs}</Text>
            </View>
            <Pressable onPress={onCancelMatchmaking} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.body}>
        {GAME_MODES.map((mode) => (
          <Pressable
            key={mode.key}
            onPress={handlers[mode.key]}
            disabled={matchmakingSearching}
            style={[
              styles.modeCard,
              { borderColor: (mode as { highlighted?: boolean }).highlighted ? mode.accent : '#262626' },
              matchmakingSearching && styles.modeCardDisabled,
            ]}
          >
            <View style={[styles.modeIconBox, { backgroundColor: `${mode.accent}1a`, borderColor: `${mode.accent}80` }]}>
              <Ionicons name={mode.icon as any} size={26} color={mode.accent} />
            </View>
            <View style={styles.modeTextCol}>
              <Text style={styles.modeTitle}>{mode.title}</Text>
              <Text style={styles.modeDescription}>{mode.description}</Text>
              <View style={styles.modeTagChip}>
                <Ionicons name={mode.tagIcon as any} size={13} color="#c2c2c2" />
                <Text style={styles.modeTagText}>{mode.tag}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color={mode.accent} />
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: BOTTOM_NAV_PX, backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#161616' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerIconBox: {
    width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(251,146,60,0.1)',
    borderWidth: 1, borderColor: 'rgba(251,146,60,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  headerTextWrap: { flex: 1, paddingTop: 2 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 12, color: '#9a9a9a', marginTop: 2 },
  closeBtn: { padding: 8, borderRadius: 999 },
  searchPill: {
    marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626',
    borderRadius: 999, paddingLeft: 14, paddingRight: 6, paddingVertical: 6,
  },
  spinnerRing: {
    width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: '#262626', borderTopColor: '#dc2626',
  },
  searchTextCol: { flex: 1, minWidth: 0 },
  searchTitle: { fontSize: 12, fontWeight: '700', color: '#fff' },
  searchTimer: { fontSize: 11, color: '#9a9a9a' },
  cancelBtn: { backgroundColor: '#dc2626', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  cancelBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  body: { flex: 1, paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  modeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#0a0a0a', borderWidth: 1, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 16,
  },
  modeCardDisabled: { opacity: 0.4 },
  modeIconBox: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modeTextCol: { flex: 1, gap: 6, minWidth: 0 },
  modeTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  modeDescription: { fontSize: 12, color: '#9a9a9a' },
  modeTagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
    backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 2,
  },
  modeTagText: { fontSize: 11, fontWeight: '600', color: '#c2c2c2' },
});

export default memo(BattleGameSelectModal);