import React, { memo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { showAlert } from '../../../shared/utils/alertBus';
import { Ionicons } from '@expo/vector-icons';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import CommunityAvatar from '../../communities/components/CommunityAvatar';

/**
 * WEB -> RN NOTE: capacitor wale CreatePostModal.jsx me community picker
 * (locked / dropdown-with-cards), hashtag input, textarea aur photo
 * attach (file input + preview) tha. Ab sab kuch hai: photo attach
 * `expo-image-picker` se hota hai (`<input type=file>` ki jagah), preview
 * niche dikhta hai, X se hata sakte ho. Sirf photo ke saath (bina text ke)
 * bhi post ho sakta hai - web jaisa. Compress + upload parent ke
 * `onSubmit` (useFeedState.createPost) mein hota hai.
 *
 * `posts.community_id` backend me NOT NULL hai - post karne ke liye ek
 * community chahiye hi. lockedCommunity pass karo jab yeh CommunityDetailScreen
 * se khula ho; warna myCommunities + communityId/onChangeCommunityId do
 * (global feed ke "+" button se).
 */

export interface PickerCommunity {
  id: string | number;
  name: string;
  description?: string | null;
  category?: string | null;
  icon_id?: string | number | null;
  icon_url?: string | null;
}

interface CreatePostModalProps {
  show: boolean;
  content: string;
  onChangeContent: (v: string) => void;
  hashtag: string;
  onChangeHashtag: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  posting: boolean;
  imageUri?: string | null;
  onChangeImage?: (uri: string | null) => void;
  lockedCommunity?: PickerCommunity | null;
  myCommunities?: PickerCommunity[];
  communityId?: string | number | null;
  onChangeCommunityId?: (id: string | number) => void;
  onExploreCommunities?: () => void;
}

// Community picker: har row ki fixed height, taaki maxHeight ke hisaab se
// theek 3 rows dikhein aur 4th se scroll shuru ho (Post button screen se
// neeche na jaye).
const PICKER_ROW_H = 56;
const PICKER_VISIBLE_ROWS = 3;

const CreatePostModal = ({
  show,
  content,
  onChangeContent,
  hashtag,
  onChangeHashtag,
  onClose,
  onSubmit,
  posting,
  imageUri,
  onChangeImage,
  lockedCommunity,
  myCommunities,
  communityId,
  onChangeCommunityId,
  onExploreCommunities,
}: CreatePostModalProps) => {
  const zIndex = useTopZIndex(show);
  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(show, handleClose);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!show) return null;

  const handlePickImage = async () => {
    if (posting) return;
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (picked.canceled || !picked.assets?.[0]?.uri) return;
      onChangeImage?.(picked.assets[0].uri);
    } catch (err: any) {
      console.error('Post image pick error:', err?.message);
    }
  };

  const handleTakePhoto = async () => {
    if (posting) return;
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showAlert('Camera permission is needed to take a photo.', 'info');
        return;
      }
      const shot = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });
      if (shot.canceled || !shot.assets?.[0]?.uri) return;
      onChangeImage?.(shot.assets[0].uri);
    } catch (err: any) {
      console.error('Post camera error:', err?.message);
      showAlert('Could not open the camera.');
    }
  };

  const noCommunities = !lockedCommunity && (!myCommunities || myCommunities.length === 0);
  const canSubmit = !posting && (!!content.trim() || !!imageUri) && (!!lockedCommunity || !!communityId);
  const selectedCommunity =
    !lockedCommunity && communityId ? myCommunities?.find((c) => c.id === communityId) : null;

  return (
    <View style={[styles.overlay, { zIndex, elevation: 20 }]}>
      <KeyboardAvoidingView
        style={styles.center}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>New Post</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color="#a1a1aa" />
            </Pressable>
          </View>

          {lockedCommunity ? (
            <View style={styles.lockedRow}>
              <CommunityAvatar
                communityId={lockedCommunity.id}
                iconId={lockedCommunity.icon_id}
                iconUrl={lockedCommunity.icon_url}
                size="sm"
              />
              <Text style={styles.lockedName} numberOfLines={1}>
                {lockedCommunity.name}
              </Text>
            </View>
          ) : noCommunities ? (
            <Pressable
              onPress={() => {
                onClose();
                onExploreCommunities?.();
              }}
              style={styles.exploreRow}
            >
              <Text style={styles.exploreHint}>
                Join a community first to post - every post now belongs to one.
              </Text>
              <View style={styles.exploreBtn}>
                <Ionicons name="people" size={14} color="#ffffff" />
                <Text style={styles.exploreBtnText}>Explore</Text>
              </View>
            </Pressable>
          ) : (
            <View style={{ marginBottom: 12 }}>
              <Pressable onPress={() => setPickerOpen((v) => !v)} style={styles.pickerRow}>
                {selectedCommunity ? (
                  <>
                    <CommunityAvatar
                      communityId={selectedCommunity.id}
                      iconId={selectedCommunity.icon_id}
                      iconUrl={selectedCommunity.icon_url}
                      size="xs"
                    />
                    <Text style={styles.pickerSelectedText} numberOfLines={1}>
                      {selectedCommunity.name}
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="people" size={16} color="#818cf8" />
                    <Text style={styles.pickerPlaceholder}>Choose a community</Text>
                  </>
                )}
                <Ionicons
                  name={pickerOpen ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#71717a"
                />
              </Pressable>

              {pickerOpen && (
                <ScrollView
                  style={styles.pickerList}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                  keyboardShouldPersistTaps="handled"
                >
                  {myCommunities?.map((c) => (
                    <Pressable
                      key={String(c.id)}
                      onPress={() => {
                        onChangeCommunityId?.(c.id);
                        setPickerOpen(false);
                      }}
                      style={[styles.pickerItem, c.id === communityId && styles.pickerItemSelected]}
                    >
                      <CommunityAvatar communityId={c.id} iconId={c.icon_id} iconUrl={c.icon_url} size="sm" />
                      <View style={{ flex: 1 }}>
                        <View style={styles.pickerItemTitleRow}>
                          <Text style={styles.pickerItemName} numberOfLines={1}>
                            {c.name}
                          </Text>
                          {c.id === communityId && (
                            <Ionicons name="checkmark" size={13} color="#818cf8" />
                          )}
                        </View>
                        {!!c.description && (
                          <Text style={styles.pickerItemDesc} numberOfLines={1}>
                            {c.description}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          <View style={styles.hashtagRow}>
            <Ionicons name="pricetag-outline" size={16} color="#818cf8" />
            <TextInput
              style={styles.hashtagInput}
              placeholder="Add Hashtag (optional)"
              placeholderTextColor="#71717a"
              value={hashtag}
              onChangeText={(v) => onChangeHashtag(v.replace(/[^a-zA-Z0-9_]/g, ''))}
              maxLength={30}
              autoCapitalize="none"
            />
          </View>

          <TextInput
            style={styles.textarea}
            placeholder="What's happening?"
            placeholderTextColor="#71717a"
            value={content}
            onChangeText={onChangeContent}
            maxLength={500}
            multiline
            numberOfLines={4}
            autoFocus
          />

          {/* Photo attach - optional */}
          {imageUri ? (
            <View style={styles.previewWrap}>
              <Image source={{ uri: imageUri }} style={styles.previewImg} contentFit="cover" />
              {!posting && (
                <Pressable
                  onPress={() => onChangeImage?.(null)}
                  hitSlop={8}
                  accessibilityLabel="Remove photo"
                  style={styles.previewRemove}
                >
                  <Ionicons name="close" size={16} color="#ffffff" />
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.addPhotoRow}>
              <Pressable
                onPress={handlePickImage}
                accessibilityLabel="Choose photo from gallery"
                style={({ pressed }) => [styles.addPhotoBtn, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="image-outline" size={16} color="#a1a1aa" />
                <Text style={styles.addPhotoText}>Gallery</Text>
              </Pressable>
              <Pressable
                onPress={handleTakePhoto}
                accessibilityLabel="Take photo with camera"
                style={({ pressed }) => [styles.addPhotoBtn, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="camera-outline" size={16} color="#a1a1aa" />
                <Text style={styles.addPhotoText}>Camera</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submitBtn,
              canSubmit ? styles.submitBtnOn : styles.submitBtnOff,
              pressed && canSubmit && { opacity: 0.85 },
            ]}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={[styles.submitText, !canSubmit && { color: '#71717a' }]}>Post</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.85)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 18,
    padding: 20,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f0f11',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  lockedName: { color: '#ffffff', fontWeight: '700', fontSize: 13, flexShrink: 1 },
  exploreRow: {
    backgroundColor: '#0f0f11',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 8,
  },
  exploreHint: { color: '#a1a1aa', fontSize: 13 },
  exploreBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  exploreBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f0f11',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pickerSelectedText: { flex: 1, color: '#ffffff', fontWeight: '700', fontSize: 13 },
  pickerPlaceholder: { flex: 1, color: '#71717a', fontSize: 13 },
  pickerList: {
    marginTop: 4,
    maxHeight: PICKER_ROW_H * PICKER_VISIBLE_ROWS, // 3 community dikhengi, uske baad list andar scroll hogi
    backgroundColor: '#0f0f11',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PICKER_ROW_H,
    gap: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  pickerItemSelected: { backgroundColor: '#18181b' },
  pickerItemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pickerItemName: { color: '#ffffff', fontWeight: '700', fontSize: 13, flexShrink: 1 },
  pickerItemDesc: { color: '#71717a', fontSize: 11, marginTop: 1 },
  hashtagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f0f11',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  hashtagInput: { flex: 1, color: '#ffffff', fontSize: 14, padding: 0 },
  textarea: {
    backgroundColor: '#0f0f11',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    color: '#ffffff',
    fontSize: 14,
    padding: 12,
    minHeight: 96,
    textAlignVertical: 'top',
  },
  addPhotoRow: { marginTop: 12, flexDirection: 'row', gap: 10 },
  addPhotoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#3f3f46',
    backgroundColor: '#0f0f11',
  },
  addPhotoText: { color: '#a1a1aa', fontSize: 13 },
  previewWrap: {
    marginTop: 12,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  previewImg: { width: '100%', height: 180 },
  previewRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: { marginTop: 14, alignSelf: 'flex-end', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999 },
  submitBtnOn: { backgroundColor: '#4f46e5' },
  submitBtnOff: { backgroundColor: '#27272a' },
  submitText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
});

export default memo(CreatePostModal);