import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import { getMyId } from '../../../shared/utils/auth';
import { getProfile } from '../../../shared/utils/profileHelpers';
import RankBadge from '../../../shared/components/RankBadge';
import VerifiedBadge from '../../../shared/components/VerifiedBadge';
import EliteBadge from '../../../shared/components/EliteBadge';
import { addComment, deleteComment, getComments } from '../services/feedApi';
import type { FeedPost } from '../../dashboard/hooks/useFeedState';

/**
 * WEB -> RN SCOPE NOTE: capacitor wale PostDetailModal.jsx (19K) me nested
 * replies (reply-to-a-comment thread, collapse/expand), long-press action
 * sheet (Reply/Delete/Report), avatar layers + Rank/Verified/Elite badges,
 * aur mention-rich-text sab tha. Yeh pehla RN version - FeedList.tsx jaisa
 * hi MVP spirit follow karta hai - sirf ek FLAT comment list (pfp-initial +
 * username + text) + add-comment + apna comment delete. Replies-threading,
 * badges aur report abhi agla pass hain.
 *
 * post: FeedPost jiski detail khulni hai (null = closed)
 */

interface Comment {
  id: string | number;
  user_id: string | number;
  // Backend post ki tarah hi comments par bhi username/badges flat nahi,
  // nested `players` relation ke andar bhejta hai - getProfile() use karo.
  players?: Record<string, any> | Record<string, any>[];
  username?: string;
  content: string;
  created_at?: string;
  parent_comment_id?: string | number | null;
  [key: string]: unknown;
}

interface PostDetailModalProps {
  post: FeedPost | null;
  onClose: () => void;
  onToggleLike: (id: string | number) => void;
}

