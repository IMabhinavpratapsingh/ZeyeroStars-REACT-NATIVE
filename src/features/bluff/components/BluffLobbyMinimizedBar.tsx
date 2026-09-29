import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// BluffLobbyMinimizedBar - jab lobby minimize ki jaati hai, yeh chhota
// floating pill screen ke top par dikhta rehta hai - poori app (DM,
// Rooms, feed) neeche normally usable rehti hai. Tap karne par lobby
// screen wapas khul jaati hai.
//
// WEB -> RN: web mein `fixed top-3` tha - yahan bhi absolute + top offset,
// bas AnimatePresence/motion.button ki jagah shared SlideUp-jaisa nahi,
// simple fade+slide (SlideInRight family se milta hai, par top se drop).

interface Lobby {
  code: string;
  is_public: boolean;
  members?: any[];
  max_players?: number;
}

interface BluffLobbyMinimizedBarProps {
  show: boolean;
  lobby: Lobby | null;
  onReopen: () => void;
}

const BluffLobbyMinimizedBar = ({ show, lobby, onReopen }: BluffLobbyMinimizedBarProps) => {
  if (!show || !lobby) return null;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Pressable onPress={onReopen} style={styles.pill}>
        <View style={styles.iconWrap}>
          <Ionicons name="eye-off-outline" size={16} color="#f6bc7a" />
        </View>
        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Table {lobby.code}</Text>
            <Ionicons name={lobby.is_public ? 'globe-outline' : 'lock-closed-outline'} size={10} color="#9a9a9a" />
          </View>
          <Text style={styles.subtitle}>
            {(lobby.members || []).length}/{lobby.max_players || 4} players - tap to return
          </Text>
        </View>
        <View style={styles.liveDot} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center', zIndex: 160 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingLeft: 10, paddingRight: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#262626',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
    maxWidth: '92%',
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(224,136,58,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  textCol: { minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontSize: 12, fontWeight: '700', color: '#fff' },
  subtitle: { fontSize: 11, color: '#9a9a9a' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
});

export default memo(BluffLobbyMinimizedBar);