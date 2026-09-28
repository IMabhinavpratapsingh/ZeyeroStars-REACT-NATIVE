import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, NativeScrollEvent, NativeSyntheticEvent, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MotiView } from 'moti';
import axios from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaFrameContext, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import { showAlert } from '../../../shared/utils/alertBus';
import { confirmAction } from '../../../shared/utils/confirmBus';
import { setMyAvatarUrl } from '../../../shared/utils/myAvatarBus';
import { invalidateAvatar } from '../../avatar/services/avatarCache';
import { compressImage, toUploadFormPart } from '../../../shared/utils/imageCompress';
import { FIELD } from '../../../shared/utils/profileFields';
import { renderWithMentions } from '../../../shared/utils/renderMentions';
import { requestOpenProfile } from '../../../shared/utils/profileOpenBus';
import { requestOpenCommunityById, requestOpenCommunityBySlug } from '../../../shared/utils/communityOpenBus';
import { setFullscreenOverlayOpen } from '../../../shared/utils/fullscreenOverlayBus';
import { getUserPosts, togglePostLike } from '../../feed/services/feedApi';
import PostDetailModal from '../../feed/components/PostDetailModal';
import { getBottomNavTotal } from '../../../shared/constants/layout';
import useItemsCatalog from '../../../shared/hooks/useItemsCatalog';
import useSkillsCatalog from '../../../shared/hooks/useSkillsCatalog';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import RankBadge from '../../../shared/components/RankBadge';
import VerifiedBadge from '../../../shared/components/VerifiedBadge';
import EliteBadge from '../../../shared/components/EliteBadge';
import ProfileCard from '../../../shared/components/ProfileCard';
import { getMyRoom } from '../../rooms/services/roomsApi';
import { listMyCommunities } from '../../communities/services/communitiesApi';
import CreateRoomModal from '../../rooms/components/CreateRoomModal';
import EditRoomModal from '../../rooms/components/EditRoomModal';
import AvatarCustomizeModal from './AvatarCustomizeModal';
import EditSkillsModal from './EditSkillsModal';
import ReportBlockModal from './ReportBlockModal';
import UserShopPanel from './UserShopPanel';

// Same profile 60s ke andar dobara khule to API call nahi - pull-to-refresh
// hamesha TTL ignore karke fresh laata hai.
const PROFILE_CACHE_TTL_MS = 60 * 1000;
interface ProfileCacheEntry {
  data: any;
  starCount: number;
  starredByMe: boolean;
  blockedByMe: boolean;
  blockedMe: boolean;
  ts: number;
}
const profileCache = new Map<string | number, ProfileCacheEntry>();

/**
 * profile: kam se kam { id, username } - baaki khud GET /profile/{id} se.
 * feedPosts: Dashboard ki global feed - usme se is user ki posts filter.
 * Trade yahan se nahi - DMChatWindow ke andar hoti hai.
 *
 * WEB -> RN CHANGES:
 * - usePullToRefresh (touch handlers + translateY) -> ScrollView ka native
 *   RefreshControl. Header ab static hai, sirf content scroll/refresh hota hai.
 * - <input type=file> + file.click() -> expo-image-picker (launchImageLibraryAsync)
 *   -> compressImage(uri) -> toUploadFormPart -> FormData. Content-Type
 *   manually set nahi (axios/RN boundary khud lagata hai).
 * - localStorage token -> getToken().
 * - `fixed ... bottom-19` -> absolute, bottom = getBottomNavTotal(insets.bottom)
 *   (jaise ShopModal), top safe-area padding.
 * - `power-glow` CSS class -> textShadow.
 * - divide-x -> border-left on 2nd/3rd cell.
 */
interface ProfileViewModalProps {
  profile: any | null;
  isMe?: boolean;
  onClose: () => void;
  onMessageClick: (profile: any) => void;
  onOpenPost?: (post: any) => void;
  feedPosts?: any[];
  onOpenRoom?: (room: any) => void;
  onOpenSettings?: (username: string) => void;
  onOpenHashtag?: (tag: string) => void;
  onOpenChatWithDraft?: (user: { id: string | number; username: string }, draft: string) => void;
  onOpenCommunity?: (slug: string, name: string) => void;
  onOpenMyCommunities?: () => void;
  /** Profile TAB ke andar (normal flex child, parent already BottomNav se
   * upar bounded) true - tab bottom offset khud subtract nahi karna
   * (warna BottomNav se upar ek extra khaali gap/"border" dikhta hai).
   * Default false = purana behaviour (global overlay, jahan BottomNav
   * sibling hai aur khud hi uske upar tak cover karna padta hai). */
  embedded?: boolean;
  /** Profile TAB mein Tabs navigator baaki tabs (Dashboard) ko bhi mounted
   * rakhta hai (sirf hidden), isliye is component ka apna hardware-back
   * handler hamesha register rehta tha - Dashboard tab par hote hue bhi
   * phone ka back button galti se PROFILE ke onClose (Home) ko call kar
   * deta tha. `active=false` par yeh back-handler register hi nahi hota -
   * profile.tsx isse "kya Profile tab abhi visible/focused hai" se control
   * karta hai (useIsFocused). Default true = purana behaviour (global
   * overlay use-case, jahan hamesha "open" hi count hota hai). */
  active?: boolean;
}

