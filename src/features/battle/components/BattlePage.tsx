import React, { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AvatarLayers, { type EquippedByCategory } from '../../avatar/components/AvatarLayers';
import RankBadge from '../../../shared/components/RankBadge';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import { AVATAR_ASPECT_RATIO_NUM } from '../../avatar/utils/avatarAssets';

const MAX_HP = 300;

const HpBar = ({ hp, size = 'sm' }: { hp: number; size?: 'sm' | 'lg' }) => {
  const pct = Math.max(0, Math.min(100, (hp / MAX_HP) * 100));
  const color = pct > 50 ? '#4ade80' : pct > 20 ? '#facc15' : '#ef4444';
  return (
    <View style={[styles.hpTrack, { height: size === 'lg' ? 12 : 8 }]}>
      <View style={[styles.hpFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
};

const StatPill = ({ label, value }: { label: string; value: number | string }) => (
  <View style={styles.statPill}>
    <Text style={styles.statPillLabel}>{label}</Text>
    <Text style={styles.statPillValue}>{value}</Text>
  </View>
);

/* ---------------- Player card - avatar full-bleed, overlays on top ---------------- */
const PlayerCard = ({
  profile,
  hp,
  borderColor,
  glow,
  children,
}: {
  profile: any;
  hp: number;
  borderColor: string;
  glow?: boolean;
  children?: React.ReactNode;
}) => {
  const equippedByCategory: EquippedByCategory = profile?.equippedByCategory || {};

  return (
    <View style={styles.cardOuter}>
      <View
        style={[
          styles.cardFrame,
          { borderColor },
          glow && styles.cardGlow,
          { aspectRatio: AVATAR_ASPECT_RATIO_NUM },
        ]}
      >
        <View style={styles.avatarPad}>
          <AvatarLayers equippedByCategory={equippedByCategory} photoUrl={profile?.avatar_url} exactFit />
        </View>

        <View style={styles.topOverlay}>
          <Text style={styles.username} numberOfLines={1}>{profile?.username || '...'}</Text>
          {profile?.power != null && <StatPill label="PWR" value={profile.power} />}
        </View>

        <View style={styles.bottomOverlay}>
          {profile?.rank != null && (
            <View style={styles.rankRow}>
              <RankBadge rank={profile.rank} size="sm" />
            </View>
          )}
          {children}
        </View>
      </View>

      <View style={styles.hpWrap}>
        <HpBar hp={hp} />
        <Text style={styles.hpText}>{Math.max(0, hp)} / {MAX_HP} HP</Text>
      </View>
    </View>
  );
};

const OpponentCard = ({ profile, hp, skills }: { profile: any; hp: number; skills: any[] }) => (
  <PlayerCard profile={profile} hp={hp} borderColor="#262626">
    <View style={styles.skillChipsRow}>
      {(skills || []).map((s) => (
        <View key={s.skill_id} style={styles.skillChip}>
          <Text style={styles.skillChipText}>{s.name}</Text>
        </View>
      ))}
    </View>
  </PlayerCard>
);

const MyCard = ({
  profile,
  hp,
  skills,
  selectable,
  selectedSkillId,
  onChangeSkill,
  submitted,
  skillCooldowns,
}: {
  profile: any;
  hp: number;
  skills: any[];
  selectable: boolean;
  selectedSkillId: string | number | null;
  onChangeSkill: (id: string | number) => void;
  submitted: boolean;
  skillCooldowns: Record<string, number>;
}) => {
  const selectedSkill = (skills || []).find((s) => s.skill_id === selectedSkillId);
  const cooldowns = skillCooldowns || {};

  const handlePick = (skillId: string | number) => {
    if (!selectable) return;
    if (cooldowns[skillId]) return;
    onChangeSkill(skillId);
  };

  return (
    <View style={styles.cardOuter}>
      <PlayerCard profile={profile} hp={hp} borderColor="rgba(96,165,250,0.6)" glow>
        <View style={styles.skillChipsRow}>
          {(skills || []).map((s) => (
            <View
              key={s.skill_id}
              style={[styles.skillChip, selectedSkillId === s.skill_id && styles.skillChipSelected]}
            >
              <Text style={[styles.skillChipText, selectedSkillId === s.skill_id && styles.skillChipTextSelected]}>
                {s.name}
              </Text>
            </View>
          ))}
        </View>
      </PlayerCard>

      <View style={styles.skillButtonsRow}>
        {(skills || []).slice(0, 3).map((s) => {
          const isSelected = selectedSkillId === s.skill_id;
          const roundsLeft = cooldowns[s.skill_id];
          const isLocked = !!roundsLeft;
          return (
            <Pressable
              key={s.skill_id}
              onPress={() => handlePick(s.skill_id)}
              disabled={!selectable || isLocked}
              style={[
                styles.skillButton,
                isLocked ? styles.skillButtonLocked : isSelected ? styles.skillButtonSelected : styles.skillButtonNormal,
              ]}
            >
              <Text
                style={[
                  styles.skillButtonText,
                  isLocked && styles.skillButtonTextLocked,
                  isSelected && !isLocked && styles.skillButtonTextSelected,
                ]}
                numberOfLines={1}
              >
                {s.name}
              </Text>
              {isLocked && (
                <View style={styles.lockRow}>
                  <Ionicons name="lock-closed" size={9} color="#f87171" />
                  <Text style={styles.lockText}>{roundsLeft}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {!!selectedSkill?.description && (
        <Text style={styles.selectedDescription}>
          {submitted ? 'Locked In: ' : 'Selected: '}
          <Text style={styles.selectedDescriptionBold}>{selectedSkill.name}</Text> — {selectedSkill.description}
        </Text>
      )}
    </View>
  );
};

/* ---------------- Effect line ---------------- */
const EFFECT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  damage: { icon: 'flash', color: '#f87171', label: 'Damage' },
  heal: { icon: 'pulse', color: '#4ade80', label: 'Heal' },
  shield: { icon: 'shield', color: '#60a5fa', label: 'Shield' },
  poison: { icon: 'skull', color: '#a78bfa', label: 'Poison' },
  self_damage: { icon: 'flame', color: '#fb923c', label: 'Recoil' },
  modify_stat: { icon: 'trending-down', color: '#facc15', label: 'Stat Change' },
  counter: { icon: 'refresh', color: '#22d3ee', label: 'Counter Stance' },
  counter_reflect: { icon: 'arrow-undo', color: '#ef4444', label: 'Reflected Damage' },
};
const NEGATIVE_TYPES = ['damage', 'self_damage', 'poison', 'counter_reflect'];

const EffectLine = ({ effect }: { effect: any }) => {
  if (!effect) return null;
  const config = EFFECT_CONFIG[effect.type] || { icon: 'sparkles', color: '#c2c2c2', label: effect.type };

  if (effect.type === 'modify_stat') {
    const sign = effect.value > 0 ? '+' : '';
    return (
      <View style={[styles.effectRow, { }]}>
        <Ionicons name={config.icon as any} size={12} color={config.color} />
        <Text style={[styles.effectText, { color: config.color }]}>{effect.stat || 'Stat'}</Text>
        <Text style={[styles.effectValue, { color: config.color }]}>{sign}{effect.value}</Text>
        {!!effect.target && <Text style={styles.effectTarget}>({effect.target})</Text>}
      </View>
    );
  }

  const sign = NEGATIVE_TYPES.includes(effect.type) ? '-' : '+';

  return (
    <View style={styles.effectRow}>
      <Ionicons name={config.icon as any} size={12} color={config.color} />
      <Text style={[styles.effectText, { color: config.color }]}>{config.label}</Text>
      <Text style={[styles.effectValue, { color: config.color }]}>{sign}{Math.abs(effect.value)}</Text>
      {!!effect.target && effect.target !== 'self' && <Text style={styles.effectTarget}>({effect.target})</Text>}
    </View>
  );
};

/* ---------------- Round result panel ---------------- */
const ActionLine = ({ label, action, effects }: { label: string; action: any; effects: any[] }) => (
  <View style={styles.actionLineBox}>
    <Text style={styles.actionLineLabel}>{label}</Text>
    <Text style={styles.actionLineName}>{action?.skill_name}</Text>

    <View style={styles.actionStatsRow}>
      {action?.damage > 0 && <Text style={styles.actionStatDamage}>-{action.damage} HP</Text>}
      {action?.heal > 0 && <Text style={styles.actionStatHeal}>+{action.heal} HP</Text>}
      {action?.shield > 0 && (
        <View style={styles.actionStatShieldRow}>
          <Ionicons name="shield" size={12} color="#60a5fa" />
          <Text style={styles.actionStatShield}>{action.shield}</Text>
        </View>
      )}
    </View>

    {effects && effects.length > 0 && (
      <View style={styles.effectsCol}>
        {effects.map((eff, idx) => (
          <EffectLine key={idx} effect={eff} />
        ))}
      </View>
    )}
  </View>
);

const RoundResultPanel = ({ roundResult }: { roundResult: any }) => {
  if (!roundResult) return null;
  const { my_action, opponent_action, round, my_effect, opponent_effect } = roundResult;

  return (
    <View style={styles.roundResultOverlay}>
      <View style={styles.roundResultCard}>
        <Text style={styles.roundResultTitle}>Round {round} Result</Text>
        <View style={styles.roundResultGrid}>
          <ActionLine label="You" action={my_action} effects={my_effect} />
          <ActionLine label="Opponent" action={opponent_action} effects={opponent_effect} />
        </View>
        <Text style={styles.roundResultNext}>Next round starting soon...</Text>
      </View>
    </View>
  );
};

const MatchEndModal = ({ matchEndData, myUsername, onClose }: { matchEndData: any; myUsername?: string; onClose: () => void }) => {
  if (!matchEndData) return null;
  const didIWin = matchEndData.winner_name === myUsername;

  return (
    <View style={styles.matchEndOverlay}>
      <View style={styles.matchEndCard}>
        <View style={styles.matchEndTitleRow}>
          {didIWin && <Ionicons name="trophy" size={28} color="#4ade80" />}
          <Text style={[styles.matchEndTitle, { color: didIWin ? '#4ade80' : '#f87171' }]}>
            {didIWin ? 'Victory!' : 'Defeat'}
          </Text>
        </View>
        <Text style={styles.matchEndLine}>Winner: <Text style={styles.matchEndBold}>{matchEndData.winner_name}</Text></Text>
        <Text style={styles.matchEndLine}>Loser: <Text style={styles.matchEndBold}>{matchEndData.loser_name}</Text></Text>
        {(matchEndData.winner_rank || matchEndData.loser_Rank) && (
          <View style={styles.matchEndRankRow}>
            <Text style={styles.matchEndRankText}>Winner Rank: <Text style={styles.matchEndBold}>{matchEndData.winner_rank}</Text></Text>
            <Text style={styles.matchEndRankText}>Loser Rank: <Text style={styles.matchEndBold}>{matchEndData.loser_Rank}</Text></Text>
          </View>
        )}
        <Text style={styles.matchEndReason}>Reason: {matchEndData.reason}</Text>
        <Pressable onPress={onClose} style={styles.matchEndCloseBtn}>
          <Text style={styles.matchEndCloseBtnText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
};

/* ---------------- Main battle screen ---------------- */
interface BattlePageProps {
  show: boolean;
  myProfile: any;
  opponentProfile: any;
  mySkillData: any[];
  opponentSkillData: any[];
  myHp: number;
  opponentHp: number;
  phase: string;
  selectionTime: number;
  roundKey: number;
  roundResult: any;
  matchEndData: any;
  mySkillCooldowns: Record<string, number>;
  onSubmitSkill: (skillId: string | number | null) => void;
  onClose: () => void;
}

const BattlePage = ({
  show,
  myProfile,
  opponentProfile,
  mySkillData,
  opponentSkillData,
  myHp,
  opponentHp,
  phase,
  selectionTime,
  roundKey,
  roundResult,
  matchEndData,
  mySkillCooldowns,
  onSubmitSkill,
  onClose,
}: BattlePageProps) => {
  const [timeLeft, setTimeLeft] = useState(selectionTime || 20);
  const insets = useSafeAreaInsets();
  const [selectedSkillId, setSelectedSkillId] = useState<string | number | null>(null);
  const hasSubmittedRef = useRef(false);
  const selectedSkillRef = useRef<string | number | null>(null);

  useEffect(() => {
    const initialTime = selectionTime || 20;
    const cooldowns = mySkillCooldowns || {};
    const firstAvailable = (mySkillData || []).find((s) => !cooldowns[s.skill_id]);
    const defaultSkillId = firstAvailable?.skill_id ?? mySkillData?.[0]?.skill_id ?? null;

    hasSubmittedRef.current = false;
    selectedSkillRef.current = defaultSkillId;
    setSelectedSkillId(defaultSkillId);
    setTimeLeft(initialTime);

    if (!show) return undefined;

    let cancelled = false;
    let remaining = initialTime;

    const interval = setInterval(() => {
      if (cancelled) return;
      remaining -= 1;
      setTimeLeft(Math.max(0, remaining));
    }, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey, selectionTime, show]);

  useEffect(() => {
    if (phase === 'round_over' && !hasSubmittedRef.current) {
      hasSubmittedRef.current = true;
      onSubmitSkill(selectedSkillRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleChangeSkill = (skillId: string | number) => {
    if (phase !== 'selecting' || hasSubmittedRef.current) return;
    selectedSkillRef.current = skillId;
    setSelectedSkillId(skillId);
  };

  useBackButtonHandler(show, () => {});

  if (!show) return null;

  const selectable = phase === 'selecting' && !hasSubmittedRef.current;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.timerBar}>
        <View style={styles.timerBarTitleRow}>
          <Ionicons name="flash-outline" size={12} color="#9a9a9a" />
          <Text style={styles.timerBarTitle}>BATTLE</Text>
        </View>
        {phase === 'selecting' && (
          <Text style={[styles.timerValue, timeLeft <= 5 && styles.timerValueDanger]}>{timeLeft}s</Text>
        )}
        {phase === 'locked' && <Text style={styles.timerNote}>Skill locked in, waiting for opponent...</Text>}
        {phase === 'round_over' && <Text style={styles.timerNote}>Time's up, calculating result...</Text>}
      </View>

      <View style={styles.opponentSection}>
        <OpponentCard profile={opponentProfile} hp={opponentHp} skills={opponentSkillData} />
      </View>

      <View style={styles.mySection}>
        <MyCard
          profile={myProfile}
          hp={myHp}
          skills={mySkillData}
          selectable={selectable}
          selectedSkillId={selectedSkillId}
          onChangeSkill={handleChangeSkill}
          submitted={hasSubmittedRef.current}
          skillCooldowns={mySkillCooldowns}
        />

        {!hasSubmittedRef.current && phase === 'selecting' && timeLeft <= 5 && (
          <Text style={styles.timeoutWarning}>
            Time khatam hone par apni current selected skill hi submit ho jayegi!
          </Text>
        )}
      </View>

      {phase === 'result' && <RoundResultPanel roundResult={roundResult} />}

      {phase === 'ended' && (
        <MatchEndModal matchEndData={matchEndData} myUsername={myProfile?.username} onClose={onClose} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#050505' },
  timerBar: {
    paddingVertical: 8, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: 'rgba(38,38,38,0.8)', backgroundColor: 'rgba(0,0,0,0.4)',
  },
  timerBarTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerBarTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 2, color: '#9a9a9a' },
  timerValue: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 2 },
  timerValueDanger: { color: '#f87171' },
  timerNote: { fontSize: 11, color: '#9a9a9a', marginTop: 4 },
  opponentSection: {
    flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center',
    borderBottomWidth: 1, borderBottomColor: 'rgba(38,38,38,0.6)', paddingHorizontal: 16, paddingVertical: 8,
  },
  mySection: { flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 12, paddingHorizontal: 16, paddingVertical: 8 },
  cardOuter: { width: '100%', maxWidth: 300, alignItems: 'center' },
  cardFrame: {
    width: '100%', borderRadius: 24, borderWidth: 2, overflow: 'hidden', backgroundColor: '#161616',
  },
  cardGlow: { shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 14, elevation: 6 },
  avatarPad: { ...StyleSheet.absoluteFill, padding: 10 },
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    paddingHorizontal: 10, paddingTop: 8, paddingBottom: 24,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  username: { fontWeight: '700', fontSize: 12, color: '#fff', maxWidth: '60%' },
  statPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.7)', borderWidth: 1, borderColor: '#262626',
  },
  statPillLabel: { fontSize: 10, color: '#9a9a9a' },
  statPillValue: { fontSize: 10, fontWeight: '700', color: '#fff' },
  bottomOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
    paddingHorizontal: 10, paddingTop: 30, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.85)',
  },
  rankRow: { alignItems: 'center', marginBottom: 6 },
  skillChipsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
  skillChip: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1, borderColor: '#3f3f3f',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  skillChipSelected: { borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.2)' },
  skillChipText: { fontSize: 10, color: '#e0e0e0' },
  skillChipTextSelected: { color: '#93c5fd' },
  hpWrap: { width: '100%', marginTop: 6, paddingHorizontal: 4 },
  hpTrack: { width: '100%', borderRadius: 999, backgroundColor: 'rgba(10,10,10,0.8)', borderWidth: 1, borderColor: '#262626', overflow: 'hidden' },
  hpFill: { height: '100%', borderRadius: 999 },
  hpText: { textAlign: 'center', fontSize: 10, color: '#6e6e6e', marginTop: 2 },
  skillButtonsRow: { flexDirection: 'row', gap: 8, marginTop: 12, width: '100%' },
  skillButton: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2,
    paddingHorizontal: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
  },
  skillButtonLocked: { opacity: 0.4, borderColor: '#262626', backgroundColor: 'rgba(0,0,0,0.6)' },
  skillButtonSelected: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.2)' },
  skillButtonNormal: { borderColor: '#262626', backgroundColor: 'rgba(10,10,10,0.7)' },
  skillButtonText: { fontSize: 11, fontWeight: '700', color: '#c2c2c2', textAlign: 'center' },
  skillButtonTextLocked: { color: '#6e6e6e' },
  skillButtonTextSelected: { color: '#fff' },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  lockText: { fontSize: 9, fontWeight: '700', color: '#f87171' },
  selectedDescription: { fontSize: 10, color: '#9a9a9a', marginTop: 8, textAlign: 'center', lineHeight: 14 },
  selectedDescriptionBold: { fontWeight: '700', color: '#c2c2c2' },
  effectRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  effectText: { fontSize: 11 },
  effectValue: { fontSize: 11, fontWeight: '700' },
  effectTarget: { fontSize: 11, color: '#6e6e6e' },
  timeoutWarning: { textAlign: 'center', fontSize: 11, color: '#f87171', marginTop: 8 },
  roundResultOverlay: {
    ...StyleSheet.absoluteFill, zIndex: 160, backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  roundResultCard: {
    width: '100%', maxWidth: 420, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#262626',
    borderRadius: 16, padding: 16,
  },
  roundResultTitle: { textAlign: 'center', fontSize: 13, color: '#9a9a9a', marginBottom: 12 },
  roundResultGrid: { flexDirection: 'row', gap: 12 },
  actionLineBox: { flex: 1, backgroundColor: '#161616', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#262626' },
  actionLineLabel: { fontSize: 11, color: '#9a9a9a', marginBottom: 4 },
  actionLineName: { fontWeight: '700', color: '#fff' },
  actionStatsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  actionStatDamage: { fontSize: 13, color: '#f87171' },
  actionStatHeal: { fontSize: 13, color: '#4ade80' },
  actionStatShieldRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionStatShield: { fontSize: 13, color: '#60a5fa' },
  effectsCol: { gap: 4, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(38,38,38,0.6)' },
  roundResultNext: { textAlign: 'center', fontSize: 11, color: '#6e6e6e', marginTop: 12 },
  matchEndOverlay: {
    ...StyleSheet.absoluteFill, zIndex: 170, backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  matchEndCard: {
    width: '100%', maxWidth: 360, backgroundColor: '#161616', borderRadius: 16,
    borderWidth: 1, borderColor: '#262626', padding: 24, alignItems: 'center',
  },
  matchEndTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  matchEndTitle: { fontSize: 26, fontWeight: '800' },
  matchEndLine: { color: '#c2c2c2', marginBottom: 4 },
  matchEndBold: { fontWeight: '700', color: '#fff' },
  matchEndRankRow: { flexDirection: 'row', gap: 24, marginTop: 8, marginBottom: 12 },
  matchEndRankText: { fontSize: 12, color: '#9a9a9a' },
  matchEndReason: { fontSize: 11, color: '#6e6e6e', marginBottom: 16 },
  matchEndCloseBtn: { backgroundColor: '#e0883a', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999 },
  matchEndCloseBtnText: { color: '#fff', fontWeight: '700' },
});

export default memo(BattlePage);