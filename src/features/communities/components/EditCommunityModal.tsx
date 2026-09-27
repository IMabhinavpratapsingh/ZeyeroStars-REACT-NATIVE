import React, { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { FadeIn, CardPop } from '../../../shared/components/motion/ScreenTransition';
import { compressImage, toUploadFormPart } from '../../../shared/utils/imageCompress';
import {
  uploadCommunityRoomBackground,
  updateCommunityRoomBackground,
  updateCommunityRoomChatOnly,
} from '../services/communitiesApi';

/**
 * EditRoomModal.tsx (rooms/) ka hi community-room version - background
 * upload + chat-only toggle, wahi do-step upload flow. Farak sirf itna:
 * yeh room ek SHARED community property hai (kisi ek member ki nahi),
 * isliye "isPrivileged" (Verified/Elite) gate ki jagah "isModOrOwner"
 * gate hai (backend bhi yehi check karta hai), aur koi room-name field
 * nahi (naam hamesha community ka naam hi hota hai, koi apna alag icon
 * bhi nahi - CommunityAvatar hi hamesha dikhta hai, room aur community
 * ki identity kabhi mismatch na ho isliye).
 *
 * WEB -> RN CHANGES: same as EditRoomModal.tsx - `<input type=file>` ->
 * expo-image-picker, toggle -> native `Switch`.
 */
interface CommunityRoom {
  room_bg_url?: string | null;
  chat_only?: boolean;
}
interface EditCommunityRoomModalProps {
  show: boolean;
  communityId: string | number;
  room: CommunityRoom | null;
  onClose: () => void;
  onSaved?: (patch: Partial<CommunityRoom>) => void;
  isModOrOwner?: boolean;
}

const EditCommunityRoomModal = ({
  show,
  communityId,
  room,
  onClose,
  onSaved,
  isModOrOwner = false,
}: EditCommunityRoomModalProps) => {
  const __z = useTopZIndex(show);
  const [bgPreviewUrl, setBgPreviewUrl] = useState<string | null>(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [error, setError] = useState('');
  const [chatOnly, setChatOnly] = useState(!!room?.chat_only);
  const [savingChatOnly, setSavingChatOnly] = useState(false);

  useBackButtonHandler(show, onClose);

  useEffect(() => {
    if (show) {
      setBgPreviewUrl(room?.room_bg_url || null);
      setChatOnly(!!room?.chat_only);
      setError('');
    }
  }, [show, room]);

  if (!show) return null;

  const handlePickBg = async () => {
    if (!isModOrOwner || uploadingBg) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;

    setUploadingBg(true);
    setError('');
    try {
      const original = picked.assets[0].uri;
      // Room background poore floor par (viewport ka bada side x 2.4,
      // aksar 2000px+) stretch hoti hai - chhota compress blurry
      // dikhega, isliye bada maxDimension + behtar quality.
      const compressed = await compressImage(original, { maxDimension: 2048, quality: 0.9 }).catch(() => null);
      const part = compressed
        ? toUploadFormPart(compressed)
        : ({ uri: original, name: 'photo.jpg', type: 'image/jpeg' } as any);
      const uploaded = await uploadCommunityRoomBackground(communityId, part);
      const bgUrl = uploaded.data.bg_url;
      await updateCommunityRoomBackground(communityId, bgUrl);
      setBgPreviewUrl(bgUrl);
      onSaved?.({ room_bg_url: bgUrl });
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Couldn't upload room background.");
    } finally {
      setUploadingBg(false);
    }
  };

  const handleToggleChatOnly = async () => {
    if (savingChatOnly || !isModOrOwner) return;
    const next = !chatOnly;
    setSavingChatOnly(true);
    setError('');
    try {
      await updateCommunityRoomChatOnly(communityId, next);
      setChatOnly(next);
      onSaved?.({ chat_only: next });
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Couldn't update chat only mode.");
    } finally {
      setSavingChatOnly(false);
    }
  };

  return (
    <FadeIn show={show} style={[styles.backdrop, { zIndex: __z }]}>
      <CardPop style={styles.card}>
        <Text style={styles.title}>Edit Community Room</Text>
        <Text style={styles.subtitle}>Only mods and the owner can change these.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Room background</Text>
          <Pressable onPress={handlePickBg} disabled={!isModOrOwner || uploadingBg} style={styles.bgBtn}>
            {bgPreviewUrl ? (
              <Image source={{ uri: bgPreviewUrl }} style={styles.bgImg} />
            ) : (
              <Ionicons name="image-outline" size={22} color="#6e6482" />
            )}
            <View style={styles.photoOverlay}>
              {uploadingBg ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Ionicons name="camera" size={18} color="#ffffff" />
              )}
            </View>
          </Pressable>
          <Text style={styles.hint}>Tap to change the community room's background image</Text>
        </View>

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
            disabled={savingChatOnly || !isModOrOwner}
            trackColor={{ false: '#2c2545', true: '#6d5bd0' }}
            thumbColor="#ffffff"
          />
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable onPress={onClose} style={styles.doneBtn}>
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
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
  title: { fontSize: 20, fontWeight: '700', color: '#ffffff', marginBottom: 4 },
  subtitle: { fontSize: 11, color: '#8b7fae', marginBottom: 16 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#a8a0c0', marginBottom: 8 },
  bgBtn: {
    width: '100%', height: 64, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#12101f', borderWidth: 1, borderColor: '#2c2545',
    alignItems: 'center', justifyContent: 'center',
  },
  bgImg: { width: '100%', height: '100%' },
  photoOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
  },
  hint: { fontSize: 12, color: '#8b7fae', marginTop: 8 },
  chatOnlyRow: {
    marginBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#12101f', borderWidth: 1, borderColor: '#2c2545', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  chatOnlyLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, paddingRight: 8 },
  chatOnlyTextWrap: { flex: 1 },
  chatOnlyTitle: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  chatOnlySub: { fontSize: 11, color: '#8b7fae', marginTop: 2 },
  error: { fontSize: 12, color: '#f87171', marginTop: 12 },
  doneBtn: { marginTop: 16, backgroundColor: '#6d5bd0', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  doneText: { color: '#ffffff', fontWeight: '700' },
});

export default memo(EditCommunityRoomModal);