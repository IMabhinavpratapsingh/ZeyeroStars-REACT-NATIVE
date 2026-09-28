import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
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
import useLongPress from '../../../shared/hooks/useLongPress';
import useAvatarImage from '../../avatar/hooks/useAvatarImage';
import OnlineStatusDot from '../../../shared/components/OnlineStatusDot';
import LongPressActionSheet, { type ActionSheetItem } from '../../../shared/components/LongPressActionSheet';
import ReportBlockModal from '../../dm/components/ReportBlockModal';
import confirmAction from '../../../shared/utils/confirmBus';
import { getMyId } from '../../../shared/utils/auth';
import { getProfile } from '../../../shared/utils/profileHelpers';
import { renderWithMentions } from '../../../shared/utils/renderMentions';
import RankBadge from '../../../shared/components/RankBadge';
import VerifiedBadge from '../../../shared/components/VerifiedBadge';
import EliteBadge from '../../../shared/components/EliteBadge';
import { addComment, deleteComment, deletePost, getComments } from '../services/feedApi';
import type { FeedPost } from '../../dashboard/hooks/useFeedState';

/**
 * WEB -> RN PARITY PASS: capacitor wale PostDetailModal.jsx ka poora
 * "comments" scene ab yahan hai - ek-level-deep reply threads ("View N
 * replies" toggle), Reply/Delete/Report long-press action sheet (comment
 * row aur post header dono par), report/block modal, apna comment/post
 * delete. Avatar sirf round photo hai (AvatarLayers/equipped-items nahi) -
 * jaisa FeedList.tsx mein bhi hai, poore app mein feed/comments avatars
 * yahi consistent simple-photo style follow karte hain.
 *
 * post: FeedPost jiski detail khulni hai (null = closed)
 */

interface Comment {
  id: string | number;
  user_id: string | number;
  // Post ki tarah hi comments par bhi username/badges flat nahi, nested
  // `players` relation ke andar bhejta hai - getProfile() use karo.
  players?: Record<string, any> | Record<string, any>[];
  username?: string;
  content: string;
  created_at?: string;
  parent_comment_id?: string | number | null;
  [key: string]: unknown;
}

