import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { BOTTOM_NAV_PX } from '../../../shared/constants/layout';

// BluffModeSelectModal - Battle -> Bluff Court choose karne ke baad
// khulta hai. Teen options: Host Game, Join Game (code), Quick Join.
// Khud koi server-state nahi rakhta - sirf onHost/onJoinCode/onQuickJoin
// call karta hai.
interface BluffModeSelectModalProps {
  show: boolean;
  onClose: () => void;
  onHost: (isPublic: boolean) => void;
  onJoinCode: (code: string) => void;
  onQuickJoin: () => void;
}

type ViewMode = 'menu' | 'host' | 'join';

const BluffModeSelectModal = ({ show, onClose, onHost, onJoinCode, onQuickJoin }: BluffModeSelectModalProps) => {
  const __z = useTopZIndex(show);
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<ViewMode>('menu');
  const [isPublic, setIsPublic] = useState(true);
  const [code, setCode] = useState('');

  const reset = () => {
    setView('menu');
    setIsPublic(true);
    setCode('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  useBackButtonHandler(show, () => {
    if (view !== 'menu') {
      setView('menu');
      return;
    }
    handleClose();
  });

  if (!show) return null;

  const submitHost = () => {
    onHost(isPublic);
    reset();
  };

  const submitJoin = () => {
    const trimmed = code.trim();
    if (trimmed.length < 4) return;
    onJoinCode(trimmed);
    reset();
  };

  const submitQuickJoin = () => {
    onQuickJoin();
    reset();
  };

  return (
    <View style={[styles.container, { zIndex: __z, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {view !== 'menu' && (
            <Pressable onPress={() => setView('menu')} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={20} color="#9a9a9a" />
            </Pressable>
          )}
          <Text style={styles.headerTitle}>
            {view === 'menu' && 'Bluff Court'}
            {view === 'host' && 'Host a Table'}
            {view === 'join' && 'Join by Code'}
          </Text>
        </View>
        <Pressable onPress={handleClose} style={styles.iconBtn}>
          <Ionicons name="close" size={20} color="#9a9a9a" />
        </Pressable>
      </View>

      <View style={styles.body}>
        {view === 'menu' && (
          <View style={styles.menuList}>
            <Pressable onPress={() => setView('host')} style={styles.menuButton}>
              <Ionicons name="enter-outline" size={20} color="#f6bc7a" />
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuTitle}>Host Game</Text>
                <Text style={styles.menuSub}>Create a table, get a code to share</Text>
              </View>
            </Pressable>

            <Pressable onPress={() => setView('join')} style={styles.menuButton}>
              <Ionicons name="key-outline" size={20} color="#facc15" />
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuTitle}>Join Game</Text>
                <Text style={styles.menuSub}>Enter a friend's table code</Text>
              </View>
            </Pressable>

            <Pressable onPress={submitQuickJoin} style={styles.menuButton}>
              <Ionicons name="flash-outline" size={20} color="#4ade80" />
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuTitle}>Quick Join</Text>
                <Text style={styles.menuSub}>Drop into any open public table</Text>
              </View>
            </Pressable>
          </View>
        )}

        {view === 'host' && (
          <View style={styles.formCol}>
            <Text style={styles.formHint}>2-4 players. You'll get a share code once the table is ready.</Text>

            <View style={styles.toggleRow}>
              <Pressable onPress={() => setIsPublic(true)} style={[styles.toggleBox, isPublic && styles.toggleBoxActive]}>
                <Ionicons name="globe-outline" size={18} color={isPublic ? '#fff' : '#9a9a9a'} />
                <Text style={[styles.toggleTitle, isPublic && styles.toggleTitleActive]}>Public</Text>
                <Text style={styles.toggleSub}>Quick Join can find it</Text>
              </Pressable>
              <Pressable onPress={() => setIsPublic(false)} style={[styles.toggleBox, !isPublic && styles.toggleBoxActive]}>
                <Ionicons name="lock-closed-outline" size={18} color={!isPublic ? '#fff' : '#9a9a9a'} />
                <Text style={[styles.toggleTitle, !isPublic && styles.toggleTitleActive]}>Private</Text>
                <Text style={styles.toggleSub}>Code only</Text>
              </Pressable>
            </View>

            <Pressable onPress={submitHost} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Create Table</Text>
            </Pressable>
          </View>
        )}

        {view === 'join' && (
          <View style={styles.formCol}>
            <Text style={styles.formHint}>Ask the host for their 5-letter table code.</Text>
            <TextInput
              autoFocus
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase().slice(0, 5))}
              onSubmitEditing={submitJoin}
              placeholder="ABCDE"
              placeholderTextColor="#3f3f3f"
              autoCapitalize="characters"
              style={styles.codeInput}
            />
            <Pressable onPress={submitJoin} disabled={code.trim().length < 4} style={[styles.primaryButton, code.trim().length < 4 && styles.primaryButtonDisabled]}>
              <Text style={styles.primaryButtonText}>Join Table</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: BOTTOM_NAV_PX, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#262626',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  iconBtn: { padding: 8, borderRadius: 999 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  body: { flex: 1, paddingHorizontal: 16, paddingVertical: 20 },
  menuList: { gap: 8 },
  menuButton: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626',
    paddingVertical: 16, paddingHorizontal: 16, borderRadius: 12,
  },
  menuTextWrap: { flex: 1 },
  menuTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  menuSub: { color: '#9a9a9a', fontSize: 11, marginTop: 2 },
  formCol: { gap: 12 },
  formHint: { color: '#9a9a9a', fontSize: 12 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBox: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#262626', backgroundColor: '#161616',
  },
  toggleBoxActive: { borderColor: '#f2a65a', backgroundColor: 'rgba(242,166,90,0.15)' },
  toggleTitle: { fontSize: 12, fontWeight: '700', color: '#9a9a9a' },
  toggleTitleActive: { color: '#fff' },
  toggleSub: { fontSize: 10, color: '#6e6e6e' },
  primaryButton: { backgroundColor: '#e0883a', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  primaryButtonDisabled: { opacity: 0.4 },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  codeInput: {
    textAlign: 'center', letterSpacing: 8, fontSize: 20, fontWeight: '700', textTransform: 'uppercase',
    backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626', borderRadius: 12,
    paddingVertical: 12, color: '#fff',
  },
});

export default memo(BluffModeSelectModal);