const ProfileViewModal = ({
  profile,
  isMe,
  onClose,
  onMessageClick,
  onOpenPost,
  feedPosts = [],
  onOpenRoom,
  onOpenSettings,
  onOpenHashtag,
  onOpenChatWithDraft,
  onOpenCommunity,
  onOpenMyCommunities,
  embedded = false,
  active = true,
}: ProfileViewModalProps) => {
  const zIndex = useTopZIndex(profile);
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [starCount, setStarCount] = useState(0);
  const [starredByMe, setStarredByMe] = useState(false);
  const [starLoading, setStarLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState('');
  const [savingBio, setSavingBio] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showEditSkills, setShowEditSkills] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [reportBlockMode, setReportBlockMode] = useState<'block' | 'report' | null>(null);
  const [actionToast, setActionToast] = useState('');
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const [myRoom, setMyRoom] = useState<any>(null);
  const [myRoomLoading, setMyRoomLoading] = useState(false);
  const [myCommunitiesCount, setMyCommunitiesCount] = useState(0);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showEditRoom, setShowEditRoom] = useState(false);
  const [profileTab, setProfileTab] = useState<'posts' | 'store'>('posts');
  const { itemsById } = useItemsCatalog();
  const { skillsById } = useSkillsCatalog();

  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(!!profile && active, handleClose);

  const userId = profile?.id || profile?.target_id;

  const loadProfileData = useCallback(
    async (force = false) => {
      if (!userId) return;

      if (!force) {
        const cached = profileCache.get(userId);
        if (cached && Date.now() - cached.ts < PROFILE_CACHE_TTL_MS) {
          setData(cached.data);
          setStarCount(cached.starCount);
          setStarredByMe(cached.starredByMe);
          setBlockedByMe(cached.blockedByMe);
          setBlockedMe(cached.blockedMe);
          setLoading(false);
          if (isMe) setMyAvatarUrl(cached.data?.[FIELD.avatar]);
          return;
        }
      }

      setLoading(true);
      const token = getToken();
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      const [profRes, starRes, blockRes] = await Promise.all([
        axios.get(`${API_BASE}/profile/${userId}`, config).catch(() => null),
        axios.get(`${API_BASE}/profile/${userId}/stars`, config).catch(() => null),
        axios.get(`${API_BASE}/profile/${userId}/block-status`, config).catch(() => null),
      ]);

      const newData = profRes ? profRes.data : null;
      const newStarCount = starRes?.data?.count || 0;
      const newStarredByMe = !!starRes?.data?.starred_by_me;
      const newBlockedByMe = !!blockRes?.data?.blocked_by_me;
      const newBlockedMe = !!blockRes?.data?.blocked_me;

      if (profRes) {
        setData(newData);
        // Apna profile hai to Header ki pfp bhi isi se sync rakho.
        if (isMe) setMyAvatarUrl(newData?.[FIELD.avatar]);
      }
      if (starRes) {
        setStarCount(newStarCount);
        setStarredByMe(newStarredByMe);
      }
      setBlockedByMe(newBlockedByMe);
      setBlockedMe(newBlockedMe);
      setLoading(false);

      profileCache.set(userId, {
        data: newData,
        starCount: newStarCount,
        starredByMe: newStarredByMe,
        blockedByMe: newBlockedByMe,
        blockedMe: newBlockedMe,
        ts: Date.now(),
      });
    },
    [userId, isMe]
  );

  useEffect(() => {
    if (!userId) return;
    setEditingBio(false);
    setProfileTab('posts');

    const cached = profileCache.get(userId);
    const isFresh = cached && Date.now() - cached.ts < PROFILE_CACHE_TTL_MS;
    if (!isFresh) {
      setData(null);
      setBlockedByMe(false);
      setBlockedMe(false);
    }
    loadProfileData();
  }, [userId, loadProfileData]);

  useEffect(() => {
    if (!isMe) return;
    setMyRoomLoading(true);
    getMyRoom()
      .then((res) => setMyRoom(res.data.room))
      .catch(() => setMyRoom(null))
      .finally(() => setMyRoomLoading(false));
  }, [isMe]);

  useEffect(() => {
    if (!isMe) return;
    listMyCommunities()
      .then((res) => setMyCommunitiesCount((res.data?.communities || []).length))
      .catch(() => setMyCommunitiesCount(0));
  }, [isMe]);

  // ---- Posts tab: is user ki apni posts, pagination ke sath ----
  const POSTS_PAGE = 10;
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const [postsHasMore, setPostsHasMore] = useState(true);
  const [openedPost, setOpenedPost] = useState<any>(null);
  const postsOffsetRef = useRef(0);
  const postsBusyRef = useRef(false);
  const postsUserRef = useRef<string | number | undefined>(undefined);
  const postsHasMoreRef = useRef(true);

  const fetchUserPosts = useCallback(
    async (reset: boolean) => {
      if (!userId) return;
      if (postsBusyRef.current && !reset) return;
      if (!reset && !postsHasMoreRef.current) return;
      postsBusyRef.current = true;
      const forUser = userId;
      postsUserRef.current = forUser;
      if (reset) {
        postsOffsetRef.current = 0;
        setPostsLoading(true);
      } else {
        setPostsLoadingMore(true);
      }
      try {
        const res = await getUserPosts(forUser, postsOffsetRef.current, POSTS_PAGE);
        if (postsUserRef.current !== forUser) return; // beech mein dusri profile khul gayi
        const batch: any[] = res.data?.posts || [];
        postsOffsetRef.current += batch.length;
        postsHasMoreRef.current = !!res.data?.has_more;
        setPostsHasMore(postsHasMoreRef.current);
        setUserPosts((prev) => {
          if (reset) return batch;
          const seen = new Set(prev.map((p) => String(p.id)));
          return [...prev, ...batch.filter((p) => !seen.has(String(p.id)))];
        });
      } catch (err) {
        // network error par list jaisi hai waisi rehne do, scroll par dobara try hoga
      } finally {
        postsBusyRef.current = false;
        setPostsLoading(false);
        setPostsLoadingMore(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) return;
    setUserPosts([]);
    setOpenedPost(null);
    postsHasMoreRef.current = true;
    setPostsHasMore(true);
    postsBusyRef.current = false;
    fetchUserPosts(true);
  }, [userId, fetchUserPosts]);

  // Scroll neeche ke paas pahunchte hi agla page.
  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (profileTab !== 'posts') return;
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 300) {
        fetchUserPosts(false);
      }
    },
    [profileTab, fetchUserPosts]
  );

  // Post detail true-fullscreen hai - Header/BottomNav chhupane ke liye layout ko batao.
  useEffect(() => {
    if (!active) return;
    setFullscreenOverlayOpen(!!openedPost);
    return () => setFullscreenOverlayOpen(false);
  }, [openedPost, active]);

  const handlePostLike = useCallback(async (postId: string | number) => {
    const flip = (p: any) =>
      String(p.id) === String(postId)
        ? { ...p, liked_by_me: !p.liked_by_me, likes_count: (p.likes_count || 0) + (p.liked_by_me ? -1 : 1) }
        : p;
    setUserPosts((prev) => prev.map(flip));
    setOpenedPost((prev: any) => (prev && String(prev.id) === String(postId) ? flip(prev) : prev));
    try {
      const res = await togglePostLike(postId);
      const sync = (p: any) => (String(p.id) === String(postId) ? { ...p, liked_by_me: !!res.data.liked, likes_count: res.data.likes } : p);
      setUserPosts((prev) => prev.map(sync));
      setOpenedPost((prev: any) => (prev && String(prev.id) === String(postId) ? sync(prev) : prev));
    } catch {
      setUserPosts((prev) => prev.map(flip)); // rollback
      setOpenedPost((prev: any) => (prev && String(prev.id) === String(postId) ? flip(prev) : prev));
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadProfileData(true), (async () => { postsHasMoreRef.current = true; await fetchUserPosts(true); })()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadProfileData, fetchUserPosts]);

  // Toast auto-hide (unmount par clear).
  useEffect(() => {
    if (!actionToast) return;
    const t = setTimeout(() => setActionToast(''), 3000);
    return () => clearTimeout(t);
  }, [actionToast]);

  if (!profile) return null;

  const patchProfileCache = (patch: Partial<ProfileCacheEntry>) => {
    if (!userId) return;
    const existing = profileCache.get(userId) || ({ ts: Date.now() } as ProfileCacheEntry);
    profileCache.set(userId, { ...existing, ...patch, ts: Date.now() });
  };

  const username = data?.username || profile.username || 'Unknown';
  const bio = data?.[FIELD.bio];
  const rank = data?.[FIELD.rank];
  const power = data?.[FIELD.power];
  const equippedItems = data?.[FIELD.equipped] || [];
  const activeSkillIds: (string | number)[] = data?.[FIELD.activeSkills] || [];
  const isVerified = !!data?.[FIELD.verified];
  const isElite = !!data?.[FIELD.elite];
  const avatarUrl = data?.[FIELD.avatar];

  const authHeaders = () => ({ headers: { Authorization: `Bearer ${getToken()}` } });

  const saveBio = async () => {
    setSavingBio(true);
    try {
      await axios.post(`${API_BASE}/profile/update-bio`, { bio: bioInput }, authHeaders());
      setData((prev: any) => {
        const next = { ...(prev || {}), [FIELD.bio]: bioInput };
        patchProfileCache({ data: next });
        return next;
      });
      setEditingBio(false);
    } catch (err: any) {
      console.error('Bio update error:', err.response?.data || err.message);
      showAlert(err.response?.data?.detail || "Couldn't update bio.");
    } finally {
      setSavingBio(false);
    }
  };

  const handlePhotoUpload = async () => {
    if (uploadingPhoto) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
    });
    if (picked.canceled || !picked.assets?.[0]?.uri) return;

    setUploadingPhoto(true);
    try {
      const original = picked.assets[0].uri;
      // Compress fail ho to original hi bhej do (web jaisa fallback).
      const compressed = await compressImage(original).catch(() => null);
      const part = compressed
        ? toUploadFormPart(compressed)
        : ({ uri: original, name: 'photo.jpg', type: 'image/jpeg' } as any);

      const formData = new FormData();
      formData.append('file', part);
      const res = await axios.post(`${API_BASE}/profile/upload-photo`, formData, authHeaders());
      setData((prev: any) => {
        const next = { ...(prev || {}), [FIELD.avatar]: res.data.avatar_url };
        patchProfileCache({ data: next });
        return next;
      });
      if (isMe) setMyAvatarUrl(res.data.avatar_url);
    } catch (err: any) {
      console.error('Photo upload error:', err.response?.data || err.message);
      showAlert(err.response?.data?.detail || "Couldn't upload photo, try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  // "Edit Profile Photo" ke corner pe chhota "x" - sirf tab dikhta hai jab
  // custom photo lagi ho (avatarUrl set hai). Backend: POST /profile/remove-photo.
  const handleRemovePhoto = async () => {
    if (uploadingPhoto) return;
    const ok = await confirmAction({
      title: 'Remove profile photo?',
      message: "You'll go back to the default avatar.",
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;

    setUploadingPhoto(true);
    try {
      await axios.post(`${API_BASE}/profile/remove-photo`, null, authHeaders());
      setData((prev: any) => {
        const next = { ...(prev || {}), [FIELD.avatar]: null };
        patchProfileCache({ data: next });
        return next;
      });
      // Header ki pfp turant default par + client storage se apni purani
      // cached pfp entry bhi hata do.
      setMyAvatarUrl(null);
      if (userId) invalidateAvatar(userId);
    } catch (err: any) {
      console.error('Photo remove error:', err.response?.data || err.message);
      showAlert(err.response?.data?.detail || "Couldn't remove photo, try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const toggleStar = async () => {
    if (isMe || starLoading || !userId) return;
    setStarLoading(true);

    const prevStarred = starredByMe;
    const prevCount = starCount;
    setStarredByMe(!prevStarred);
    setStarCount((c) => c + (prevStarred ? -1 : 1));

    try {
      const res = await axios.post(`${API_BASE}/profile/${userId}/star`, {}, authHeaders());
      const newStarred = !!res.data?.starred;
      const newCount = res.data?.count ?? prevCount;
      setStarredByMe(newStarred);
      setStarCount(newCount);
      patchProfileCache({ starredByMe: newStarred, starCount: newCount });
    } catch (err: any) {
      console.error('Star toggle error:', err.response?.data || err.message);
      setStarredByMe(prevStarred);
      setStarCount(prevCount);
      patchProfileCache({ starredByMe: prevStarred, starCount: prevCount });
    } finally {
      setStarLoading(false);
    }
  };

  const handleUnblock = async () => {
    if (unblocking) return;
    setUnblocking(true);
    try {
      await axios.post(`${API_BASE}/profile/unblock`, { target_id: userId }, authHeaders());
      setBlockedByMe(false);
      patchProfileCache({ blockedByMe: false });
      setActionToast('User has been unblocked.');
    } catch (err: any) {
      console.error('Unblock error:', err.response?.data || err.message);
      setActionToast(err.response?.data?.detail || "Couldn't unblock.");
    } finally {
      setUnblocking(false);
    }
  };

  return (
    <MotiView
      from={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 180 }}
      style={[
        styles.screen,
        {
          zIndex,
          elevation: 20,
          bottom: embedded ? 0 : getBottomNavTotal(insets.bottom),
          paddingTop: insets.top,
        },
      ]}
    >
      {/* Header - static, kabhi scroll/translate nahi hota */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={onClose} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={16} color="#ffffff" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          {isMe && (
            <Pressable onPress={() => onOpenSettings?.(username)} style={styles.iconBtn} accessibilityLabel="Settings">
              <Ionicons name="settings-outline" size={16} color="#ffffff" />
            </Pressable>
          )}
        </View>
        <Text style={styles.headerTitle}>Profile</Text>
        {!isMe ? (
          <View style={styles.headerRight}>
            {blockedByMe ? (
              <Pressable onPress={handleUnblock} disabled={unblocking} style={[styles.iconBtn, unblocking && { opacity: 0.5 }]} accessibilityLabel="Unblock">
                {unblocking ? <Text style={styles.white}>…</Text> : <Ionicons name="checkmark" size={16} color="#ffffff" />}
              </Pressable>
            ) : (
              <Pressable onPress={() => setReportBlockMode('block')} style={styles.iconBtn} accessibilityLabel="Block">
                <Ionicons name="ban-outline" size={16} color="#ffffff" />
              </Pressable>
            )}
            <Pressable onPress={() => setReportBlockMode('report')} style={styles.iconBtn} accessibilityLabel="Report">
              <Ionicons name="warning-outline" size={16} color="#ffffff" />
            </Pressable>
          </View>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        onScroll={handleScroll}
        scrollEventThrottle={200}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#a3a3a3" colors={['#6366f1']} progressBackgroundColor="#161616" />}
      >
        <View style={styles.top}>
          <ProfileCard username={username} size="lg" equippedItems={equippedItems} itemsById={itemsById as any} photoUrl={avatarUrl} />

          <View style={styles.nameRow}>
            <Text style={styles.name}>{username}</Text>
            {isVerified && <VerifiedBadge size="lg" />}
            {isElite && <EliteBadge size="lg" />}
          </View>

          {activeSkillIds.length > 0 && (
            <View style={styles.skillsWrap}>
              {activeSkillIds.map((skillId) => {
                const skill = (skillsById as any)[skillId];
                if (!skill) return null;
                return (
                  <View key={String(skillId)} style={styles.skillChip}>
                    <View style={styles.skillIcon}>
                      <Ionicons name="flash-outline" size={11} color="#818cf8" />
                    </View>
                    <Text style={styles.skillText}>{skill.name}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Bio */}
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="person-outline" size={16} color="#a3a3a3" />
                <Text style={styles.cardTitle}>Bio</Text>
              </View>
              {isMe && !editingBio && (
                <Pressable
                  onPress={() => {
                    setBioInput(bio || '');
                    setEditingBio(true);
                  }}
                  style={styles.smallRound}
                  accessibilityLabel="Edit Bio"
                >
                  <Ionicons name="create-outline" size={13} color="#ffffff" />
                </Pressable>
              )}
            </View>
            {editingBio ? (
              <View style={{ gap: 8 }}>
                <TextInput
                  autoFocus
                  multiline
                  numberOfLines={3}
                  value={bioInput}
                  onChangeText={setBioInput}
                  maxLength={300}
                  placeholder="Write something about yourself..."
                  placeholderTextColor="#6e6e6e"
                  style={styles.bioInput}
                />
                <View style={styles.bioBtns}>
                  <Pressable onPress={() => setEditingBio(false)} style={[styles.bioBtn, { backgroundColor: '#262626' }]}>
                    <Text style={styles.bioBtnText}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={saveBio} disabled={savingBio} style={[styles.bioBtn, { backgroundColor: '#16a34a' }, savingBio && { opacity: 0.5 }]}>
                    <Text style={[styles.bioBtnText, { fontWeight: '700' }]}>{savingBio ? 'Saving...' : 'Save'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Text style={styles.bioText}>{bio || (isMe ? 'No bio set yet.' : "This user hasn't written a bio yet.")}</Text>
            )}
          </View>

          {/* Rank / Power / Stars */}
          <View style={[styles.card, styles.statsCard]}>
            <View style={styles.statCell}>
              <View style={styles.statLabelRow}>
                <Ionicons name="star-outline" size={12} color="#a3a3a3" />
                <Text style={styles.statLabel}>Rank</Text>
              </View>
              {rank != null ? <RankBadge rank={rank} size="sm" /> : <Text style={styles.statDash}>—</Text>}
            </View>
            <View style={[styles.statCell, styles.statDivider]}>
              <View style={styles.statLabelRow}>
                <Ionicons name="flash-outline" size={12} color="#a3a3a3" />
                <Text style={styles.statLabel}>Power</Text>
              </View>
              <Text style={[styles.statValue, styles.powerGlow]}>{power ?? '—'}</Text>
            </View>
            <Pressable onPress={toggleStar} disabled={isMe || starLoading} style={[styles.statCell, styles.statDivider]} accessibilityLabel={isMe ? "Can't self star" : starredByMe ? 'Tap to un-star' : 'Tap to star'}>
              <View style={styles.statLabelRow}>
                <Ionicons name="people-outline" size={12} color="#a3a3a3" />
                <Text style={styles.statLabel}>Stars</Text>
              </View>
              <View style={styles.statLabelRow}>
                <Ionicons name={starredByMe ? 'star' : 'star-outline'} size={14} color={starredByMe ? '#facc15' : '#ffffff'} />
                <Text style={[styles.statValue, starredByMe && { color: '#facc15' }]}>{starCount}</Text>
              </View>
            </Pressable>
          </View>

          {/* Community - sirf apni profile */}
          {isMe && (
            <Pressable onPress={() => onOpenMyCommunities?.()} style={[styles.card, styles.linkCard]}>
              <View style={styles.linkLeft}>
                <View style={styles.linkIcon}>
                  <Ionicons name="people-outline" size={18} color="#ffffff" />
                </View>
                <View>
                  <Text style={styles.linkSmall}>Community</Text>
                  <Text style={styles.linkBig}>{myCommunitiesCount} Joined</Text>
                </View>
              </View>
              <View style={styles.openRow}>
                <Text style={styles.openText}>Open</Text>
                <Ionicons name="arrow-forward" size={14} color="#818cf8" />
              </View>
            </Pressable>
          )}

          {/* My room */}
          {isMe && !myRoomLoading && (
            <View style={styles.roomWrap}>
              {myRoom ? (
                <View>
                  <Pressable onPress={() => onOpenRoom?.(myRoom)} style={[styles.card, styles.linkCard, { marginTop: 0, padding: 12 }]}>
                    <View style={styles.linkLeft}>
                      {!!myRoom.room_icon_url && <Image source={{ uri: myRoom.room_icon_url }} style={styles.roomIcon} />}
                      <View>
                        <Text style={styles.linkSmall}>Your Room</Text>
                        <Text style={styles.linkBig}>{myRoom.room_name}</Text>
                      </View>
                    </View>
                    <View style={styles.openRow}>
                      <Text style={styles.openText}>Open</Text>
                      <Ionicons name="arrow-forward" size={14} color="#818cf8" />
                    </View>
                  </Pressable>
                  <Pressable onPress={() => setShowEditRoom(true)} style={styles.roomEditBtn} accessibilityLabel="Edit room">
                    <Ionicons name="create-outline" size={13} color="#e5e5e5" />
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => setShowCreateRoom(true)} style={styles.createRoomBtn}>
                  <Text style={styles.createRoomText}>+ Create Room</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Edit Avatar / Photo / Skills */}
          {isMe && (
            <View style={styles.actionsRow}>
              <Pressable onPress={() => setShowCustomize(true)} style={styles.actionCell}>
                <View style={styles.actionIcon}>
                  <Ionicons name="color-palette-outline" size={18} color="#ffffff" />
                </View>
                <Text style={styles.actionLabel}>Edit Avatar</Text>
              </Pressable>
              <Pressable onPress={handlePhotoUpload} disabled={uploadingPhoto} style={[styles.actionCell, styles.actionDivider, uploadingPhoto && { opacity: 0.5 }]}>
                <View>
                  <View style={styles.actionIcon}>
                    <Ionicons name="camera-outline" size={18} color="#ffffff" />
                  </View>
                  {/* Custom photo lagi ho tabhi "x" dikhao - default avatar
                      par remove karne ko kuch hota hi nahi. */}
                  {!!avatarUrl && (
                    <Pressable
                      onPress={handleRemovePhoto}
                      disabled={uploadingPhoto}
                      hitSlop={8}
                      accessibilityLabel="Remove photo"
                      style={styles.removePhotoBadge}
                    >
                      <Ionicons name="close" size={11} color="#ffffff" />
                    </Pressable>
                  )}
                </View>
                <Text style={styles.actionLabel}>Edit Profile Photo</Text>
              </Pressable>
              <Pressable onPress={() => setShowEditSkills(true)} style={[styles.actionCell, styles.actionDivider]}>
                <View style={styles.actionIcon}>
                  <Ionicons name="flash-outline" size={18} color="#ffffff" />
                </View>
                <Text style={styles.actionLabel}>Edit Skills</Text>
              </Pressable>
            </View>
          )}

          {!isMe &&
            (blockedMe ? (
              <Text style={styles.blockedText}>This User has blocked you.</Text>
            ) : (
              <>
                <Pressable onPress={() => onMessageClick(profile)} style={styles.msgBtn}>
                  <Text style={styles.msgBtnText}>Send Message</Text>
                </Pressable>

                {data?.current_room && (
                  <Pressable onPress={() => onOpenRoom?.(data.current_room)} style={[styles.card, styles.linkCard, { padding: 12 }]}>
                    <View>
                      <Text style={styles.linkSmall}>Online in this room</Text>
                      <View style={styles.roomNameRow}>
                        <Ionicons name="home-outline" size={14} color="#ffffff" />
                        <Text style={styles.linkBig}>{data.current_room.room_name}</Text>
                      </View>
                    </View>
                    <View style={styles.openRow}>
                      <Text style={styles.openText}>Join</Text>
                      <Ionicons name="arrow-forward" size={14} color="#818cf8" />
                    </View>
                  </Pressable>
                )}
              </>
            ))}
        </View>

        {/* Posts / Store tabs */}
        <View style={styles.bottom}>
          <View style={styles.tabs}>
            {(['posts', 'store'] as const).map((tab) => (
              <Pressable key={tab} onPress={() => setProfileTab(tab)} style={[styles.tab, profileTab === tab && styles.tabActive]}>
                <Text style={[styles.tabText, profileTab === tab && { color: '#ffffff' }]}>{tab === 'posts' ? 'Posts' : 'Store'}</Text>
              </Pressable>
            ))}
          </View>

          {profileTab === 'posts' ? (
            postsLoading && userPosts.length === 0 ? (
              <ActivityIndicator color="#a3a3a3" style={{ marginVertical: 16 }} />
            ) : userPosts.length === 0 ? (
              <Text style={styles.muted}>{isMe ? 'You have not created any posts yet.' : 'User has not created any posts.'}</Text>
            ) : (
              <View style={{ gap: 12 }}>
                {userPosts.map((post) => (
                  <Pressable key={post.id} onPress={() => { onOpenPost ? onOpenPost(post) : setOpenedPost(post); }} style={({ pressed }) => [styles.postCard, pressed && { backgroundColor: '#262626' }]}>
                    {!!post.hashtag && (
                      <Pressable onPress={() => onOpenHashtag?.(post.hashtag)} style={styles.hashChip}>
                        <Ionicons name="pricetag-outline" size={10} color="#818cf8" />
                        <Text style={styles.hashText}>{post.hashtag}</Text>
                      </Pressable>
                    )}
                    <Text style={styles.postText}>{renderWithMentions(post.content, null, onOpenCommunity)}</Text>
                    {!!post.image_url && (
                      <Image source={{ uri: post.image_url }} style={styles.postImage} resizeMode="cover" />
                    )}
                    <View style={styles.postMeta}>
                      <Ionicons name={post.liked_by_me ? 'heart' : 'heart-outline'} size={14} color={post.liked_by_me ? '#f43f5e' : '#737373'} />
                      <Text style={styles.postMetaText}>{post.likes_count || 0}</Text>
                      <Ionicons name="chatbubble-outline" size={13} color="#737373" style={{ marginLeft: 12 }} />
                      <Text style={styles.postMetaText}>{post.comments_count || 0}</Text>
                    </View>
                  </Pressable>
                ))}
                {postsLoadingMore && <ActivityIndicator color="#a3a3a3" style={{ marginVertical: 12 }} />}
              </View>
            )
          ) : (
            <UserShopPanel
              userId={userId}
              username={username}
              isMe={isMe}
              itemsById={itemsById as any}
              onOpenHashtag={onOpenHashtag}
              onSendMessage={(itemInfo) => {
                const label = itemInfo?.item_name ? `is this ${itemInfo.item_name} available?` : 'is this item available?';
                onOpenChatWithDraft?.({ id: userId, username }, label);
              }}
            />
          )}
        </View>
      </ScrollView>
      
      <PostDetailModal
        topInset={insets.top + 12}
        post={openedPost}
        onClose={() => setOpenedPost(null)}
        onToggleLike={handlePostLike}
        onPostDeleted={(id) => {
          setUserPosts((prev) => prev.filter((p) => String(p.id) !== String(id)));
          setOpenedPost(null);
        }}
        onOpenProfile={(u) => {
          if (String(u.id) !== String(userId)) requestOpenProfile(u as any);
        }}
        onOpenCommunity={(id) => requestOpenCommunityById({ id } as any)}
        onOpenCommunityBySlug={(slug, name) => requestOpenCommunityBySlug(slug, name)}
      />

      {!!actionToast && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{actionToast}</Text>
        </View>
      )}

      {showCustomize && (
        <AvatarCustomizeModal
          currentEquippedIds={equippedItems}
          photoUrl={avatarUrl}
          onClose={() => setShowCustomize(false)}
          onSaved={({ equippedIds }) => {
            setData((prev: any) => {
              const next = { ...(prev || {}), [FIELD.equipped]: equippedIds };
              patchProfileCache({ data: next });
              return next;
            });
          }}
        />
      )}

      {showEditSkills && (
        <EditSkillsModal
          currentActiveIds={activeSkillIds}
          onClose={() => setShowEditSkills(false)}
          onSaved={(newIds) => {
            setData((prev: any) => {
              const next = { ...(prev || {}), [FIELD.activeSkills]: newIds };
              patchProfileCache({ data: next });
              return next;
            });
          }}
        />
      )}

      <ReportBlockModal
        mode={reportBlockMode as any}
        target={reportBlockMode ? { id: userId, username } : null}
        onClose={() => setReportBlockMode(null)}
        onDone={(mode) => {
          if (mode === 'block') {
            setBlockedByMe(true);
            patchProfileCache({ blockedByMe: true });
          }
          setActionToast(mode === 'block' ? 'User Blocked.' : 'Report Submitted successfully, Thank You.');
        }}
      />

      <CreateRoomModal
        show={showCreateRoom}
        onClose={() => setShowCreateRoom(false)}
        onCreated={(room: any) => {
          setMyRoom(room);
          setShowCreateRoom(false);
        }}
      />

      <EditRoomModal
        show={showEditRoom}
        room={myRoom}
        isPrivileged={isVerified || isElite}
        onClose={() => setShowEditRoom(false)}
        onSaved={(patch: any) => setMyRoom((prev: any) => (prev ? { ...prev, ...patch } : prev))}
      />

      {uploadingPhoto && (
        <View style={styles.uploadOverlay}>
          <ActivityIndicator size="large" color="#818cf8" />
          <Text style={styles.uploadText}>Uploading photo...</Text>
        </View>
      )}
    </MotiView>
  );
};

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  white: { color: '#ffffff' },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
    backgroundColor: '#0a0a0a',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: '#ffffff' },
  headerTitle: { color: '#ffffff', fontWeight: '700', fontSize: 18 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626', alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingBottom: 32 },
  top: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 16 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  name: { color: '#ffffff', fontSize: 24, fontWeight: '700' },
  skillsWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 16, maxWidth: 384 },
  skillChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626' },
  skillIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(99,102,241,0.15)', alignItems: 'center', justifyContent: 'center' },
  skillText: { fontSize: 12, fontWeight: '700', color: '#f5f5f5' },
  card: { marginTop: 12, width: '100%', maxWidth: 384, backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626', borderRadius: 16, padding: 16 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#f5f5f5' },
  smallRound: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center' },
  bioText: { color: '#d4d4d4', fontSize: 14 },
  bioInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#262626', borderRadius: 8, padding: 8, fontSize: 14, color: '#ffffff', minHeight: 72, textAlignVertical: 'top' },
  bioBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  bioBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999 },
  bioBtnText: { color: '#ffffff', fontSize: 14 },
  statsCard: { flexDirection: 'row', paddingHorizontal: 0, paddingVertical: 16 },
  statCell: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 8 },
  statDivider: { borderLeftWidth: 1, borderLeftColor: '#262626' },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 12, color: '#a3a3a3' },
  statDash: { color: '#6e6e6e', fontWeight: '700' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  powerGlow: { textShadowColor: '#818cf8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  linkCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center' },
  linkSmall: { fontSize: 12, color: '#a3a3a3' },
  linkBig: { fontWeight: '700', color: '#ffffff' },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  openText: { fontSize: 14, color: '#818cf8' },
  roomNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomWrap: { marginTop: 12, width: '100%', maxWidth: 384 },
  roomIcon: { width: 36, height: 36, borderRadius: 8 },
  roomEditBtn: { position: 'absolute', top: -8, left: -8, width: 28, height: 28, borderRadius: 14, backgroundColor: '#262626', borderWidth: 1, borderColor: '#404040', alignItems: 'center', justifyContent: 'center' },
  createRoomBtn: { backgroundColor: '#4f46e5', paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  createRoomText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
  actionsRow: { flexDirection: 'row', marginTop: 16, width: '100%', maxWidth: 384 },
  actionCell: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 8 },
  actionDivider: { borderLeftWidth: 1, borderLeftColor: '#161616' },
  actionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626', alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 12, color: '#d4d4d4', textAlign: 'center' },
  removePhotoBadge: { position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#dc2626', borderWidth: 1, borderColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  blockedText: { marginTop: 24, fontSize: 14, color: '#6e6e6e' },
  msgBtn: { marginTop: 24, backgroundColor: '#16a34a', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  msgBtnText: { color: '#ffffff', fontWeight: '700' },
  bottom: { paddingHorizontal: 16 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16, backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626', borderRadius: 999, padding: 4, alignSelf: 'flex-start' },
  tab: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999 },
  tabActive: { backgroundColor: '#4f46e5' },
  tabText: { fontSize: 14, fontWeight: '700', color: '#a3a3a3' },
  muted: { color: '#6e6e6e', fontSize: 14 },
  postCard: { backgroundColor: '#161616', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#262626' },
  hashChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(79,70,229,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginBottom: 6 },
  hashText: { color: '#818cf8', fontSize: 12, fontWeight: '700' },
  postText: { color: '#f5f5f5', fontSize: 14 },
  postImage: { width: '100%', height: 180, borderRadius: 10, marginTop: 8, backgroundColor: '#0f0f0f' },
  postMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  postMetaText: { color: '#737373', fontSize: 12 },
  toast: { position: 'absolute', top: 120, alignSelf: 'center', backgroundColor: '#161616', borderWidth: 1, borderColor: '#262626', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, maxWidth: '90%', zIndex: 20, elevation: 6 },
  toastText: { color: '#ffffff', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  uploadOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', gap: 12, zIndex: 200, elevation: 40 },
  uploadText: { fontSize: 14, fontWeight: '600', color: '#e5e5e5' },
});

export default memo(ProfileViewModal);