interface PostDetailModalProps {
  post: FeedPost | null;
  // Top spacing (status bar / header ke neeche se shuru karne ke liye).
  // Feed tab mein 0 (wahan Header pehle se upar hai); Profile tab se
  // insets.top + 12 pass hota hai taaki close button status bar ke neeche na jaye.
  topInset?: number;
  onClose: () => void;
  onToggleLike: (id: string | number) => void;
  // Post delete ho jaane ke baad feed list se bhi hataane ke liye (feed.tsx
  // se optional wire karo) - na diya ho to bhi modal khud delete karke
  // close kar dega.
  onPostDeleted?: (postId: string | number) => void;
  // Post ke poster / community naam par tap karke navigate karne ke liye
  // (feed.tsx/dashboard.tsx se wire hote hain, communityOpenBus/
  // profileOpenBus ke through - FeedList.tsx ke pattern jaisa hi).
  onOpenProfile?: (user: { id: string | number; username?: string }) => void;
  onOpenCommunity?: (communityId: string | number) => void;
  onOpenCommunityBySlug?: (slug: string, communityName: string) => void;
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

const CommentAvatar = ({
  userId,
  username,
  avatarUrl,
  avatarVersion,
  size,
}: {
  userId: string | number;
  username?: string;
  avatarUrl?: string | null;
  avatarVersion?: number | string | null;
  size: number;
}) => {
  const avatarSrc = useAvatarImage(userId, avatarUrl, avatarVersion);
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.avatarCircle,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        {avatarSrc ? (
          <Image source={{ uri: avatarSrc }} style={styles.avatarImg} />
        ) : (
          <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>
            {(username || '?').charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <OnlineStatusDot userId={userId} size={size * 0.28} />
    </View>
  );
};

/**
 * Ek comment row alag component me - taaki `.map()` ke andar useAvatarImage
 * (ek Hook) safely call ho sake, aur apna khud ka long-press menu state
 * rakh sake (web wale CommentRow jaisa hi).
 */
const CommentRow = memo(function CommentRow({
  c,
  cProfile,
  isMyComment,
  isReply,
  replyTargetId,
  replyCount,
  repliesOpen,
  onToggleReplies,
  onOpenProfile,
  onDeleteComment,
  onReportComment,
  onReplyComment,
  onOpenCommunityBySlug,
}: {
  c: Comment;
  cProfile: Record<string, any>;
  isMyComment: boolean;
  isReply?: boolean;
  replyTargetId: string | number;
  replyCount?: number;
  repliesOpen?: boolean;
  onToggleReplies?: () => void;
  onOpenProfile?: (user: { id: string | number; username?: string }) => void;
  onDeleteComment: (id: string | number) => void;
  onReportComment: () => void;
  onReplyComment: (targetId: string | number, username?: string) => void;
  onOpenCommunityBySlug?: (slug: string, communityName: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const { pressableProps } = useLongPress((pt) => {
    setMenuAnchor(pt);
    setMenuOpen(true);
  });

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: 'Delete this comment?',
      message: "This can't be undone.",
      confirmLabel: 'Delete',
      danger: true,
    });
    if (confirmed) onDeleteComment(c.id);
  };

  const size = isReply ? 32 : 40;

  const menuItems: ActionSheetItem[] = [
    {
      label: 'Reply',
      icon: <Ionicons name="arrow-undo-outline" size={16} color="#f4f4f5" />,
      onClick: () => onReplyComment(replyTargetId, cProfile.username),
    },
    isMyComment
      ? {
          label: 'Delete',
          icon: <Ionicons name="trash-outline" size={16} color="#f87171" />,
          danger: true,
          onClick: handleDelete,
        }
      : {
          label: 'Report',
          icon: <Ionicons name="warning-outline" size={16} color="#f87171" />,
          danger: true,
          onClick: onReportComment,
        },
  ];

  return (
    <View style={[styles.commentRow, isReply && styles.commentRowReply]} {...pressableProps}>
      <Pressable onPress={() => onOpenProfile?.({ id: c.user_id, username: cProfile.username })}>
        <CommentAvatar
          userId={c.user_id}
          username={cProfile.username}
          avatarUrl={cProfile.avatar_url}
          avatarVersion={cProfile.avatar_version}
          size={size}
        />
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={styles.commentHeaderRow}>
          <Text style={styles.commentUsername}>{cProfile.username || 'Unknown'}</Text>
          {!!cProfile.is_verified && <VerifiedBadge size="xs" />}
          {!!cProfile.is_elite && <EliteBadge size="xs" />}
        </View>
        <Text style={styles.commentContent}>
          {renderWithMentions(c.content, null, onOpenCommunityBySlug)}
        </Text>
        {!isReply && (replyCount || 0) > 0 && (
          <Pressable onPress={onToggleReplies} hitSlop={6}>
            <Text style={styles.viewRepliesText}>
              {repliesOpen ? 'Hide replies' : `View ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
            </Text>
          </Pressable>
        )}
      </View>

      <LongPressActionSheet
        open={menuOpen}
        anchor={menuAnchor}
        onClose={() => setMenuOpen(false)}
        items={menuItems}
      />
    </View>
  );
});

const PostDetailModal = ({
  post,
  onClose,
  onToggleLike,
  onPostDeleted,
  onOpenProfile,
  onOpenCommunity,
  onOpenCommunityBySlug,
  topInset = 0,
}: PostDetailModalProps) => {
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

  // Kaunsi top-level comment ki reply-thread abhi khuli hai.
  const [openReplyThreads, setOpenReplyThreads] = useState<Set<string | number>>(() => new Set());
  // { id: jis top-level comment ke neeche reply jaayegi, username: kisko reply kar rahe ho }
  const [replyingTo, setReplyingTo] = useState<{ id: string | number; username?: string } | null>(null);
  const inputRef = useRef<TextInput>(null);

  const [reportState, setReportState] = useState<{ mode: any; target: any } | null>(null);
  const [actionToast, setActionToast] = useState('');
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [postMenuAnchor, setPostMenuAnchor] = useState<{ x: number; y: number } | null>(null);
  const { pressableProps: postLongPressProps } = useLongPress((pt) => {
    setPostMenuAnchor(pt);
    setPostMenuOpen(true);
  });

  const showActionToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(''), 3000);
  };

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
      setReplyingTo(null);
      setOpenReplyThreads(new Set());
      load(post.id);
    } else {
      setComments([]);
    }
  }, [post, load]);

  // Reply par tap hote hi input focus + "@username " prefill - Instagram
  // jaisa hi behaviour.
  useEffect(() => {
    if (replyingTo) {
      setDraft(`@${replyingTo.username || ''} `);
      inputRef.current?.focus();
    }
  }, [replyingTo]);

  // Flat list ko root comments + unke replies (parent_comment_id se
  // group kiye hue) mein baant do - Instagram jaisa ek-level-deep thread.
  // (comments par depend karta hai, post par nahi - isliye null-post
  // return se PEHLE hi, taaki Hooks order har render mein same rahe.)
  const { topLevel, repliesByParent } = useMemo(() => {
    const top: Comment[] = [];
    const byParent: Record<string, Comment[]> = {};
    comments.forEach((c) => {
      if (c.parent_comment_id) {
        const key = String(c.parent_comment_id);
        (byParent[key] ||= []).push(c);
      } else {
        top.push(c);
      }
    });
    return { topLevel: top, repliesByParent: byParent };
  }, [comments]);

  if (!post) return null;

  const postProfile = getProfile(post as any);
  const isMyPost = myId != null && String(post.user_id) === String(myId);
  const postCommunity = (post as any).communities;
  const postCommunityId = (post as any).community_id;
  const openPostCommunity = () => {
    if (postCommunityId != null) onOpenCommunity?.(postCommunityId);
  };
  const openPostProfile = () => {
    onOpenProfile?.({ id: post.user_id, username: postProfile.username });
  };

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
      const res = await addComment({
        postId: post.id,
        content,
        parentCommentId: replyingTo?.id ?? null,
      });
      const newComment: Comment | undefined = res.data.comment;
      setComments((prev) => (newComment ? [newComment, ...prev] : prev));
      // Reply hai to usi thread ko khula bhi rakho, taaki naya reply turant dikhe.
      if (replyingTo) {
        setOpenReplyThreads((prev) => new Set(prev).add(replyingTo.id));
      }
      setDraft('');
      setReplyingTo(null);
    } catch (err: any) {
      console.error('Add comment error:', err.response?.data || err.message);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = async (commentId: string | number) => {
    const prev = comments;
    setComments((c) => c.filter((x) => x.id !== commentId && x.parent_comment_id !== commentId));
    try {
      await deleteComment(commentId);
    } catch (err: any) {
      console.error('Delete comment error:', err.response?.data || err.message);
      setComments(prev); // revert
    }
  };

  const handleDeletePost = async () => {
    const confirmed = await confirmAction({
      title: 'Delete this post?',
      message: "This can't be undone.",
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deletePost(post.id);
      onPostDeleted?.(post.id);
      onClose();
    } catch (err: any) {
      console.error('Delete post error:', err.response?.data || err.message);
    }
  };

  const toggleReplyThread = (commentId: string | number) => {
    setOpenReplyThreads((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) next.delete(commentId);
      else next.add(commentId);
      return next;
    });
  };

  const postMenuItems: ActionSheetItem[] = [
    ...(isMyPost
      ? [
          {
            label: 'Delete',
            icon: <Ionicons name="trash-outline" size={16} color="#f87171" />,
            danger: true,
            onClick: handleDeletePost,
          } as ActionSheetItem,
        ]
      : []),
    ...(!isMyPost
      ? [
          {
            label: 'Report',
            icon: <Ionicons name="warning-outline" size={16} color="#f87171" />,
            danger: true,
            onClick: () =>
              setReportState({ mode: 'report_post', target: { id: post.id, label: 'this post' } }),
          } as ActionSheetItem,
        ]
      : []),
  ];

  const listData = topLevel;

  return (
    <View style={[styles.overlay, { zIndex, elevation: 20, paddingTop: topInset }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Dashboard ka Header (search/notifications/profile) is modal ke
            peeche already dikhta hai - yahan apna alag "Post" title bar
            nahi rakhte (dobara header jaisa dikhta tha), sirf ek chhota
            floating close button chahiye. */}
        <Pressable onPress={onClose} hitSlop={10} style={styles.closeFab}>
          <Ionicons name="close" size={20} color="#ffffff" />
        </Pressable>

        <FlatList
          data={listData}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item: c }) => {
            const cProfile = getProfile(c as any);
            const isMyComment = myId != null && String(c.user_id) === String(myId);
            const replies = repliesByParent[String(c.id)] || [];
            const repliesOpen = openReplyThreads.has(c.id);
            return (
              <View style={styles.commentBlock}>
                <CommentRow
                  c={c}
                  cProfile={cProfile}
                  isMyComment={isMyComment}
                  replyTargetId={c.id}
                  replyCount={replies.length}
                  repliesOpen={repliesOpen}
                  onToggleReplies={() => toggleReplyThread(c.id)}
                  onOpenProfile={onOpenProfile}
                  onOpenCommunityBySlug={onOpenCommunityBySlug}
                  onDeleteComment={handleDeleteComment}
                  onReportComment={() =>
                    setReportState({ mode: 'report_comment', target: { id: c.id, label: 'this comment' } })
                  }
                  onReplyComment={(id, username) => setReplyingTo({ id, username })}
                />
                {repliesOpen && (
                  <View style={styles.repliesWrap}>
                    {replies.map((r) => {
                      const rProfile = getProfile(r as any);
                      const isMyReply = myId != null && String(r.user_id) === String(myId);
                      return (
                        <CommentRow
                          key={r.id}
                          c={r}
                          cProfile={rProfile}
                          isMyComment={isMyReply}
                          isReply
                          replyTargetId={c.id}
                          onOpenProfile={onOpenProfile}
                          onOpenCommunityBySlug={onOpenCommunityBySlug}
                          onDeleteComment={handleDeleteComment}
                          onReportComment={() =>
                            setReportState({ mode: 'report_comment', target: { id: r.id, label: 'this comment' } })
                          }
                          onReplyComment={(id, username) => setReplyingTo({ id, username })}
                        />
                      );
                    })}
                  </View>
                )}
              </View>
            );
          }}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.postCard} {...postLongPressProps}>
              {!!postCommunity && (
                <Pressable onPress={openPostCommunity} style={styles.communityChipRow} hitSlop={4}>
                  <Ionicons name="people-circle-outline" size={16} color="#a1a1aa" />
                  <Text style={styles.communityChipText} numberOfLines={1}>
                    Z({postCommunity.name})
                  </Text>
                </Pressable>
              )}
              <View style={styles.postHeaderRow}>
                <Pressable onPress={openPostProfile} hitSlop={4}>
                  <CommentAvatar
                    userId={post.user_id}
                    username={postProfile.username}
                    avatarUrl={postProfile.avatar_url}
                    avatarVersion={postProfile.avatar_version}
                    size={56}
                  />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Pressable onPress={openPostProfile} style={styles.postUsernameRow} hitSlop={4}>
                    <Text style={styles.postUsername}>{postProfile.username || 'Unknown'}</Text>
                    {!!postProfile.is_verified && <VerifiedBadge size="sm" />}
                    {!!postProfile.is_elite && <EliteBadge size="sm" />}
                  </Pressable>
                  <View style={styles.postMetaRow}>
                    {postProfile.rank != null && <RankBadge rank={postProfile.rank} size="sm" />}
                    {postProfile.power != null && (
                      <View style={styles.powerChip}>
                        <Ionicons name="flash" size={11} color="#facc15" />
                        <Text style={styles.powerText}>{postProfile.power}</Text>
                      </View>
                    )}
                    {!!formatTime(post.created_at) && (
                      <Text style={styles.postTime}>{formatTime(post.created_at)}</Text>
                    )}
                  </View>
                </View>
              </View>

              {!!post.content && (
                <Text style={styles.postContent}>
                  {renderWithMentions(post.content, null, undefined)}
                </Text>
              )}
              {!!post.image_url && (
                <Image source={{ uri: post.image_url as string }} style={styles.postImage} />
              )}

              <LongPressActionSheet
                open={postMenuOpen}
                anchor={postMenuAnchor}
                onClose={() => setPostMenuOpen(false)}
                items={postMenuItems}
              />

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
              <Text style={styles.commentsHeading}>Comments</Text>
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

        {!!replyingTo && (
          <View style={styles.replyingBar}>
            <Text style={styles.replyingText}>
              Replying to <Text style={styles.replyingUsername}>@{replyingTo.username}</Text>
            </Text>
            <Pressable
              onPress={() => {
                setReplyingTo(null);
                setDraft('');
              }}
              hitSlop={8}
            >
              <Ionicons name="close" size={16} color="#a1a1aa" />
            </Pressable>
          </View>
        )}

        <View style={styles.composerRow}>
          <TextInput
            ref={inputRef}
            style={styles.composerInput}
            placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Add a comment...'}
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
              <Ionicons name="send" size={18} color={draft.trim() ? '#818cf8' : '#3f3f46'} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {!!actionToast && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{actionToast}</Text>
        </View>
      )}

      <ReportBlockModal
        mode={reportState?.mode}
        target={reportState?.target || null}
        onClose={() => setReportState(null)}
        onDone={() => showActionToast('Report submitted, thank you.')}
      />
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
  headerBack: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 60 },
  headerBackText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
  headerTitle: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  closeFab: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 5,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(39,39,42,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  communityChipText: { color: '#a1a1aa', fontWeight: '600', fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },

  avatarCircle: {
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { color: '#ffffff', fontWeight: '700' },

  postCard: { paddingVertical: 16 },
  postHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  postUsernameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  postUsername: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  postMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' },
  postTime: { color: '#71717a', fontSize: 11 },
  powerChip: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  powerText: { color: '#facc15', fontSize: 11, fontWeight: '700' },
  postContent: { color: '#e4e4e7', fontSize: 15, lineHeight: 20, marginBottom: 10 },
  postImage: {
    width: '100%',
    height: 280,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#18181b',
  },
  postActionsRow: { flexDirection: 'row', gap: 20, marginBottom: 12, marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { color: '#a1a1aa', fontSize: 12 },
  divider: { height: 1, backgroundColor: '#27272a', marginBottom: 12 },
  commentsHeading: { color: '#d4d4d8', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  emptyText: { color: '#71717a', fontSize: 13, textAlign: 'center', paddingVertical: 12 },

  commentBlock: { paddingVertical: 4 },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 8 },
  commentRowReply: { marginTop: 2 },
  repliesWrap: {
    marginLeft: 20,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: '#27272a',
  },
  commentHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  commentUsername: { color: '#e4e4e7', fontSize: 12, fontWeight: '700' },
  commentContent: { color: '#d4d4d8', fontSize: 13, lineHeight: 17, marginTop: 1 },
  viewRepliesText: { color: '#a1a1aa', fontSize: 12, fontWeight: '700', marginTop: 6 },

  replyingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  replyingText: { color: '#a1a1aa', fontSize: 12 },
  replyingUsername: { color: '#e4e4e7', fontWeight: '700' },

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

  toast: {
    position: 'absolute',
    top: 70,
    alignSelf: 'center',
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: '90%',
  },
  toastText: { color: '#f4f4f5', fontSize: 12, fontWeight: '700', textAlign: 'center' },
});

export default memo(PostDetailModal);