import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, Polygon, Stop } from 'react-native-svg';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AvatarLayers, { type EquippedByCategory } from '../../avatar/components/AvatarLayers';
import { getRankStyle } from '../../../shared/utils/rankStyles';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import { AVATAR_ASPECT_RATIO_NUM } from '../../avatar/utils/avatarAssets';
import { FIELD } from '../../../shared/utils/profileFields';
import { getEquippedByCategory } from '../../../shared/utils/profileHelpers';
import useItemsCatalog from '../../../shared/hooks/useItemsCatalog';

const MAX_HP = 300;
const HP_SEGMENTS = 7;

// Side themes - opponent upar (red/fire), me neeche (blue/lightning).
const THEME = {
  opp: { main: '#ef4444', soft: '#fb7185', glow: 'rgba(239,68,68,0.55)', panel: ['#2a0b12', '#10060a'] as const, hp: ['#ef4444', '#fb7185'] as const },
  me: { main: '#38bdf8', soft: '#7dd3fc', glow: 'rgba(56,189,248,0.55)', panel: ['#07192b', '#050c18'] as const, hp: ['#06b6d4', '#38bdf8'] as const },
};

/* ---------------- Skill icon (name se guess - backend icon nahi bhejta) ---------------- */
type SkillMeta = { icon: string; color: string };
const SKILL_META_RULES: [RegExp, SkillMeta][] = [
  [/heal|restor|regen|cure|life/i, { icon: 'heart-plus', color: '#4ade80' }],
  [/shield|guard|block|barrier|ward|armor/i, { icon: 'shield', color: '#60a5fa' }],
  [/poison|venom|toxic|plague/i, { icon: 'skull', color: '#a78bfa' }],
  [/fire|flame|burn|inferno|blaze|ember/i, { icon: 'fire', color: '#fb923c' }],
  [/counter|reflect|parry|mirror/i, { icon: 'swap-horizontal', color: '#22d3ee' }],
  [/thunder|lightning|volt|shock|zap|storm/i, { icon: 'lightning-bolt', color: '#facc15' }],
  [/berserk|rage|fury|frenzy/i, { icon: 'sword-cross', color: '#38bdf8' }],
];
const skillMeta = (name?: string): SkillMeta =>
  SKILL_META_RULES.find(([re]) => re.test(name || ''))?.[1] || { icon: 'sword', color: '#f87171' };

/* ---------------- Chamfered (angled-corner) panel - SVG polygon background ---------------- */
const ChamferBox = ({
  colors, stroke, cut = 14, strokeWidth = 1.5, style, children,
}: {
  colors: readonly [string, string];
  stroke: string;
  cut?: number;
  strokeWidth?: number;
  style?: any;
  children?: React.ReactNode;
}) => {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width, h: height });
  };
  const { w, h } = size;
  const c = Math.min(cut, w / 2, h / 2);
  const pts = `${c},0 ${w - c},0 ${w},${c} ${w},${h - c} ${w - c},${h} ${c},${h} 0,${h - c} 0,${c}`;
  return (
    <View style={style} onLayout={onLayout}>
      {w > 0 && (
        <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <SvgGradient id="cg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors[0]} />
              <Stop offset="1" stopColor={colors[1]} />
            </SvgGradient>
          </Defs>
          <Polygon points={pts} fill="url(#cg)" stroke={stroke} strokeWidth={strokeWidth} />
        </Svg>
      )}
      {children}
    </View>
  );
};

/* ---------------- Segmented HP bar ---------------- */
const SegHpBar = ({ hp, side }: { hp: number; side: 'opp' | 'me' }) => {
  const t = THEME[side];
  const pct = Math.max(0, Math.min(1, hp / MAX_HP));
  const w = useSharedValue(pct);
  useEffect(() => {
    w.value = withTiming(pct, { duration: 450, easing: Easing.out(Easing.cubic) });
  }, [pct, w]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.hpTrack}>
      <Animated.View style={[styles.hpFillWrap, fillStyle]}>
        <LinearGradient colors={t.hp} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <View style={styles.hpDividers} pointerEvents="none">
        {Array.from({ length: HP_SEGMENTS - 1 }).map((_, i) => (
          <View key={i} style={styles.hpDivider} />
        ))}
      </View>
    </View>
  );
};

