import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
} from 'firebase/auth';

import { API_BASE } from '../shared/config/config';
import { auth } from '../shared/config/firebaseConfig';
import { showAlert } from '../shared/utils/alertBus';
import { buildBanMessage, setMyId } from '../shared/utils/auth';
import networkManager from '../shared/services/NetworkManager';
import { setupPushNotifications } from '../shared/services/pushNotifications';
import LegalDocModal from '../features/legal/components/LegalDocModal';
import { PRIVACY_POLICY_SECTIONS, PRIVACY_LAST_UPDATED } from '../features/legal/content/privacyPolicyText';
import { TERMS_OF_SERVICE_SECTIONS, TERMS_LAST_UPDATED } from '../features/legal/content/termsOfServiceText';

// WEB -> RN CHANGES (Login.jsx se):
// - Google Sign-In (SocialLogin / Google Identity Services script) poora
//   HATA diya hai - original web version mein bhi ye already feature-flag
//   se OFF tha (`SHOW_GOOGLE_LOGIN = false`), asli login email/password
//   (Firebase) hi tha. Agar aage native Google Sign-In chahiye ho to
//   `@react-native-google-signin/google-signin` add karke yahan wapas
//   laga sakte hain - bata dena, alag se kar denge.
// - Legal (Privacy/Terms): checkbox text ke "Privacy Policy" aur "Terms of Service"
//   links tap karne par LegalDocModal khulta hai (Settings wala same modal).
// - localStorage.setItem("z_token"/"my_id") -> networkManager.setToken()
//   (AsyncStorage + in-memory cache) aur setMyId().
// - window.location.href -> router.replace() (koi hard reload nahi).
const Login = () => {
  const scrollRef = useRef<ScrollView>(null);

  // Keyboard khulte hi form ko neeche tak scroll karo, taaki Password field
  // aur button keyboard ke upar dikhein (pehle keyboard unhe dhak leta tha).
  useEffect(() => {
    const evt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(evt, () => {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    });
    return () => sub.remove();
  }, []);

  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [legalView, setLegalView] = useState<null | 'privacy' | 'terms'>(null);
  const closeLegal = useCallback(() => setLegalView(null), []);

  const [emailMode, setEmailMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const finishFirebaseLogin = useCallback(async (firebaseIdToken: string) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE}/auth/firebase-login`, {
        id_token: firebaseIdToken,
      });

      // Safety: koi purana socket (kisi bhi logout path se reh gaya ho) naye
      // account ke saath share na ho - TabsLayout fresh token se naya connect karega.
      networkManager.disconnect();
      await networkManager.setToken(response.data.token);
      await setMyId(response.data.player.id);

      // Fresh login ke baad FCM token backend ko register karo (pehle sirf
      // app restart par hota tha - is wajah se naye login par push nahi aati thi).
      setupPushNotifications().catch((e) => console.error('push init after login (non-fatal):', e));

      if (!response.data.player.is_profile_created) {
        router.replace('/username-selection');
      } else {
        router.replace('/(tabs)/dashboard');
      }
    } catch (error: any) {
      console.error(
        '[ZLOGIN_DEBUG] finishFirebaseLogin error:',
        error?.message,
        JSON.stringify(error?.response?.data || null)
      );

      if (error?.response?.status === 403 && error?.response?.data?.detail?.banned) {
        showAlert(buildBanMessage(error.response.data.detail.reason));
        setLoading(false);
        return;
      }

      showAlert('Login failed: ' + (error?.response?.data?.detail || error?.message || 'unknown error'));
      setLoading(false);
    }
  }, []);

  const mapFirebaseError = (err: any): string => {
    const code = err?.code || '';
    if (code.includes('email-already-in-use')) return 'This email is already registered - please log in instead.';
    if (code.includes('invalid-email')) return 'Please enter a valid email address.';
    if (code.includes('weak-password')) return 'Password must be at least 6 characters.';
    if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
      return 'Incorrect email or password.';
    }
    if (code.includes('too-many-requests')) return 'Too many attempts - please try again later.';
    return err?.message || 'Something went wrong, please try again.';
  };

  const nudgeAgree = () => {
    setNudge(true);
    setTimeout(() => setNudge(false), 500);
  };

  const handleEmailSubmit = async () => {
    if (!agreed) {
      nudgeAgree();
      return;
    }
    setEmailError('');
    setInfoMsg('');

    if (emailMode === 'forgot') {
      try {
        setLoading(true);
        await sendPasswordResetEmail(auth, email);
        setInfoMsg('Password reset link sent - please check your email.');
      } catch (err) {
        setEmailError(mapFirebaseError(err));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (emailMode === 'signup' && password !== confirmPassword) {
      setEmailError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);

      if (emailMode === 'signup') {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCred.user);
        setInfoMsg(
          `Account created! We've sent a verification link to ${email}. ` +
            'Please click the link to verify your email, then log in.'
        );
        setEmailMode('login');
        setPassword('');
        setConfirmPassword('');
        setLoading(false);
        return;
      }

      const userCred = await signInWithEmailAndPassword(auth, email, password);
      await userCred.user.reload();

      if (!userCred.user.emailVerified) {
        setEmailError('You need to verify your email before logging in. Please check your inbox (and spam folder).');
        setLoading(false);
        setInfoMsg('__SHOW_RESEND__');
        return;
      }

      const idToken = await userCred.user.getIdToken();
      await finishFirebaseLogin(idToken);
    } catch (err) {
      setEmailError(mapFirebaseError(err));
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email || !password) {
      setEmailError('Please re-enter your email and password, then try "Resend" again.');
      return;
    }
    try {
      setLoading(true);
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCred.user);
      setInfoMsg('Verification link resent - please check your email.');
    } catch (err) {
      setEmailError(mapFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    // Android par bhi 'padding' - edge-to-edge mein system "resize" nahi karta,
    // isliye pehle keyboard Password bar ko dhak leta tha.
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.brandWrap}>
          <Text style={styles.brand}>ZeyeroStars</Text>
          <Text style={styles.brandSub}>Sign in to keep playing</Text>
        </View>

        <Pressable style={styles.agreeRow} onPress={() => setAgreed((v) => !v)}>
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed && <Ionicons name="checkmark" size={12} color="#000000" />}
          </View>
          <Text style={[styles.agreeText, nudge && styles.agreeTextNudge]}>
            I agree to the{' '}
            <Text style={styles.agreeLink} onPress={() => setLegalView('privacy')}>
              Privacy Policy
            </Text>{' '}
            and{' '}
            <Text style={styles.agreeLink} onPress={() => setLegalView('terms')}>
              Terms of Service
            </Text>
          </Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator color="#ffffff" style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              {emailMode === 'signup' ? 'Create your account' : emailMode === 'forgot' ? 'Reset your password' : 'Log in'}
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="you@example.com"
                placeholderTextColor="#71717a"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {emailMode !== 'forgot' && (
              <View style={styles.field}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    secureTextEntry={!showPassword}
                    placeholder="At least 6 characters"
                    placeholderTextColor="#71717a"
                    value={password}
                    onChangeText={setPassword}
                  />
                  <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#71717a" />
                  </Pressable>
                </View>
              </View>
            )}

            {emailMode === 'signup' && (
              <View style={styles.field}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputWithIcon}>
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    secureTextEntry={!showConfirmPassword}
                    placeholder="Re-enter your password"
                    placeholderTextColor="#71717a"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <Pressable onPress={() => setShowConfirmPassword((v) => !v)} hitSlop={10}>
                    <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#71717a" />
                  </Pressable>
                </View>
              </View>
            )}

            {!!emailError && <Text style={styles.errorText}>{emailError}</Text>}
            {!!infoMsg && infoMsg !== '__SHOW_RESEND__' && <Text style={styles.successText}>{infoMsg}</Text>}
            {infoMsg === '__SHOW_RESEND__' && (
              <Pressable onPress={handleResendVerification}>
                <Text style={styles.linkText}>Resend verification email</Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleEmailSubmit}
              disabled={!agreed}
              style={[styles.submitButton, !agreed && styles.submitButtonDisabled]}
            >
              <Text style={[styles.submitButtonText, !agreed && styles.submitButtonTextDisabled]}>
                {emailMode === 'signup' ? 'Sign up' : emailMode === 'forgot' ? 'Send reset link' : 'Login'}
              </Text>
            </Pressable>

            <View style={styles.switchRow}>
              <Pressable
                onPress={() => {
                  setEmailMode(emailMode === 'signup' ? 'login' : 'signup');
                  setEmailError('');
                  setInfoMsg('');
                  setPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.linkTextSmall}>
                  {emailMode === 'signup' ? 'Already have an account? Login' : 'New here? Sign up'}
                </Text>
              </Pressable>
              {emailMode !== 'forgot' ? (
                <Pressable onPress={() => { setEmailMode('forgot'); setEmailError(''); setInfoMsg(''); }}>
                  <Text style={styles.linkTextSmall}>Forgot password?</Text>
                </Pressable>
              ) : (
                <Pressable onPress={() => { setEmailMode('login'); setEmailError(''); setInfoMsg(''); }}>
                  <Text style={styles.linkTextSmall}>Back to login</Text>
                </Pressable>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      <LegalDocModal
        show={legalView === 'privacy'}
        onClose={closeLegal}
        title="Privacy Policy"
        lastUpdated={PRIVACY_LAST_UPDATED}
        sections={PRIVACY_POLICY_SECTIONS}
      />
      <LegalDocModal
        show={legalView === 'terms'}
        onClose={closeLegal}
        title="Terms of Service"
        lastUpdated={TERMS_LAST_UPDATED}
        sections={TERMS_OF_SERVICE_SECTIONS}
      />
    </KeyboardAvoidingView>
  );
};

export default Login;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  scrollContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 80 },
  brandWrap: { alignItems: 'center', marginBottom: 32 },
  brand: { color: '#ffffff', fontSize: 24, fontWeight: '800' },
  brandSub: { color: '#a1a1aa', fontSize: 13, marginTop: 8 },
  agreeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, maxWidth: 300, marginBottom: 24 },
  checkbox: {
    width: 16, height: 16, borderRadius: 4, borderWidth: 1, borderColor: '#71717a',
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  agreeText: { color: '#a1a1aa', fontSize: 12, flex: 1 },
  agreeTextNudge: { color: '#f87171' },
  agreeLink: { color: '#ffffff', textDecorationLine: 'underline', fontWeight: '600' },
  card: { width: '100%', maxWidth: 320, gap: 12 },
  cardTitle: { color: '#f4f4f5', fontSize: 17, fontWeight: '600', marginBottom: 4 },
  field: { gap: 4 },
  label: { color: '#a1a1aa', fontSize: 11 },
  input: {
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderRadius: 999,
    color: '#ffffff', paddingHorizontal: 16, paddingVertical: 10,
  },
  inputWithIcon: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181b', borderWidth: 1,
    borderColor: '#27272a', borderRadius: 999, paddingRight: 16,
  },
  inputFlex: { flex: 1, borderWidth: 0, backgroundColor: 'transparent' },
  errorText: { color: '#f87171', fontSize: 12 },
  successText: { color: '#4ade80', fontSize: 12 },
  linkText: { color: '#ffffff', fontSize: 12, textDecorationLine: 'underline' },
  submitButton: { backgroundColor: '#ffffff', borderRadius: 999, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  submitButtonDisabled: { backgroundColor: '#27272a' },
  submitButtonText: { color: '#000000', fontWeight: '700' },
  submitButtonTextDisabled: { color: '#71717a' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  linkTextSmall: { color: '#a1a1aa', fontSize: 12, textDecorationLine: 'underline' },
});