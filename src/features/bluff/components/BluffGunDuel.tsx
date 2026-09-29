import React, { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import AvatarLayers, { type EquippedByCategory } from '../../avatar/components/AvatarLayers';

// BluffGunDuel - Reveal ke baad ka "Russian Roulette" cutscene, purely
// presentational (verdict already decided server-side, yahan sirf
// timing/animation). WEB -> RN: motion/react + CSS keyframes -> Reanimated
// shared values, emoji spans -> Animated.Text.

const STAGE_DELAYS = { accuse: 150, aim: 950, fire: 1550, result: 1900, bones: 2400 };
type Stage = 'idle' | 'accuse' | 'aim' | 'fire' | 'result' | 'bones' | 'skip';

interface DuelAvatar {
  equippedByCategory?: EquippedByCategory;
  photoUrl?: string | null;
}

export interface BluffDuelResult {
  accuserName?: string;
  loserName?: string;
  accuserAvatar?: DuelAvatar;
  loserAvatar?: DuelAvatar;
  eliminated?: boolean;
  chambersAfter?: number;
  chambersMax?: number;
}

const Tile = ({ avatar, label, name, danger, dim, children }: { avatar?: DuelAvatar; label: string; name?: string; danger?: boolean; dim?: boolean; children?: React.ReactNode }) => (
  <View style={[styles.tile, danger && styles.tileDanger, dim && styles.tileDim]}>
    <View style={StyleSheet.absoluteFill}>
      <AvatarLayers equippedByCategory={avatar?.equippedByCategory} photoUrl={avatar?.photoUrl} exactFit />
    </View>
    <View style={styles.tileLabel}>
      <Text style={styles.tileLabelText}>{label}</Text>
    </View>
    {children}
    {!!name && (
      <View style={styles.tileName}>
        <Text style={styles.tileNameText} numberOfLines={1}>{name}</Text>
      </View>
    )}
  </View>
);

const BluffGunDuel = ({ result }: { result: BluffDuelResult | null }) => {
  const [stage, setStage] = useState<Stage>('idle');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const shake = useSharedValue(0);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (!result) {
      setStage('skip');
      return undefined;
    }

    setStage('idle');
    const plan: [Stage, number][] = [
      ['accuse', STAGE_DELAYS.accuse],
      ['aim', STAGE_DELAYS.aim],
      ['fire', STAGE_DELAYS.fire],
      ['result', STAGE_DELAYS.result],
    ];
    if (result.eliminated) plan.push(['bones', STAGE_DELAYS.bones]);

    plan.forEach(([s, delay]) => {
      timers.current.push(setTimeout(() => setStage(s), delay));
    });

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [result]);

  useEffect(() => {
    if (stage === 'fire') {
      shake.value = withSequence(
        withTiming(-5, { duration: 60 }),
        withTiming(5, { duration: 60 }),
        withTiming(-4, { duration: 60 }),
        withTiming(4, { duration: 60 }),
        withTiming(0, { duration: 60 })
      );
    }
  }, [stage, shake]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  if (!result) return null;

  const isSelfShot = result.accuserName === result.loserName;
  const order: Stage[] = ['idle', 'accuse', 'aim', 'fire', 'result', 'bones'];
  const stageIndex = order.indexOf(stage);

  const showAccuseEmoji = stageIndex >= order.indexOf('accuse') && stage !== 'bones' && stage !== 'result';
  const gunVisible = stageIndex >= order.indexOf('aim');
  const isFiring = stage === 'fire';
  const showBoom = !!result.eliminated && (stage === 'result' || stage === 'bones');
  const showBones = !!result.eliminated && stage === 'bones';
  const showRelief = !result.eliminated && stage === 'result';
  const chambersMax = result.chambersMax || 6;

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.stage, shakeStyle]}>
        {!isSelfShot && (
          <View style={styles.tileSlot}>
            <Tile avatar={result.accuserAvatar} label="Accuser" name={result.accuserName} />
            {showAccuseEmoji && <Text style={styles.accuseEmoji}>🫵</Text>}
          </View>
        )}

        <View style={styles.tileSlot}>
          {isSelfShot && showAccuseEmoji && <Text style={styles.accuseEmoji}>🫵</Text>}
          <Tile avatar={result.loserAvatar} label={isSelfShot ? 'Accuser · Target' : 'Target'} name={result.loserName} danger dim={showBones}>
            {showBones ? (
              <Text style={styles.centerEmoji}>💀🦴</Text>
            ) : showBoom ? (
              <Text style={styles.centerEmoji}>💥</Text>
            ) : showRelief ? (
              <Text style={styles.reliefEmoji}>😮‍💨 Bach gaya!</Text>
            ) : null}
          </Tile>

          {gunVisible && (
            <Text style={[styles.gun, isFiring && styles.gunFiring]}>
              🔫{isFiring ? ' ✨' : ''}
            </Text>
          )}
        </View>
      </Animated.View>

      {(stage === 'result' || stage === 'bones') && result.chambersAfter != null && (
        <View style={styles.pipsRow}>
          {Array.from({ length: chambersMax }).map((_, i) => (
            <View key={i} style={[styles.pip, i < (result.chambersAfter || 0) ? styles.pipFilled : styles.pipEmpty]} />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginVertical: 12 },
  stage: { height: 128, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40 },
  tileSlot: { position: 'relative' },
  tile: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#262626',
    overflow: 'hidden',
    backgroundColor: '#e3bd9a',
  },
  tileDanger: { borderColor: '#dc2626' },
  tileDim: { opacity: 0.5 },
  tileLabel: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 4,
    paddingVertical: 1,
  },
  tileLabelText: { fontSize: 8, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
  tileName: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 2,
  },
  tileNameText: { fontSize: 9, fontWeight: '700', color: '#fff', textAlign: 'center' },
  accuseEmoji: { position: 'absolute', top: -26, alignSelf: 'center', fontSize: 22 },
  centerEmoji: { position: 'absolute', top: 24, alignSelf: 'center', fontSize: 26 },
  reliefEmoji: { position: 'absolute', top: -30, alignSelf: 'center', fontSize: 16 },
  gun: { position: 'absolute', right: -10, top: 4, fontSize: 22, transform: [{ rotate: '-50deg' }] },
  gunFiring: { transform: [{ rotate: '-58deg' }, { scale: 1.15 }] },
  pipsRow: { flexDirection: 'row', justifyContent: 'center', gap: 4, marginTop: 6 },
  pip: { width: 6, height: 6, borderRadius: 3 },
  pipFilled: { backgroundColor: '#ef4444' },
  pipEmpty: { backgroundColor: '#262626' },
});

export default memo(BluffGunDuel);