const formatTime = (iso?: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  return diffDays < 7 ? `${diffDays}d` : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

const PostDetailModal = ({ post, onClose, onToggleLike }: PostDetailModalProps) => {
  const zIndex = useTopZIndex(post);
  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(!!post, handleClose);

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const offsetRef = useRef(0);
  const myId = getMyId();

  const load = useCallback(async (postId: string | number) => {
    setLoading(true);
    try {
      const res = await getComments(postId, 0, 30);
      const list: Comment[] = res.data.comments || [];
      setComments(list);
      offsetRef.current = list.length;
      setHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Comments load error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (post) {
      setDraft('');
      load(post.id);
    } else {
      setComments([]);
    }
  }, [post, load]);

  if (!post) return null;

  const postProfile = getProfile(post as any);

  const loadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    try {
      const res = await getComments(post.id, offsetRef.current, 30);
      const list: Comment[] = res.data.comments || [];
      setComments((prev) => {
        const existing = new Set(prev.map((c) => c.id));
        return [...prev, ...list.filter((c) => !existing.has(c.id))];
      });
      offsetRef.current += list.length;
      setHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Comments load more error:', err.response?.data || err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const res = await addComment({ postId: post.id, content });
      const newComment: Comment | undefined = res.data.comment;
      setComments((prev) => (newComment ? [newComment, ...prev] : prev));
      setDraft('');
    } catch (err: any) {
      console.error('Add comment error:', err.response?.data || err.message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (commentId: string | number) => {
    const prev = comments;
    setComments((c) => c.filter((x) => x.id !== commentId));
    try {
      await deleteComment(commentId);
    } catch (err: any) {
      console.error('Delete comment error:', err.response?.data || err.message);
      setComments(prev); // revert
    }
  };

  const renderComment = ({ item }: { item: Comment }) => {
    const isMine = myId != null && String(item.user_id) === String(myId);
    const cProfile = getProfile(item as any);
    return (
      <View style={styles.commentRow}>
        <View style={styles.commentAvatar}>
          <Text style={styles.commentAvatarInitial}>
            {(cProfile.username || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.commentHeaderRow}>
            <Text style={styles.commentUsername}>{cProfile.username || 'Unknown'}</Text>
            {!!cProfile.is_verified && <VerifiedBadge size="xs" />}
            {!!cProfile.is_elite && <EliteBadge size="xs" />}
            {!!formatTime(item.created_at) && (
              <Text style={styles.commentTime}>{formatTime(item.created_at)}</Text>
            )}
          </View>
          <Text style={styles.commentContent}>{item.content}</Text>
        </View>
        {isMine && (
          <Pressable onPress={() => handleDelete(item.id)} hitSlop={8} style={{ padding: 4 }}>
            <Ionicons name="trash-outline" size={15} color="#71717a" />
          </Pressable>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.overlay, { zIndex, elevation: 20 }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
          </Pressable>
          <Text style={styles.headerTitle}>Post</Text>
          <View style={{ width: 20 }} />
        </View>

        <FlatList
          data={comments}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderComment}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.postCard}>
              <View style={styles.postHeaderRow}>
                <View style={styles.postAvatar}>
                  <Text style={styles.postAvatarInitial}>
                    {(postProfile.username || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.postUsernameRow}>
                    <Text style={styles.postUsername}>{postProfile.username || 'Unknown'}</Text>
                    {!!postProfile.is_verified && <VerifiedBadge size="sm" />}
                    {!!postProfile.is_elite && <EliteBadge size="sm" />}
                    {!!formatTime(post.created_at) && (
                      <Text style={styles.postTime}>· {formatTime(post.created_at)}</Text>
                    )}
                  </View>
                  {(postProfile.rank != null || postProfile.power != null) && (
                    <View style={styles.postMetaRow}>
                      {postProfile.rank != null && <RankBadge rank={postProfile.rank} size="sm" />}
                      {postProfile.power != null && (
                        <View style={styles.powerChip}>
                          <Ionicons name="flash" size={11} color="#facc15" />
                          <Text style={styles.powerText}>{postProfile.power}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
              {!!post.content && <Text style={styles.postContent}>{post.content}</Text>}
              <View style={styles.postActionsRow}>
                <Pressable style={styles.actionBtn} onPress={() => onToggleLike(post.id)} hitSlop={8}>
                  <Ionicons
                    name={post.liked_by_me ? 'heart' : 'heart-outline'}
                    size={20}
                    color={post.liked_by_me ? '#f87171' : '#a1a1aa'}
                  />
                  <Text style={styles.actionCount}>{post.likes_count || 0}</Text>
                </Pressable>
                <View style={styles.actionBtn}>
                  <Ionicons name="chatbubble-outline" size={19} color="#a1a1aa" />
                  <Text style={styles.actionCount}>{comments.length}</Text>
                </View>
              </View>
              <View style={styles.divider} />
              {loading && comments.length === 0 && (
                <ActivityIndicator color="#ffffff" style={{ marginVertical: 12 }} />
              )}
              {!loading && comments.length === 0 && (
                <Text style={styles.emptyText}>No comments yet - say something!</Text>
              )}
            </View>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color="#ffffff" style={{ marginVertical: 12 }} /> : null
          }
        />

        <View style={styles.composerRow}>
          <TextInput
            style={styles.composerInput}
            placeholder="Add a comment..."
            placeholderTextColor="#71717a"
            value={draft}
            onChangeText={setDraft}
            maxLength={300}
            multiline
          />
          <Pressable onPress={handleSend} disabled={!draft.trim() || sending} hitSlop={8} style={styles.sendBtn}>
            {sending ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={draft.trim() ? '#818cf8' : '#3f3f46'}
              />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  headerTitle: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  postCard: { paddingVertical: 16 },
  postHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  postAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAvatarInitial: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  postUsernameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  postUsername: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  postTime: { color: '#71717a', fontSize: 11 },
  postMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  powerChip: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  powerText: { color: '#facc15', fontSize: 11, fontWeight: '700' },
  postContent: { color: '#e4e4e7', fontSize: 14, lineHeight: 19, marginBottom: 10 },
  postActionsRow: { flexDirection: 'row', gap: 20, marginBottom: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { color: '#a1a1aa', fontSize: 12 },
  divider: { height: 1, backgroundColor: '#27272a', marginBottom: 12 },
  emptyText: { color: '#71717a', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  commentAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitial: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  commentHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentUsername: { color: '#e4e4e7', fontSize: 12, fontWeight: '700' },
  commentTime: { color: '#71717a', fontSize: 10 },
  commentContent: { color: '#d4d4d8', fontSize: 13, lineHeight: 17, marginTop: 1 },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  composerInput: {
    flex: 1,
    backgroundColor: '#18181b',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 13,
    maxHeight: 90,
  },
  sendBtn: { paddingHorizontal: 4, paddingVertical: 8 },
});

export default memo(PostDetailModal);