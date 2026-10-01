import React, { memo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { FadeIn } from '../../../shared/components/motion/ScreenTransition';

// "Match found" full-screen loading - match milte hi game screen khulne tak
// dikhta hai (GameOverlayScreen render karta hai). Cancel nahi hota - match
// pehle hi ban chuka hai.
interface Props {
  show: boolean;
  kind: 'battle' | 'bluff' | null;
}

const MatchFoundLoading = ({ show, kind }: Props) => (
  <FadeIn show={show} style={styles.root}>
    <LinearGradient colors={['#07050f', '#150a2b', '#07050f']} style={StyleSheet.absoluteFill} />

    <MotiView
      from={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'timing', duration: 380, easing: Easing.out(Easing.cubic) }}
      style={styles.center}
    >
      <MotiView
        from={{ scale: 1, opacity: 0.35 }}
        animate={{ scale: 1.5, opacity: 0 }}
        transition={{ type: 'timing', duration: 1300, loop: true, easing: Easing.out(Easing.ease) }}
        style={styles.pulseRing}
      />
      <View style={styles.iconWrap}>
        <Ionicons name={kind === 'bluff' ? 'moon' : 'flash'} size={44} color="#facc15" />
      </View>

      <Text style={styles.title}>MATCH FOUND!</Text>
      <Text style={styles.sub}>
        {kind === 'bluff' ? 'Taking your seat at the table…' : 'Preparing the arena…'}
      </Text>
      <ActivityIndicator size="small" color="#a78bfa" style={{ marginTop: 22 }} />
    </MotiView>
  </FadeIn>
);

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 9999, elevation: 9999, backgroundColor: '#07050f' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#facc15',
    top: '50%',
    marginTop: -120,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250,204,21,0.1)',
    borderWidth: 2,
    borderColor: '#facc15',
    marginBottom: 22,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 2,
    color: '#fff',
    textShadowColor: '#7c3aed',
    textShadowRadius: 14,
  },
  sub: { marginTop: 8, fontSize: 13, color: '#a78bfa' },
});

export default memo(MatchFoundLoading);