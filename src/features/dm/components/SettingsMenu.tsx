import React, { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import axios from 'axios';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import { resetSession } from '../../../shared/services/sessionReset';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import { SlideInRight } from '../../../shared/components/motion/ScreenTransition';
import LegalDocModal from '../../legal/components/LegalDocModal';
import { PRIVACY_POLICY_SECTIONS, PRIVACY_LAST_UPDATED } from '../../legal/content/privacyPolicyText';
import { TERMS_OF_SERVICE_SECTIONS, TERMS_LAST_UPDATED } from '../../legal/content/termsOfServiceText';
import { ZMONEY_SYMBOL } from '../../../shared/constants/currency';

// Change Username FREE hai (backend mein bhi 0) - yahan sirf display ke liye.
const USERNAME_CHANGE_COST = 0;
const CONTACT_EMAIL = 'zeyerotech@gmail.com';

/**
 * Full-screen Settings (Quick Access drawer + apni Profile dono se khulta hai).
 *
 * balance: { z_money } | onBalanceUpdate | currentUsername
 * onUsernameChanged(newUsername) | onLogout (parent token clear ke baad
 * login par bhejta hai; na diya to yahan se router.replace('/'))
 *
 * WEB -> RN CHANGES:
 * - localStorage z_token/my_id remove -> clearToken() + clearMyId() (async).
 * - `window.location.href = mailto:` -> Linking.openURL.
 * - Username change ke baad `window.location.reload()` hata diya (RN mein
 *   reload nahi hota) -> onUsernameChanged(newUsername) parent ko batata
 *   hai, aur screen 900ms baad band ho jaati hai. Parent (Dashboard) ko
 *   apna cached username/feed state refresh karna hoga.
 * - ScreenHeader / SettingsRow ab component ke BAHAR hain (web mein andar
 *   the -> har render pe remount hote the).
 * - env(safe-area-inset-top) -> useSafeAreaInsets.
 */
interface SettingsMenuProps {
  show: boolean;
  onClose: () => void;
  balance?: { z_money?: number } | null;
  onBalanceUpdate?: (updater: (prev: any) => any) => void;
  currentUsername?: string;
  onUsernameChanged?: (newUsername: string) => void;
  onLogout?: () => void;
}

type View_ = 'menu' | 'change-username' | 'delete-account';

const ScreenHeader = ({
  title,
  onBack,
  onClose,
  topInset,
}: {
  title: string;
  onBack: () => void;
  onClose: () => void;
  topInset: number;
}) => (
  <View style={[styles.subHeader, { paddingTop: topInset + 20 }]}>
    <Pressable onPress={onBack} style={styles.roundBtn}>
      <Ionicons name="arrow-back" size={17} color="#d4d4d4" />
    </Pressable>
    <Text style={styles.subTitle} numberOfLines={1}>
      {title}
    </Text>
    <Pressable onPress={onClose} style={styles.roundBtn}>
      <Ionicons name="close" size={16} color="#a3a3a3" />
    </Pressable>
  </View>
);

const SettingsRow = ({
  icon,
  title,
  subtitle,
  onPress,
  danger = false,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
}) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
    <View style={[styles.rowIcon, danger ? styles.rowIconDanger : styles.rowIconNormal]}>{icon}</View>
    <View style={styles.rowText}>
      <Text style={[styles.rowTitle, danger && { color: '#f87171' }]} numberOfLines={1}>
        {title}
      </Text>
      {!!subtitle && (
        <Text style={styles.rowSub} numberOfLines={1}>
          {subtitle}
        </Text>
      )}
    </View>
    <Ionicons name="chevron-forward-outline" size={16} color="#525252" />
  </Pressable>
);

