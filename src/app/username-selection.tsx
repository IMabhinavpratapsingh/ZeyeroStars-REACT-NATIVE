import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import axios from 'axios';
import { API_BASE } from '../shared/config/config';
import { getToken } from '../shared/services/NetworkManager';

// WEB -> RN CHANGES (UsernameSelection.jsx se):
// - localStorage.getItem("z_token") -> getToken() (NetworkManager in-memory
//   cache, root _layout.tsx ne already load kar diya hai).
// - window.location.href = "/dashboard" -> router.replace('/(tabs)/dashboard')
//   (hard reload nahi, expo-router navigation).
// - <img> logo abhi hata diya hai - jab asset (zeyerostars.svg/png) ZSFR
//   mein add ho jaye to yahan <Image> laga dena.
export default function UsernameSelectionScreen() {
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [focused, setFocused] = useState(false);

  const handleSave = async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setErrorMsg('Username cannot be empty.');
      return;
    }
    // Defensive check - onChangeText already spaces/capitals rok raha hai,
    // par paste/autofill se agar kuch slip ho jaye, save se pehle pakad liya.
    if (/\s/.test(trimmed) || /[A-Z]/.test(trimmed)) {
      setErrorMsg('Username cannot contain spaces or capital letters.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    const token = getToken();

    try {
      const res = await axios.post(
        `${API_BASE}/profile/update`,
        { username: trimmed },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // CRITICAL: backend 200 OK ke saath bhi success:false bhej sakta hai
      // (jaise username already taken hone par) - isliye yeh check zaroori hai.
      if (!res.data || res.data.success !== true) {
        setErrorMsg(res.data?.message || 'Could not set username. Try a different one.');
        return;
      }

      router.replace('/(tabs)/dashboard');
    } catch (err: any) {
      console.error(err);
      if (err.response) {
        // Backend ne error status ke saath response diya hai - ASLI wajah dikhao.
        setErrorMsg(
          err.response.data?.detail || `Error ${err.response.status}: ${JSON.stringify(err.response.data)}`
        );
      } else {
        // Server tak request pahunchi hi nahi (network/timeout).
        setErrorMsg('Could not reach server. Check your internet connection.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior="padding"
    >
      <View style={styles.card}>
        <Text style={styles.brand}>ZeyeroStars</Text>

        <Text style={styles.title}>Choose your username</Text>
        <Text style={styles.subtitle}>A unique one.</Text>

        <View style={[styles.inputWrap, focused && styles.inputWrapFocused]}>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(t) => {
              setUsername(t.toLowerCase().replace(/\s/g, ''));
              setErrorMsg('');
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="enter your username"
            placeholderTextColor="#71717a"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={15}
            onSubmitEditing={handleSave}
          />
        </View>

        {!!errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

        <Pressable
          onPress={handleSave}
          disabled={saving || !username.trim()}
          style={[styles.button, (saving || !username.trim()) && styles.buttonDisabled]}
        >
          {saving ? <ActivityIndicator color="#000000" /> : <Text style={styles.buttonText}>Continue</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: { width: '100%', maxWidth: 360 },
  brand: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 24,
  },
  title: { color: '#ffffff', fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#a1a1aa', fontSize: 13, textAlign: 'center', marginBottom: 28 },
  inputWrap: {
    borderRadius: 999,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 4,
  },
  inputWrapFocused: { borderColor: '#ffffff' },
  input: {
    color: '#ffffff',
    fontWeight: '600',
    paddingHorizontal: 16,
    paddingVertical: 12,
    textTransform: 'lowercase',
  },
  error: { color: '#f87171', fontSize: 13, marginTop: 12, textAlign: 'center' },
  button: {
    marginTop: 24,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.3 },
  buttonText: { color: '#000000', fontWeight: '800', fontSize: 15 },
});