/* ---------------- Mini skill tile (player panel ke andar) ---------------- */
const MiniSkill = ({ skill, side, selected }: { skill: any; side: 'opp' | 'me'; selected?: boolean }) => {
  const meta = skillMeta(skill.name);
  const t = THEME[side];
  return (
    <View style={styles.miniWrap}>
      <View style={[styles.miniTile, { borderColor: selected ? t.soft : 'rgba(255,255,255,0.14)' }, selected && { backgroundColor: 'rgba(56,189,248,0.18)' }]}>
        <MaterialCommunityIcons name={meta.icon as any} size={17} color={meta.color} />
      </View>
      <Text style={[styles.miniName, selected && { color: '#fff' }]} numberOfLines={1}>{skill.name}</Text>
    </View>
  );
};

/* ---------------- Player row: avatar tile + info panel ---------------- */
const PlayerRow = ({
  profile, hp, skills, side, avatarW, selectedSkillId,
}: {
  profile: any;
  hp: number;
  skills: any[];
  side: 'opp' | 'me';
  avatarW: number;
  selectedSkillId?: string | number | null;
}) => {
  const t = THEME[side];
  const { itemsById } = useItemsCatalog();
  // Battle ko raw players row milti hai (`equipped_items` = sirf ids) - isliye
  // yahin category-wise map karte hain, taaki back/front/background/frame sab dikhein.
  const equippedByCategory: EquippedByCategory = useMemo(
    () => profile?.equippedByCategory || getEquippedByCategory(profile?.[FIELD.equipped], itemsById),
    [profile, itemsById]
  );
  const rankStyle = profile?.rank != null ? getRankStyle(profile.rank) : null;
  // Room jaisa hi: canvas apne asli 350x250 shape mein (exactFit + aspectRatio),
  // pfp canvas ke andar khud round hoti hai (AvatarBase ka photo circle).

  return (
    <View style={styles.playerRow}>
      <View style={[styles.avatarTile, { width: avatarW, aspectRatio: AVATAR_ASPECT_RATIO_NUM, shadowColor: t.main }]}>
        <AvatarLayers equippedByCategory={equippedByCategory} photoUrl={profile?.avatar_url} exactFit />
        {/* Outline - canvas ke upar overlay (layout/aspect ratio nahi badalta) */}
        <View pointerEvents="none" style={[styles.avatarOutline, { borderColor: t.main }]} />
        <View pointerEvents="none" style={[styles.avatarOutlineInner, { borderColor: t.soft }]} />
      </View>

      <ChamferBox colors={t.panel} stroke={t.main} cut={16} style={styles.infoPanel}>
        <View style={styles.infoInner}>
          <View style={styles.nameRow}>
            <Text style={[styles.username, side === 'opp' && { color: '#f5d0fe' }]} numberOfLines={1}>
              {profile?.username || '...'}
            </Text>
            {profile?.power != null && (
              <View style={styles.pwrPill}>
                <Text style={styles.pwrLabel}>PWR</Text>
                <Text style={styles.pwrValue}>{profile.power}</Text>
              </View>
            )}
          </View>

          {rankStyle && (
            <View style={[styles.rankPill, { borderColor: rankStyle.color + '66' }]}>
              <MaterialCommunityIcons name="shield-star" size={14} color={rankStyle.color} />
              <Text style={[styles.rankText, { color: rankStyle.color }]}>
                {rankStyle.tierName.toUpperCase()} {profile.rank}
              </Text>
            </View>
          )}

          <View style={styles.miniRow}>
            {(skills || []).slice(0, 3).map((sk) => (
              <MiniSkill key={sk.skill_id} skill={sk} side={side} selected={side === 'me' && selectedSkillId === sk.skill_id} />
            ))}
          </View>

          <View style={styles.hpRow}>
            <View style={{ flex: 1 }}>
              <SegHpBar hp={hp} side={side} />
            </View>
            <Text style={styles.hpText}>{Math.max(0, hp)} / {MAX_HP} HP</Text>
          </View>
        </View>
      </ChamferBox>
    </View>
  );
};