const SettingsMenu = ({ show, onClose, balance, onBalanceUpdate, currentUsername, onUsernameChanged, onLogout }: SettingsMenuProps) => {
  const zIndex = useTopZIndex(show);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [view, setView] = useState<View_>('menu');
  const [usernameInput, setUsernameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [legalView, setLegalView] = useState<null | 'privacy' | 'terms'>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Back button: legal -> logout confirm -> sub-view -> close (stack order).
  const handleBack = useStableCallback(() => {
    if (legalView) return setLegalView(null);
    if (confirmingLogout) return setConfirmingLogout(false);
    if (view !== 'menu') return setView('menu');
    onClose();
  });
  useBackButtonHandler(show, handleBack);

  useEffect(() => {
    if (show) {
      setView('menu');
      setUsernameInput('');
      setError('');
      setSuccess('');
      setSaving(false);
      setConfirmingLogout(false);
      setLegalView(null);
      setDeleteInput('');
      setDeleting(false);
      setDeleteError('');
    }
  }, [show]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const zMoney = balance?.z_money || 0;
  const trimmedInput = usernameInput.trim();
  const validInput = trimmedInput.length >= 3 && trimmedInput.length <= 15;
  const cantAfford = zMoney < USERNAME_CHANGE_COST;

  const authHeaders = () => ({ headers: { Authorization: `Bearer ${getToken()}` } });

  const handleContactUs = () => {
    Linking.openURL(`mailto:${CONTACT_EMAIL}`).catch(() => {});
  };

  const handleSubmitUsername = async () => {
    if (!validInput || cantAfford || saving) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await axios.post(`${API_BASE}/profile/change-username`, { username: trimmedInput }, authHeaders());
      const newUsername = res.data?.username || trimmedInput;
      const newZMoney = res.data?.z_money;
      if (typeof newZMoney === 'number') {
        onBalanceUpdate?.((prev: any) => ({ ...(prev || {}), z_money: newZMoney }));
      }
      onUsernameChanged?.(newUsername);
      setSuccess('Username change ho gaya!');
      setUsernameInput('');
      closeTimerRef.current = setTimeout(() => onClose(), 900);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not change username.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await resetSession();
    if (onLogout) onLogout();
    else router.replace('/');
  };

  const trimmedDeleteInput = deleteInput.trim();
  const deleteConfirmMatches =
    trimmedDeleteInput.length > 0 &&
    !!currentUsername &&
    trimmedDeleteInput.toLowerCase() === currentUsername.toLowerCase();

  const handleDeleteAccount = async () => {
    if (!deleteConfirmMatches || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await axios.post(`${API_BASE}/profile/delete-account`, { username: trimmedDeleteInput }, authHeaders());
      await handleLogout();
    } catch (err: any) {
      setDeleteError(err.response?.data?.detail || 'Account delete nahi ho paya.');
      setDeleting(false);
    }
  };

  return (
    <SlideInRight show={show} style={[styles.screen, { zIndex, elevation: 30 }]}>
      {view === 'menu' && (
        <View style={styles.flex}>
          <LinearGradient
            colors={['rgba(49,46,129,0.35)', 'transparent']}
            style={[styles.hero, { paddingTop: insets.top + 20 }]}
          >
            <View style={styles.heroTop}>
              <View style={styles.roundBtn}>
                <Ionicons name="settings-outline" size={17} color="#818cf8" />
              </View>
              <Pressable onPress={onClose} style={styles.roundBtn}>
                <Ionicons name="close" size={16} color="#a3a3a3" />
              </Pressable>
            </View>
            <Text style={styles.heroTitle}>Settings</Text>
            {!!currentUsername && (
              <Text style={styles.heroSub}>
                Signed in as <Text style={styles.heroSubName}>{currentUsername}</Text>
              </Text>
            )}
          </LinearGradient>

          <ScrollView contentContainerStyle={[styles.menuContent, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.section}>ACCOUNT</Text>
            <View style={styles.group}>
              <SettingsRow
                icon={<Ionicons name="pencil-outline" size={17} color="#818cf8" />}
                title="Change Username"
                subtitle="Free - change anytime"
                onPress={() => {
                  setView('change-username');
                  setError('');
                  setSuccess('');
                }}
              />
            </View>

            <Text style={styles.section}>SUPPORT & LEGAL</Text>
            <View style={styles.group}>
              <SettingsRow icon={<Ionicons name="mail-outline" size={17} color="#818cf8" />} title="Contact Us" subtitle={CONTACT_EMAIL} onPress={handleContactUs} />
              <SettingsRow icon={<Ionicons name="shield-outline" size={17} color="#818cf8" />} title="Privacy Policy" onPress={() => setLegalView('privacy')} />
              <SettingsRow icon={<Ionicons name="document-text-outline" size={17} color="#818cf8" />} title="Terms of Service" onPress={() => setLegalView('terms')} />
            </View>

            <Text style={styles.section}>DANGER ZONE</Text>
            <View style={styles.group}>
              <SettingsRow
                icon={<Ionicons name="trash-outline" size={17} color="#f87171" />}
                title="Delete Account"
                subtitle="Permanent - can't be undone"
                danger
                onPress={() => {
                  setView('delete-account');
                  setDeleteInput('');
                  setDeleteError('');
                }}
              />
              {!confirmingLogout ? (
                <SettingsRow icon={<Ionicons name="log-out-outline" size={17} color="#f87171" />} title="Logout" danger onPress={() => setConfirmingLogout(true)} />
              ) : (
                <View style={styles.logoutBox}>
                  <Text style={styles.logoutAsk}>Are you sure you want to log out?</Text>
                  <View style={styles.logoutBtns}>
                    <Pressable onPress={handleLogout} style={[styles.logoutBtn, { backgroundColor: '#dc2626' }]}>
                      <Text style={styles.logoutBtnText}>Logout</Text>
                    </Pressable>
                    <Pressable onPress={() => setConfirmingLogout(false)} style={[styles.logoutBtn, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                      <Text style={styles.logoutBtnText}>Cancel</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.brand}>
              <Ionicons name="sparkles-outline" size={10} color="#404040" />
              <Text style={styles.brandText}>ZeyeroStars</Text>
            </View>
          </ScrollView>
        </View>
      )}

      {view === 'change-username' && (
        <View style={styles.flex}>
          <ScreenHeader title="Change Username" onBack={() => setView('menu')} onClose={onClose} topInset={insets.top} />
          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <View style={[styles.costBox, cantAfford ? styles.costBoxBad : styles.costBoxOk]}>
              <Text style={styles.costLabel}>THIS WILL COST</Text>
              <Text style={styles.costValue}>Free</Text>
              <Text style={styles.costSub}>Current balance: {ZMONEY_SYMBOL} {zMoney.toLocaleString()}</Text>
            </View>

            {!!currentUsername && (
              <Text style={styles.currentName}>
                Current username: <Text style={styles.currentNameBold}>{currentUsername}</Text>
              </Text>
            )}
            <Text style={styles.label}>Naya username</Text>
            <TextInput
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              value={usernameInput}
              onChangeText={setUsernameInput}
              onSubmitEditing={handleSubmitUsername}
              placeholder="Enter new username"
              placeholderTextColor="#6e6e6e"
              maxLength={15}
              style={styles.bigInput}
            />

            {usernameInput.trim() !== '' && !validInput && <Text style={styles.errText}>Username must be 3-15 characters</Text>}
            {!!error && <Text style={styles.errText}>{error}</Text>}
            {!!success && <Text style={styles.okText}>{success}</Text>}

            <Pressable
              onPress={handleSubmitUsername}
              disabled={!validInput || cantAfford || saving}
              style={[styles.primaryBtn, validInput && !cantAfford && !saving ? styles.primaryOn : styles.primaryOff]}
            >
              <Text style={[styles.primaryBtnText, !(validInput && !cantAfford && !saving) && { color: '#6e6e6e' }]}>
                {saving ? 'Saving...' : 'Confirm Change'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {view === 'delete-account' && (
        <View style={styles.flex}>
          <ScreenHeader title="Delete Account" onBack={() => setView('menu')} onClose={onClose} topInset={insets.top} />
          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <View style={styles.delBox}>
              <Ionicons name="trash-outline" size={24} color="#f87171" />
              <Text style={styles.delTitle}>This will permanently delete your account</Text>
              <Text style={styles.delSub}>Profile, balance, inventory - sab kuch hamesha ke liye chala jayega. Ye undo nahi ho sakta.</Text>
            </View>

            <Text style={styles.label}>
              Confirm karne ke liye apna username likhein: <Text style={styles.currentNameBold}>{currentUsername}</Text>
            </Text>
            <TextInput
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              value={deleteInput}
              onChangeText={setDeleteInput}
              onSubmitEditing={handleDeleteAccount}
              placeholder="Apna username type karein"
              placeholderTextColor="#6e6e6e"
              style={[styles.bigInput, { fontSize: 16 }]}
            />

            {!!deleteError && <Text style={styles.errText}>{deleteError}</Text>}

            <Pressable
              onPress={handleDeleteAccount}
              disabled={!deleteConfirmMatches || deleting}
              style={[styles.primaryBtn, deleteConfirmMatches && !deleting ? styles.dangerOn : styles.primaryOff]}
            >
              {deleting ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={[styles.primaryBtnText, !deleteConfirmMatches && { color: '#6e6e6e' }]}>Permanently Delete My Account</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      )}

      <LegalDocModal
        show={legalView === 'privacy'}
        onClose={() => setLegalView(null)}
        title="Privacy Policy"
        lastUpdated={PRIVACY_LAST_UPDATED}
        sections={PRIVACY_POLICY_SECTIONS}
      />
      <LegalDocModal
        show={legalView === 'terms'}
        onClose={() => setLegalView(null)}
        title="Terms of Service"
        lastUpdated={TERMS_LAST_UPDATED}
        sections={TERMS_OF_SERVICE_SECTIONS}
      />
    </SlideInRight>
  );
};

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  hero: { paddingHorizontal: 20, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
  heroSub: { fontSize: 13, color: '#6e6e6e', marginTop: 4 },
  heroSubName: { color: '#d4d4d4', fontWeight: '600' },
  roundBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  subTitle: { flex: 1, fontWeight: '700', color: '#ffffff', fontSize: 17 },
  menuContent: { padding: 20 },
  section: { fontSize: 11, fontWeight: '700', color: '#6e6e6e', letterSpacing: 1, marginBottom: 10, paddingHorizontal: 4 },
  group: { gap: 10, marginBottom: 28 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowPressed: { backgroundColor: 'rgba(255,255,255,0.06)' },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowIconNormal: { backgroundColor: 'rgba(99,102,241,0.1)' },
  rowIconDanger: { backgroundColor: 'rgba(239,68,68,0.1)' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  rowSub: { fontSize: 11, color: '#6e6e6e', marginTop: 2 },
  logoutBox: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 16, padding: 16 },
  logoutAsk: { fontSize: 12, color: '#d4d4d4', marginBottom: 12 },
  logoutBtns: { flexDirection: 'row', gap: 8 },
  logoutBtn: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: 'center' },
  logoutBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 32 },
  brandText: { fontSize: 10, color: '#404040' },
  formContent: { padding: 20, paddingTop: 24 },
  costBox: { borderRadius: 16, borderWidth: 2, paddingHorizontal: 16, paddingVertical: 20, marginBottom: 20, alignItems: 'center' },
  costBoxOk: { borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,0.1)' },
  costBoxBad: { borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)' },
  costLabel: { fontSize: 11, letterSpacing: 0.8, color: '#a3a3a3', marginBottom: 4 },
  costValue: { fontSize: 36, fontWeight: '800', color: '#ffffff' },
  costSub: { fontSize: 11, color: '#a3a3a3', marginTop: 4 },
  currentName: { fontSize: 11, color: '#6e6e6e', marginBottom: 6 },
  currentNameBold: { color: '#d4d4d4', fontWeight: '700' },
  label: { fontSize: 12, color: '#a3a3a3', marginBottom: 6 },
  bigInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  errText: { fontSize: 11, color: '#f87171', marginTop: 8 },
  okText: { fontSize: 11, color: '#4ade80', marginTop: 8 },
  primaryBtn: { marginTop: 20, paddingVertical: 12, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  primaryOn: { backgroundColor: '#4f46e5' },
  dangerOn: { backgroundColor: '#dc2626' },
  primaryOff: { backgroundColor: 'rgba(255,255,255,0.05)' },
  primaryBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  delBox: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 20,
    marginBottom: 20,
    alignItems: 'center',
    gap: 6,
  },
  delTitle: { fontSize: 14, fontWeight: '700', color: '#f87171', textAlign: 'center' },
  delSub: { fontSize: 11, color: '#d4d4d4', textAlign: 'center' },
});

export default memo(SettingsMenu);