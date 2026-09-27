import React, { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../../shared/utils/alertBus';
import { uploadCommunityIcon } from '../services/communitiesApi';
import { compressImage, toUploadFormPart } from '../../../shared/utils/imageCompress';

/**
 * Upload-only icon picker - no presets/palette (backend bhi ab koi
 * palette-choice gate nahi karta, sirf custom upload allowed hai, sabke
 * liye open, Verified/Elite gate nahi).
 *
 * onChange(next) called with { icon_id: null, icon_url } once uploaded.
 *
 * WEB -> RN CHANGE: `<input type=file>` -> expo-image-picker
 * (launchImageLibraryAsync) -> compressImage -> toUploadFormPart -> FormData.
 */
interface CommunityIconPickerProps {
  iconUrl?: string | null;
  onChange: (next: { icon_id: null; icon_url: string }) => void;
}

const CommunityIconPicker = ({ iconUrl, onChange }: CommunityIconPickerProps) => {
  const [uploading, setUploading] = useState(false);

  const handlePick = async () => {
    if (uploading) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;

    setUploading(true);
    try {
      const original = picked.assets[0].uri;
      const compressed = await compressImage(original).catch(() => null);
      const part = compressed
        ? toUploadFormPart(compressed)
        : ({ uri: original, name: 'icon.jpg', type: 'image/jpeg' } as any);

      const res = await uploadCommunityIcon(part);
      onChange({ icon_id: null, icon_url: res.data.icon_url });
    } catch (err: any) {
      console.error('Community icon upload error:', err.response?.data || err.message);
      showAlert(err.response?.data?.detail || "Couldn't upload icon, try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.preview}>
        {iconUrl ? (
          <Image source={{ uri: iconUrl }} style={styles.previewImg} />
        ) : (
          <Ionicons name="cloud-upload-outline" size={20} color="#6b6b6b" />
        )}
      </View>
      <Pressable onPress={handlePick} disabled={uploading} style={[styles.uploadBtn, uploading && styles.disabledBtn]}>
        <Text style={styles.uploadBtnText}>{uploading ? 'Uploading...' : 'Upload icon'}</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImg: { width: '100%', height: '100%' },
  uploadBtn: { backgroundColor: '#2a2a2a', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
  disabledBtn: { opacity: 0.5 },
  uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});

export default memo(CommunityIconPicker);