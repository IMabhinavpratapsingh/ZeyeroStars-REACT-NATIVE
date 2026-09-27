import { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE, APP_VERSION } from '../config/config';

// App khulte hi (login se pehle bhi, isliye root _layout.tsx mein mounted
// hai) ek baar GET /app-version/latest hit karta hai. Backend
// (app_config table) ka latest_version hamare local APP_VERSION (config.ts)
// se zyada hua to yeh full-screen, band-na-hone-wala popup dikha deta hai -
// koi "x" ya bahar tap se close nahi hota, sirf Play Store button hi milta
// hai. DB/network error ya row missing hone par chupchaap kuch nahi
// dikhata (fail-open) taaki yeh kabhi galti se poori app block na kar de.
//
// WEB -> RN CHANGES:
// - window.open(url, "_blank") -> Linking.openURL(url)
// - fixed/z-index div -> react-native Modal (transparent overlay)
export default function UpdateRequiredModal() {
  const [required, setRequired] = useState(false);
  const [playStoreUrl, setPlayStoreUrl] = useState<string | null>(null);

  useEffect(() => {
    axios
      .get(`${API_BASE}/app-version/latest`)
      .then((res) => {
        const latest = res.data?.latest_version;
        if (typeof latest === 'number' && latest > APP_VERSION) {
          setRequired(true);
          setPlayStoreUrl(res.data?.play_store_url || null);
        }
      })
      .catch((err) =>
        console.error('App version check error:', err.response?.data || err.message)
      );
  }, []);

  if (!required) return null;

  const handleUpdate = () => {
    if (playStoreUrl) Linking.openURL(playStoreUrl).catch(() => {});
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="download-outline" size={26} color="#a78bfa" />
          </View>
          <Text style={styles.title}>Update Available</Text>
          <Text style={styles.body}>
            A new version of ZeyeroStars is out. Please update from the Play Store to keep
            playing.
          </Text>
          <Pressable
            onPress={handleUpdate}
            disabled={!playStoreUrl}
            style={[styles.button, !playStoreUrl && styles.buttonDisabled]}
          >
            <Text style={styles.buttonText}>Update Now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(167,139,250,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  body: { color: '#a1a1aa', fontSize: 13, marginTop: 8, textAlign: 'center', lineHeight: 18 },
  button: {
    marginTop: 20,
    width: '100%',
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});