/* ---------------- Big skill card (neeche dock mein) ---------------- */
const SkillCard = ({
  skill, selected, locked, roundsLeft, disabled, onPress,
}: {
  skill: any; selected: boolean; locked: boolean; roundsLeft?: number; disabled: boolean; onPress: () => void;
}) => {
  const meta = skillMeta(skill.name);
  const lift = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    lift.value = withTiming(selected ? 1 : 0, { duration: 160, easing: Easing.out(Easing.cubic) });
  }, [selected, lift]);
  const liftStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * lift.value }, { scale: 1 + 0.03 * lift.value }] }));

  return (
    <Animated.View style={[styles.skillCardWrap, liftStyle]}>
      {selected && !locked && (
        <View style={styles.selectedTag}>
          <Text style={styles.selectedTagText}>SELECTED</Text>
        </View>
      )}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[
          styles.skillCard,
          { borderColor: selected && !locked ? '#7dd3fc' : meta.color + '77', backgroundColor: meta.color + '14' },
          selected && !locked && styles.skillCardSelected,
          locked && { opacity: 0.4 },
        ]}
      >
        <View style={[styles.skillIconRing, { borderColor: meta.color + 'aa' }]}>
          <MaterialCommunityIcons name={meta.icon as any} size={34} color={meta.color} />
        </View>
        <Text style={styles.skillCardName} numberOfLines={1}>{skill.name}</Text>
        <View style={styles.cdPill}>
          {locked ? (
            <>
              <Ionicons name="lock-closed" size={10} color="#f87171" />
              <Text style={[styles.cdText, { color: '#f87171' }]}>{roundsLeft}</Text>
            </>
          ) : (
            <>
              <Ionicons name="timer-outline" size={11} color="#7dd3fc" />
              <Text style={styles.cdText}>{skill.cooldown ? `CD ${skill.cooldown}` : 'READY'}</Text>
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
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
  const { height: winH, width: winW } = useWindowDimensions();
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

  // Timer <= 5s: pulse
  const pulse = useSharedValue(0);
  const danger = phase === 'selecting' && timeLeft <= 5;
  useEffect(() => {
    if (danger) {
      pulse.value = withRepeat(withTiming(1, { duration: 450, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      pulse.value = withTiming(0, { duration: 150 });
    }
  }, [danger, pulse]);
  const timerPulse = useAnimatedStyle(() => ({ opacity: 1 - 0.35 * pulse.value }));

  const handleChangeSkill = (skillId: string | number) => {
    if (phase !== 'selecting' || hasSubmittedRef.current) return;
    selectedSkillRef.current = skillId;
    setSelectedSkillId(skillId);
  };

  useBackButtonHandler(show, () => {});

  if (!show) return null;

  const selectable = phase === 'selecting' && !hasSubmittedRef.current;
  const cooldowns = mySkillCooldowns || {};
  const selectedSkill = (mySkillData || []).find((s) => s.skill_id === selectedSkillId);

  // Avatar tile ka size screen height se - chhote phones par rows compress hon.
  const rowH = (winH - insets.top - insets.bottom - 330) / 2;
  const avatarW = Math.max(110, Math.min(winW * 0.4, rowH * AVATAR_ASPECT_RATIO_NUM, 170));

  let statusMain = 'Your turn';
  let statusSub = 'Select a skill';
  if (phase === 'locked' || hasSubmittedRef.current) { statusMain = 'Locked in'; statusSub = 'Waiting for opponent...'; }
  if (phase === 'round_over') { statusMain = 'Time\'s up'; statusSub = 'Calculating result...'; }
  if (phase === 'result') { statusMain = 'Round over'; statusSub = 'Next round soon'; }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* Arena background */}
      <LinearGradient colors={['#05060f', '#0a0b1c', '#05060f']} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={['rgba(239,68,68,0.16)', 'transparent']} style={styles.bgTop} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(56,189,248,0.16)']} style={styles.bgBottom} pointerEvents="none" />
      <Svg width={winW} height={winH} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Ellipse cx={winW / 2} cy={winH * 0.5} rx={winW * 0.46} ry={winH * 0.075} stroke="rgba(125,211,252,0.18)" strokeWidth={1.5} fill="none" />
        <Ellipse cx={winW / 2} cy={winH * 0.5} rx={winW * 0.3} ry={winH * 0.048} stroke="rgba(125,211,252,0.12)" strokeWidth={1} fill="none" />
      </Svg>

      {/* Timer chip */}
      <View style={styles.timerWrap}>
        <ChamferBox colors={['#1a0d14', '#0c0710']} stroke={danger ? '#ef4444' : '#7f1d1d'} cut={14} strokeWidth={2} style={styles.timerChip}>
          <View style={styles.timerInner}>
            <View style={styles.timerTitleRow}>
              <Ionicons name="flash" size={11} color="#9a9a9a" />
              <Text style={styles.timerTitle}>BATTLE</Text>
            </View>
            {phase === 'selecting' ? (
              <Animated.Text style={[styles.timerValue, danger && { color: '#f87171' }, timerPulse]}>{timeLeft}s</Animated.Text>
            ) : (
              <Text style={styles.timerNote} numberOfLines={1}>{statusSub}</Text>
            )}
          </View>
        </ChamferBox>
      </View>

      {/* Opponent */}
      <View style={styles.rowSlot}>
        <PlayerRow profile={opponentProfile} hp={opponentHp} skills={opponentSkillData} side="opp" avatarW={avatarW} />
      </View>

      {/* VS */}
      <View style={styles.vsWrap}>
        <Text style={styles.vsText}>
          <Text style={{ color: '#fb7185' }}>V</Text>
          <Text style={{ color: '#7dd3fc' }}>S</Text>
        </Text>
      </View>

      {/* Me */}
      <View style={styles.rowSlot}>
        <PlayerRow profile={myProfile} hp={myHp} skills={mySkillData} side="me" avatarW={avatarW} selectedSkillId={selectedSkillId} />
      </View>

      {/* Skill dock */}
      <ChamferBox colors={['#0a1226', '#060913']} stroke="#1e3a5f" cut={22} style={styles.dock}>
        <View style={styles.dockInner}>
          <View style={styles.skillCardsRow}>
            {(mySkillData || []).slice(0, 3).map((s) => (
              <SkillCard
                key={s.skill_id}
                skill={s}
                selected={selectedSkillId === s.skill_id}
                locked={!!cooldowns[s.skill_id]}
                roundsLeft={cooldowns[s.skill_id]}
                disabled={!selectable || !!cooldowns[s.skill_id]}
                onPress={() => handleChangeSkill(s.skill_id)}
              />
            ))}
          </View>
          {!!selectedSkill?.description && (
            <Text style={styles.skillDesc} numberOfLines={2}>
              {hasSubmittedRef.current ? 'Locked In: ' : ''}
              <Text style={styles.skillDescBold}>{selectedSkill.name}</Text> — {selectedSkill.description}
            </Text>
          )}
        </View>
      </ChamferBox>

      {/* Status pill */}
      <ChamferBox colors={['#0c1a30', '#08101e']} stroke="#38bdf8" cut={12} style={styles.statusPill}>
        <View style={styles.statusInner}>
          <MaterialCommunityIcons name="rhombus-split" size={14} color="#38bdf8" />
          <Text style={styles.statusMain}>{statusMain}</Text>
          <Text style={styles.statusDot}>•</Text>
          <Text style={styles.statusSub}>{statusSub}</Text>
        </View>
      </ChamferBox>

      {danger && !hasSubmittedRef.current && (
        <Text style={styles.timeoutWarning}>Time khatam hone par current selected skill hi submit ho jayegi!</Text>
      )}

      {phase === 'result' && <RoundResultPanel roundResult={roundResult} />}

      {phase === 'ended' && (
        <MatchEndModal matchEndData={matchEndData} myUsername={myProfile?.username} onClose={onClose} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#05060f' },
  bgTop: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%' },
  bgBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '45%' },
  timerWrap: { alignItems: 'center', marginTop: 4 },
  timerChip: { minWidth: 120, height: 54 },
  timerInner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  timerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 2, color: '#9a9a9a' },
  timerValue: { fontSize: 24, fontWeight: '900', color: '#fb7185', marginTop: -2 },
  timerNote: { fontSize: 10, color: '#c2c2c2', marginTop: 2, maxWidth: 150 },
  rowSlot: { flex: 1, minHeight: 0, justifyContent: 'center', paddingHorizontal: 10 },
  playerRow: { flexDirection: 'row', alignItems: 'center' },
  avatarTile: { shadowOpacity: 0.75, shadowRadius: 14, elevation: 0, zIndex: 2 },
  avatarOutline: { ...StyleSheet.absoluteFill, borderWidth: 2.5, borderRadius: 14 },
  avatarOutlineInner: { ...StyleSheet.absoluteFill, margin: 3, borderWidth: 1, borderRadius: 11, opacity: 0.35 },
  infoPanel: { flex: 1, marginLeft: -12, minHeight: 112 },
  infoInner: { paddingLeft: 22, paddingRight: 12, paddingVertical: 8, gap: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  username: { flex: 1, fontSize: 16, fontWeight: '800', color: '#fff' },
  pwrPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 2,
    borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  pwrLabel: { fontSize: 9, color: '#9a9a9a', fontWeight: '700' },
  pwrValue: { fontSize: 12, color: '#fff', fontWeight: '800' },
  rankPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.35)',
  },
  rankText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  miniRow: { flexDirection: 'row', gap: 8 },
  miniWrap: { alignItems: 'center', width: 52 },
  miniTile: {
    width: 38, height: 34, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  miniName: { fontSize: 9, color: '#b5b5b5', marginTop: 2, fontWeight: '600' },
  hpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 1 },
  hpTrack: {
    height: 11, borderRadius: 6, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.6)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  hpFillWrap: { height: '100%', borderRadius: 6, overflow: 'hidden' },
  hpDividers: { ...StyleSheet.absoluteFill, flexDirection: 'row', justifyContent: 'space-evenly' },
  hpDivider: { width: 2, height: '100%', backgroundColor: 'rgba(0,0,0,0.7)' },
  hpText: { fontSize: 10, color: '#d4d4d4', fontWeight: '700' },
  vsWrap: { alignItems: 'center', justifyContent: 'center', height: 44 },
  vsText: {
    fontSize: 40, fontWeight: '900', fontStyle: 'italic', letterSpacing: 2,
    textShadowColor: 'rgba(168,85,247,0.8)', textShadowRadius: 14, textShadowOffset: { width: 0, height: 0 },
  },
  dock: { marginHorizontal: 10, marginTop: 4 },
  dockInner: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 10 },
  skillCardsRow: { flexDirection: 'row', gap: 8 },
  skillCardWrap: { flex: 1 },
  selectedTag: {
    position: 'absolute', top: -11, alignSelf: 'center', zIndex: 5, paddingHorizontal: 12, paddingVertical: 1,
    borderRadius: 4, backgroundColor: '#0b2a4a', borderWidth: 1, borderColor: '#38bdf8',
  },
  selectedTagText: { fontSize: 8, fontWeight: '800', letterSpacing: 1, color: '#7dd3fc' },
  skillCard: {
    alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12, borderWidth: 1.5, gap: 4,
  },
  skillCardSelected: { backgroundColor: 'rgba(56,189,248,0.16)', shadowColor: '#38bdf8', shadowOpacity: 0.8, shadowRadius: 10, elevation: 8 },
  skillIconRing: {
    width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  skillCardName: { fontSize: 13, fontWeight: '800', color: '#fff' },
  cdPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 12, paddingVertical: 2,
    borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  cdText: { fontSize: 11, fontWeight: '800', color: '#7dd3fc' },
  skillDesc: { fontSize: 10, color: '#9a9a9a', textAlign: 'center', marginTop: 8, lineHeight: 14 },
  skillDescBold: { fontWeight: '700', color: '#c2c2c2' },
  statusPill: { alignSelf: 'center', marginTop: 6, minWidth: 220, height: 34 },
  statusInner: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 18 },
  statusMain: { fontSize: 12, fontWeight: '800', color: '#fff' },
  statusDot: { fontSize: 12, color: '#6e6e6e' },
  statusSub: { fontSize: 11, color: '#9a9a9a' },
  timeoutWarning: { textAlign: 'center', fontSize: 10, color: '#f87171', marginTop: 4 },
  effectRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  effectText: { fontSize: 11 },
  effectValue: { fontSize: 11, fontWeight: '700' },
  effectTarget: { fontSize: 11, color: '#6e6e6e' },
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