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
import { Ionicons } from '@expo/vector-icons';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import CommunityAvatar from '../../communities/components/CommunityAvatar';

/**
 * WEB -> RN NOTE: capacitor wale CreatePostModal.jsx me community picker
 * (locked / dropdown-with-cards), hashtag input, textarea aur photo
 * attach (file input + preview) tha. Yeh pehla RN pass photo attach ko
 * skip karta hai (FeedList bhi abhi images nahi dikhata - dono saath me
 * agla pass milenge) - baaki (community picker + hashtag + content) poora
 * hai.
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
  lockedCommunity?: PickerCommunity | null;
  myCommunities?: PickerCommunity[];
  communityId?: string | number | null;
  onChangeCommunityId?: (id: string | number) => void;
  onExploreCommunities?: () => void;
}

const CreatePostModal = ({
  show,
  content,
  onChangeContent,
  hashtag,
  onChangeHashtag,
  onClose,
  onSubmit,
  posting,
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

  const noCommunities = !lockedCommunity && (!myCommunities || myCommunities.length === 0);
  const canSubmit = !posting && !!content.trim() && (!!lockedCommunity || !!communityId);
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
                <ScrollView style={styles.pickerList} nestedScrollEnabled>
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
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)' },
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
    maxHeight: 220,
    backgroundColor: '#0f0f11',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
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
  submitBtn: { marginTop: 14, alignSelf: 'flex-end', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999 },
  submitBtnOn: { backgroundColor: '#4f46e5' },
  submitBtnOff: { backgroundColor: '#27272a' },
  submitText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
});

export default memo(CreatePostModal);