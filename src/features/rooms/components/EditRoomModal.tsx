import React, { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { FadeIn, CardPop } from '../../../shared/components/motion/ScreenTransition';
import { compressImage, toUploadFormPart } from '../../../shared/utils/imageCompress';
import {
  uploadRoomIcon, updateRoomIcon, updateRoomName,
  uploadRoomBackground, updateRoomBackground, updateChatOnly,
} from '../services/roomsApi';

/**
 * "Your Room" card ke top-left pencil button se khulta hai - custom room
 * image (Verified/Elite only, backend re-checks) + room name (sabke liye
 * free) dono yahin se badal sakte ho.
 *
 * `isPrivileged` (Verified ya Elite) prop caller se aata hai - jab false
 * ho to background section locked dikhta hai. Room name change sabke liye
 * free rehta hai.
 *
 * WEB -> RN CHANGES:
 * - `<input type=file> + ref.click()` -> `expo-image-picker`
 *   (ProfileViewModal.tsx jaisa hi pattern) launchImageLibraryAsync().
 * - `useViewportKeyboard` (web-only resize hack) hata diya - RN mein
 *   modal ek chhota center card hai, poori-screen keyboard-lock height
 *   ki zaroorat nahi; TextInput apne aap keyboard ke saath theek se kaam
 *   karta hai.
 * - Toggle switch -> RN ka native `Switch` component.
 */
interface Room {
  room_name?: string;
  room_icon_url?: string | null;
  room_bg_url?: string | null;
  chat_only?: boolean;
}
interface EditRoomModalProps {
  show: boolean;
  room: Room | null;
  onClose: () => void;
  onSaved?: (patch: Partial<Room>) => void;
  isPrivileged?: boolean;
}

const EditRoomModal = ({ show, room, onClose, onSaved, isPrivileged = false }: EditRoomModalProps) => {
  const __z = useTopZIndex(show);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null);
  const [roomName, setRoomName] = useState(room?.room_name || '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [chatOnly, setChatOnly] = useState(!!room?.chat_only);
  const [savingChatOnly, setSavingChatOnly] = useState(false);

  useBackButtonHandler(show, onClose);

  // Modal khulte hi (ya naya room aane par) local state ko room ke current
  // data se sync kar dete hain.
  useEffect(() => {
    if (show) {
      setRoomName(room?.room_name || '');
      setPreviewUrl(room?.room_icon_url || null);
      setBgPreviewUrl(room?.room_bg_url || null);
      setChatOnly(!!room?.chat_only);
      setError('');
    }
  }, [show, room]);

  if (!show) return null;

  const handlePickPhoto = async () => {
    if (uploadingPhoto) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;

    setUploadingPhoto(true);
    setError('');
    try {
      const original = picked.assets[0].uri;
      const compressed = await compressImage(original).catch(() => null);
      const part = compressed ? toUploadFormPart(compressed) : ({ uri: original, name: 'photo.jpg', type: 'image/jpeg' } as any);
      const uploaded = await uploadRoomIcon(part);
      const iconUrl = uploaded.data.icon_url;
      await updateRoomIcon(iconUrl);
      setPreviewUrl(iconUrl);
      onSaved?.({ room_icon_url: iconUrl });
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Couldn't upload room image.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePickBg = async () => {
    if (!isPrivileged || uploadingBg) return;
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;

    setUploadingBg(true);
    setError('');
    try {
      const original = picked.assets[0].uri;
      // Room background poore floor par (viewport ka bada side x 2.4,
      // aksar 2000px+) stretch hoti hai - profile-pfp jaisa chhota
      // compress (default maxDimension=1024) yahan blurry dikhega,
      // isliye background ke liye bada maxDimension + behtar quality.
      const compressed = await compressImage(original, { maxDimension: 2048, quality: 0.9 }).catch(() => null);
      const part = compressed ? toUploadFormPart(compressed) : ({ uri: original, name: 'photo.jpg', type: 'image/jpeg' } as any);
      const uploaded = await uploadRoomBackground(part);
      const bgUrl = uploaded.data.bg_url;
      await updateRoomBackground(bgUrl);
      setBgPreviewUrl(bgUrl);
      onSaved?.({ room_bg_url: bgUrl });
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Couldn't upload room background.");
    } finally {
      setUploadingBg(false);
    }
  };

  const handleToggleChatOnly = async () => {
    if (savingChatOnly) return;
    const next = !chatOnly;
    setSavingChatOnly(true);
    setError('');
    try {
      await updateChatOnly(next);
      setChatOnly(next);
      onSaved?.({ chat_only: next });
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Couldn't update chat only mode.");
    } finally {
      setSavingChatOnly(false);
    }
  };

  const handleSaveName = async () => {
    const trimmed = roomName.trim();
    if (!trimmed || trimmed === room?.room_name || saving) return;
    setSaving(true);
    setError('');
    try {
      await updateRoomName(trimmed);
      onSaved?.({ room_name: trimmed });
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Couldn't update room name.");
    } finally {
      setSaving(false);
    }
  };

  const nameUnchanged = !roomName.trim() || roomName.trim() === room?.room_name;

  return (
    <FadeIn show={show} style={[styles.backdrop, { zIndex: __z }]}>
      <CardPop style={styles.card}>
        <Text style={styles.title}>Edit Your Room</Text>

        <View style={styles.photoBlock}>
          <Pressable onPress={handlePickPhoto} disabled={uploadingPhoto} style={styles.photoBtn}>
            {previewUrl ? (
              <Image source={{ uri: previewUrl }} style={styles.photoImg} />
            ) : (
              <Ionicons name="home" size={28} color="#6e6482" />
            )}
            <View style={styles.photoOverlay}>
              {uploadingPhoto ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Ionicons name="camera" size={18} color="#ffffff" />
              )}
            </View>
          </Pressable>
          <Text style={styles.hint}>Tap to change room image</Text>
        </View>

        {/* Room floor BACKGROUND - Verified/Elite only. Non-privileged
            users still see this section (so they know it exists) but
            it's locked with a clear reason instead of silently hidden. */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Room background</Text>
          <Pressable
            onPress={handlePickBg}
            disabled={!isPrivileged || uploadingBg}
            style={[styles.bgBtn, !isPrivileged && styles.bgBtnLocked]}
          >
            {bgPreviewUrl ? (
              <Image source={{ uri: bgPreviewUrl }} style={styles.bgImg} />
            ) : (
              <Ionicons name="image-outline" size={22} color="#6e6482" />
            )}
            <View style={styles.photoOverlay}>
              {uploadingBg ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : isPrivileged ? (
                <Ionicons name="camera" size={18} color="#ffffff" />
              ) : (
                <Ionicons name="lock-closed" size={18} color="#ffffff" />
              )}
            </View>
          </Pressable>
          <Text style={styles.hint}>
            {isPrivileged ? "Tap to change your room's background image" : 'Verified or Elite members only'}
          </Text>
        </View>

        {/* Chat only mode - floor (avatars/movement) hide karke room ko
            plain group-chat jaisa bana deta hai. Owner ke liye free. */}
        <View style={styles.chatOnlyRow}>
          <View style={styles.chatOnlyLeft}>
            <Ionicons name="chatbubble-outline" size={18} color="#a8a0c0" />
            <View style={styles.chatOnlyTextWrap}>
              <Text style={styles.chatOnlyTitle}>Chat only mode</Text>
              <Text style={styles.chatOnlySub}>Hide the room floor, show just a group chat</Text>
            </View>
          </View>
          <Switch
            value={chatOnly}
            onValueChange={handleToggleChatOnly}
            disabled={savingChatOnly}
            trackColor={{ false: '#2c2545', true: '#6d5bd0' }}
            thumbColor="#ffffff"
          />
        </View>

        <TextInput
          autoFocus
          style={styles.input}
          placeholder="Room name (max 20 chars)"
          placeholderTextColor="#6e6e6e"
          value={roomName}
          maxLength={20}
          onChangeText={setRoomName}
          onSubmitEditing={handleSaveName}
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.row}>
          <Pressable onPress={onClose} style={[styles.btn, styles.btnCancel]}>
            <Text style={styles.btnText}>Close</Text>
          </Pressable>
          <Pressable
            onPress={handleSaveName}
            disabled={saving || nameUnchanged}
            style={[styles.btn, styles.btnSave, (saving || nameUnchanged) && styles.disabled]}
          >
            <Text style={styles.btnText}>{saving ? 'Saving...' : 'Save Name'}</Text>
          </Pressable>
        </View>
      </CardPop>
    </FadeIn>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.95)', padding: 16,
  },
  card: {
    width: '100%', maxWidth: 384,
    backgroundColor: '#1c1730', borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: '#2c2545',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#ffffff', marginBottom: 16 },
  photoBlock: { alignItems: 'center', marginBottom: 20 },
  photoBtn: {
    width: 80, height: 80, borderRadius: 16, backgroundColor: '#12101f',
    borderWidth: 1, borderColor: '#2c2545', overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  photoImg: { width: '100%', height: '100%' },
  photoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  hint: { fontSize: 12, color: '#8b7fae', marginTop: 8, textAlign: 'center' },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#a8a0c0', marginBottom: 8 },
  bgBtn: {
    width: '100%', height: 64, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#12101f', borderWidth: 1, borderColor: '#2c2545',
    alignItems: 'center', justifyContent: 'center',
  },
  bgBtnLocked: { opacity: 0.6 },
  bgImg: { width: '100%', height: '100%' },
  chatOnlyRow: {
    marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#12101f', borderWidth: 1, borderColor: '#2c2545', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  chatOnlyLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 },
  chatOnlyTextWrap: { flex: 1 },
  chatOnlyTitle: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  chatOnlySub: { fontSize: 11, color: '#8b7fae', marginTop: 2 },
  input: {
    width: '100%', backgroundColor: '#12101f', borderWidth: 1, borderColor: '#2c2545',
    borderRadius: 8, padding: 12, color: '#ffffff', marginBottom: 4,
  },
  error: { fontSize: 12, color: '#f87171', marginTop: 8, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnCancel: { backgroundColor: '#2c2545' },
  btnSave: { backgroundColor: '#6d5bd0' },
  btnText: { color: '#ffffff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
});

export default memo(EditRoomModal);