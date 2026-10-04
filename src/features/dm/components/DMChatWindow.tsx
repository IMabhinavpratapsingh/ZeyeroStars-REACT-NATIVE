import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MotiView } from 'moti';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Animated, { useAnimatedKeyboard, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import CurrencyIcon from '../../../shared/components/CurrencyIcon';
import SwipeableBubble from '../../../shared/components/SwipeableBubble';
import VerifiedBadge from '../../../shared/components/VerifiedBadge';
import EliteBadge from '../../../shared/components/EliteBadge';
import LongPressActionSheet from '../../../shared/components/LongPressActionSheet';
import ReportBlockModal from './ReportBlockModal';
import EmojiPanel from './EmojiPanel';
import KebabMenu, { type KebabMenuHandle } from '../../../shared/components/KebabMenu';
import usePresence from '../../../shared/hooks/usePresence';
import TradeModal from '../../trade/components/TradeModal';
import useAvatarImage from '../../avatar/hooks/useAvatarImage';
import useRankCache from '../../../shared/hooks/useRankCache';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import useLongPress, { type LongPressPosition } from '../../../shared/hooks/useLongPress';
import networkManager from '../../../shared/services/NetworkManager';
import { renderWithMentions } from '../../../shared/utils/renderMentions';
import useDMWallpaper from '../services/dmWallpaper';
import WallpaperCropModal from './WallpaperCropModal';

/**
 * DM chat window (1-on-1). Trade yahin ke andar hoti hai (header ka
 * "Trade" button) - profile se nahi.
 *
 * Props ka matlab web jaisa hi hai:
 * - activeTrade: Dashboard ka global trade state; sirf tab inline panel
 *   dikhta hai jab activeTrade.otherId === selectedDM.id.
 * - outgoingTradeWaiting: { trade_id, to_id } | null
 * - requestLock: null | "pending_sent" | "pending_incoming" | "denied" |
 *   "declined_by_me" (message-request lock, Dashboard compute karke deta hai)
 *
 * WEB -> RN CHANGES:
 * - `useViewportKeyboard` + locked-height hack hata diya -> KeyboardAvoidingView
 *   (iOS: padding; Android: OS khud resize karta hai / adjustResize).
 * - `motion/react` -> `moti` MotiView.
 * - scrollable div -> FlatList. Purane messages prepend hone par scroll
 *   position manual (scrollHeight diff) ki jagah `maintainVisibleContentPosition`
 *   se preserve hoti hai. Initial load -> scrollToEnd (no animation),
 *   naya message -> animated scrollToEnd, prepend -> kuch nahi.
 * - Tailwind animate-bounce/pulse -> chhote MotiView loops.
 * - textarea (edit) -> multiline TextInput; Enter-to-save nahi (mobile pe
 *   Enter = new line), Save button hi hai.
 * - `window.setTimeout` toast -> ref-based timer, unmount par clear.
 */

const formatBubbleTime = (iso?: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const dayKey = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const formatDayLabel = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

const DatePill = ({ label }: { label: string }) => (
  <View style={styles.datePillWrap}>
    <View style={styles.datePill}>
      <Text style={styles.datePillText}>{label}</Text>
    </View>
  </View>
);

const TypingDots = ({ color = '#d4d4d4' }: { color?: string }) => (
  <View style={styles.dotsRow}>
    {[0, 1, 2].map((i) => (
      <MotiView
        key={i}
        from={{ translateY: 0 }}
        animate={{ translateY: -4 }}
        transition={{ type: 'timing', duration: 350, loop: true, repeatReverse: true, delay: i * 130 }}
        style={[styles.dot, { backgroundColor: color }]}
      />
    ))}
  </View>
);

const SkeletonBubble = ({ index }: { index: number }) => (
  <View style={[styles.skelRow, { justifyContent: index % 2 === 0 ? 'flex-start' : 'flex-end' }]}>
    <MotiView
      from={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'timing', duration: 800, loop: true, repeatReverse: true }}
      style={[styles.skelBubble, { width: `${40 + ((index * 13) % 35)}%` }]}
    />
  </View>
);

interface DMMessageBubbleProps {
  msg: any;
  mine: boolean;
  dateLabel?: string | null;
  showAvatar?: boolean;
  avatarUri?: string | null;
  avatarLetter?: string;
  onDelete: () => void;
  onEdit: (content: string) => void;
  onTip: () => void;
  onReply: () => void;
  onReport: () => void;
  onRetry?: () => void;
  onOpenProfile?: () => void;
  onOpenCommunity?: (slug: string, name: string) => void;
  /** Agar yeh message kisi ka reply hai: quoted block (message ke upar) ka data. */
  replyInfo?: { name: string; text: string; missing: boolean } | null;
}

const DMMessageBubble = memo(
  ({ msg, mine, dateLabel, showAvatar, avatarUri, avatarLetter, onDelete, onEdit, onTip, onReply, onReport, onRetry, onOpenProfile, onOpenCommunity, replyInfo }: DMMessageBubbleProps) => {
    const bubbleTime = formatBubbleTime(msg.created_at);
    const [editing, setEditing] = useState(false);
    const [editText, setEditText] = useState(msg.content);
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<LongPressPosition | null>(null);
    const [photoViewer, setPhotoViewer] = useState(false);
    const isPhoto = !!msg.is_photo;

    const { pressableProps } = useLongPress(
      (pt) => {
        setMenuAnchor(pt);
        setMenuOpen(true);
      },
      { disabled: !msg.id || editing }
    );

    const startEdit = () => {
      setEditText(msg.content);
      setEditing(true);
    };
    const cancelEdit = () => setEditing(false);
    const saveEdit = () => {
      const trimmed = (editText || '').trim();
      if (!trimmed || trimmed === msg.content) {
        setEditing(false);
        return;
      }
      onEdit(trimmed);
      setEditing(false);
    };

    if (msg.isTip) {
      return (
        <View>
          {!!dateLabel && <DatePill label={dateLabel} />}
          <View style={styles.tipWrap}>
            <View style={styles.tipPill}>
              <CurrencyIcon type="zmoney" size={11} />
              <Text style={styles.tipText}>{msg.content}</Text>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View>
        {!!dateLabel && <DatePill label={dateLabel} />}
        <View style={styles.msgRow}>
          {!mine && (
            <View style={styles.sideAvatarSlot}>
              {showAvatar && (
                <Pressable onPress={onOpenProfile} hitSlop={6} style={styles.sideAvatar}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.fill} />
                  ) : (
                    <Text style={styles.sideAvatarText}>{avatarLetter || '?'}</Text>
                  )}
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.flex}>
            <SwipeableBubble align={mine ? 'end' : 'start'} onReply={onReply}>
              <View style={[styles.msgCol, mine ? styles.alignEnd : styles.alignStart]}>
                {editing ? (
                  <View style={styles.editWrap}>
                    <TextInput
                      autoFocus
                      multiline
                      value={editText}
                      onChangeText={setEditText}
                      style={styles.editInput}
                      placeholderTextColor="#737373"
                    />
                    <View style={styles.editBtns}>
                      <Pressable onPress={cancelEdit} style={[styles.editBtn, { backgroundColor: '#262626' }]}>
                        <Ionicons name="close" size={13} color="#ffffff" />
                        <Text style={styles.editBtnText}>Cancel</Text>
                      </Pressable>
                      <Pressable onPress={saveEdit} style={[styles.editBtn, { backgroundColor: '#4f46e5' }]}>
                        <Ionicons name="checkmark" size={13} color="#ffffff" />
                        <Text style={styles.editBtnText}>Save</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    {...pressableProps}
                    style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs, isPhoto && styles.bubblePhoto]}
                  >
                    {/* Reply: jis message ka jawab hai woh bubble ke UPAR (Telegram/Instagram jaisa) */}
                    {!!replyInfo && (
                      <View style={[styles.quote, mine ? styles.quoteMine : styles.quoteTheirs]}>
                        <Text style={[styles.quoteName, mine && styles.quoteNameMine]} numberOfLines={1}>
                          {replyInfo.name}
                        </Text>
                        <Text
                          style={[styles.quoteText, mine && styles.quoteTextMine, replyInfo.missing && styles.quoteMissing]}
                          numberOfLines={2}
                        >
                          {replyInfo.text}
                        </Text>
                      </View>
                    )}

                    {isPhoto && (
                      <Pressable onPress={() => !msg.uploading && setPhotoViewer(true)} style={styles.photoWrap}>
                        <ExpoImage
                          source={{ uri: msg.is_photo }}
                          style={styles.photoImg}
                          contentFit="cover"
                          transition={120}
                          cachePolicy="memory-disk"
                        />
                        {!!msg.uploading && (
                          <View style={styles.photoOverlay}>
                            <ActivityIndicator color="#ffffff" />
                          </View>
                        )}
                      </Pressable>
                    )}

                    {!!msg.content && (
                      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                        {renderWithMentions(msg.content, null, onOpenCommunity)}
                      </Text>
                    )}

                    {/* Time + status bubble ke ANDAR, neeche-right (Telegram/WhatsApp jaisa) */}
                    <View style={[styles.metaRow, isPhoto && styles.metaRowPhoto]}>
                      {msg.edited && <Text style={[styles.metaText, mine && styles.metaTextMine]}>edited</Text>}
                      {!!bubbleTime && <Text style={[styles.metaText, mine && styles.metaTextMine]}>{bubbleTime}</Text>}
                      {mine &&
                        (msg.failed ? (
                          <Pressable onPress={onRetry} hitSlop={8} style={styles.failedRow}>
                            <Text style={styles.failedText}>Not sent · tap to retry</Text>
                            <Ionicons name="alert-circle" size={14} color="#dc2626" />
                          </Pressable>
                        ) : !msg.id ? (
                          <Ionicons name="time-outline" size={12} color="#6b7280" />
                        ) : msg.seen ? (
                          <Ionicons name="checkmark-done-outline" size={14} color="#2563eb" />
                        ) : (
                          <Ionicons name="checkmark" size={13} color="#6b7280" />
                        ))}
                    </View>
                  </Pressable>
                )}
              </View>

              <LongPressActionSheet
                open={menuOpen}
                anchor={menuAnchor}
                onClose={() => setMenuOpen(false)}
                items={
                  mine
                    ? [
                        { label: 'Reply', icon: <Ionicons name="arrow-undo-outline" size={16} color="#ffffff" />, onClick: onReply },
                        ...(isPhoto ? [] : [{ label: 'Edit', icon: <Ionicons name="pencil-outline" size={16} color="#ffffff" />, onClick: startEdit }]),
                        { label: 'Delete', icon: <Ionicons name="trash-outline" size={16} color="#f87171" />, danger: true, onClick: onDelete },
                      ]
                    : [
                        { label: 'Reply', icon: <Ionicons name="arrow-undo-outline" size={16} color="#ffffff" />, onClick: onReply },
                        { label: 'Tip', icon: <CurrencyIcon type="zmoney" size={16} />, onClick: onTip },
                        { label: 'Report', icon: <Ionicons name="warning-outline" size={16} color="#f87171" />, danger: true, onClick: onReport },
                      ]
                }
              />

              {isPhoto && (
                <Modal visible={photoViewer} transparent animationType="fade" onRequestClose={() => setPhotoViewer(false)} statusBarTranslucent>
                  <Pressable style={styles.viewerBg} onPress={() => setPhotoViewer(false)}>
                    <ExpoImage source={{ uri: msg.is_photo }} style={styles.viewerImg} contentFit="contain" />
                    <Pressable style={styles.viewerClose} onPress={() => setPhotoViewer(false)} hitSlop={12}>
                      <Ionicons name="close" size={24} color="#ffffff" />
                    </Pressable>
                  </Pressable>
                </Modal>
              )}
            </SwipeableBubble>
          </View>
        </View>
      </View>
    );
  }
);
DMMessageBubble.displayName = 'DMMessageBubble';

interface DMChatWindowProps {
  selectedDM: any | null;
  chatMessages: any[];
  loading?: boolean;
  hasMoreMessages?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onSend: (text: string, replyingTo?: string | number | null) => void;
  onSendPhoto?: (uri: string, replyingTo?: string | number | null) => void;
  isOtherTyping?: boolean;
  onClose: () => void;
  getMyId: () => string | number | null;
  onDeleteMessage: (id: string | number) => void;
  onEditMessage: (id: string | number, content: string) => void;
  onRetryMessage?: (msg: any) => void;
  onOpenProfile?: (user: { id: string | number; username?: string }) => void;
  onTip: (target: { id: string | number; username?: string }, extra: any) => void;
  onOpenCommunity?: (slug: string, name: string) => void;
  activeTrade?: any;
  outgoingTradeWaiting?: any;
  myBalance?: { z_money?: number } | null;
  onTradeRequest?: (dm: any) => void;
  onCancelOutgoingTradeRequest?: () => void;
  onUpdateTradeOffer?: (items: Record<string, number>, zMoney: number) => void;
  onConfirmTrade?: () => void;
  onCancelTrade?: () => void;
  initialDraft?: string;
  requestLock?: 'pending_sent' | 'pending_incoming' | 'denied' | 'declined_by_me' | null;
  onAcceptRequest?: () => void;
  onDeclineRequest?: () => void;
}

const DMChatWindow = ({
  selectedDM,
  chatMessages,
  loading,
  hasMoreMessages,
  loadingMore,
  onLoadMore,
  onSend,
  onSendPhoto,
  isOtherTyping,
  onClose,
  getMyId,
  onDeleteMessage,
  onEditMessage,
  onRetryMessage,
  onOpenProfile,
  onTip,
  onOpenCommunity,
  activeTrade,
  outgoingTradeWaiting,
  myBalance,
  onTradeRequest,
  onCancelOutgoingTradeRequest,
  onUpdateTradeOffer,
  onConfirmTrade,
  onCancelTrade,
  initialDraft,
  requestLock = null,
  onAcceptRequest,
  onDeclineRequest,
}: DMChatWindowProps) => {
  const zIndex = useTopZIndex(selectedDM);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList>(null);
  const userScrolledRef = useRef(false);
  const contentHRef = useRef(0);
  const layoutHRef = useRef(0);
  const [tradePanelExpanded, setTradePanelExpanded] = useState(true);
  const [reportState, setReportState] = useState<{ mode: any; target: any } | null>(null);
  const [actionToast, setActionToast] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { verifieds, elites, avatars, ensureRank } = useRankCache();

  // Input + typing state LOCAL hai - keystroke par Dashboard re-render nahi hota.
  const [msgInput, setMsgInput] = useState('');
  // Jis message ka reply likh rahe hain (input ke upar preview bar mein dikhta hai).
  const [replyTarget, setReplyTarget] = useState<{ id: string | number; name: string; content: string } | null>(null);
  const dmTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dmTypingSentRef = useRef(false);

  const dmTargetId = selectedDM?.id || selectedDM?.target_id;

  // Custom wallpaper - sirf is phone ke AsyncStorage me (dmWallpaper.ts), sirf verified users set kar sakte hain.
  const {
    wallpaper,
    pending: wallpaperPending,
    saving: wallpaperSaving,
    startPick: startWallpaperPick,
    confirmCrop: confirmWallpaperCrop,
    cancelCrop: cancelWallpaperCrop,
    clear: clearWallpaper,
  } = useDMWallpaper(getMyId(), dmTargetId);

  // Header (pfp + naam) aur bubble ke bagal wala pfp - dono isi se us user ki
  // profile kholte hain (profileOpenBus -> ProfileViewModal).
  const openPartnerProfile = useCallback(() => {
    if (!dmTargetId) return;
    onOpenProfile?.({ id: dmTargetId, username: selectedDM?.username });
  }, [dmTargetId, selectedDM?.username, onOpenProfile]);
  // Inbox wale avatar_url/avatar_version se SYNC resolve (cache) - header me pehle
  // letter/default dikh ke baad me image nahi badlegi.
  const headerAvatarSrc = useAvatarImage(dmTargetId, selectedDM?.avatar_url, selectedDM?.avatar_version);
  const isOnline = usePresence(dmTargetId);

  const inputRef = useRef<TextInput>(null);
  const kebabRef = useRef<KebabMenuHandle>(null);
  // Cursor position (null = abhi pata nahi -> emoji end me jayega).
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const [forcedSel, setForcedSel] = useState<{ start: number; end: number } | undefined>(undefined);
  const kbHeightRef = useRef(300);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const closeEmoji = useStableCallback(() => setEmojiOpen(false));
  useBackButtonHandler(emojiOpen, closeEmoji);

  // SMOOTH keyboard: KeyboardAvoidingView (JS-side padding jump = "snap") hata diya.
  // Ab neeche ek Animated spacer hai jiski height reanimated ke `useAnimatedKeyboard`
  // se UI thread par keyboard ke saath frame-by-frame badalti hai - input bar
  // keyboard ke saath chipak ke smoothly upar aata hai, koi snap/bounce nahi.
  // Emoji panel khula ho to spacer 0 (panel khud bottom inset handle karta hai).
  // NOTE: app.json mein android.softwareKeyboardLayoutMode = "resize" zaroori hai.
  const keyboard = useAnimatedKeyboard();
  const emojiOpenSV = useSharedValue(0);
  useEffect(() => {
    emojiOpenSV.value = emojiOpen ? 1 : 0;
  }, [emojiOpen, emojiOpenSV]);
  const keyboardSpacerStyle = useAnimatedStyle(() => ({
    height: emojiOpenSV.value === 1 ? 0 : Math.max(insets.bottom, keyboard.height.value),
  }));

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const a = Keyboard.addListener(showEvt, (e: any) => {
      const h = e?.endCoordinates?.height;
      if (h && h > 150) kbHeightRef.current = h;
      // Inverted list bottom se anchored hai - viewport chhota hone par latest
      // apne aap dikhta rehta hai, alag scroll animation nahi (warna jitter).
      setEmojiOpen(false);
    });
    return () => {
      a.remove();
    };
  }, []);

  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(!!selectedDM, handleClose);

  const showActionToast = (msg: string) => {
    setActionToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setActionToast(''), 3000);
  };

  // Conversation badalne par input reset (ya User Store se aaya draft dikhao).
  useEffect(() => {
    setMsgInput(initialDraft || '');
    setReplyTarget(null);
    selectionRef.current = null;
    setEmojiOpen(false);
    userScrolledRef.current = false;
    dmTypingSentRef.current = false;
    if (dmTypingTimeoutRef.current) {
      clearTimeout(dmTypingTimeoutRef.current);
      dmTypingTimeoutRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmTargetId]);

  useEffect(() => {
    return () => {
      if (dmTypingTimeoutRef.current) clearTimeout(dmTypingTimeoutRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Typing "shuru" hone par hi bhejo (throttled), har keystroke par nahi.
  const handleChangeMsgInput = (val: string) => {
    setMsgInput(val);
    if (!dmTargetId) return;

    if (!dmTypingSentRef.current) {
      dmTypingSentRef.current = true;
      networkManager.send({ type: 'typing', target_id: dmTargetId, is_typing: true });
    }
    if (dmTypingTimeoutRef.current) clearTimeout(dmTypingTimeoutRef.current);
    dmTypingTimeoutRef.current = setTimeout(() => {
      dmTypingSentRef.current = false;
      networkManager.send({ type: 'typing', target_id: dmTargetId, is_typing: false });
    }, 2000);
  };

  const lastSendRef = useRef({ text: '', at: 0 });
  const handleSend = () => {
    if (!msgInput.trim()) return;
    // Tez double/multi tap: setMsgInput('') async hai, isliye ek hi text kai baar bhej deta tha.
    const now = Date.now();
    if (lastSendRef.current.text === msgInput && now - lastSendRef.current.at < 800) return;
    lastSendRef.current = { text: msgInput, at: now };
    if (dmTypingTimeoutRef.current) {
      clearTimeout(dmTypingTimeoutRef.current);
      dmTypingTimeoutRef.current = null;
    }
    if (dmTypingSentRef.current) {
      dmTypingSentRef.current = false;
      networkManager.send({ type: 'typing', target_id: dmTargetId, is_typing: false });
    }
    onSend(msgInput, replyTarget?.id ?? null);
    setMsgInput('');
    setReplyTarget(null);
    selectionRef.current = null;
  };

  // ---- Emoji panel (keyboard ki jagah) ----
  const toggleEmoji = () => {
    if (emojiOpen) {
      setEmojiOpen(false);
      inputRef.current?.focus();
    } else {
      setEmojiOpen(true);
      Keyboard.dismiss();
    }
  };

  const insertEmoji = (emoji: string) => {
    const sel = selectionRef.current;
    const len = msgInput.length;
    const start = sel ? Math.min(sel.start, len) : len;
    const end = sel ? Math.min(sel.end, len) : len;
    const next = msgInput.slice(0, start) + emoji + msgInput.slice(end);
    handleChangeMsgInput(next);
    const pos = start + emoji.length;
    selectionRef.current = { start: pos, end: pos };
    setForcedSel({ start: pos, end: pos });
  };

  const backspaceEmoji = () => {
    const sel = selectionRef.current;
    const len = msgInput.length;
    const start = sel ? Math.min(sel.start, len) : len;
    const end = sel ? Math.min(sel.end, len) : len;
    let before = msgInput.slice(0, start);
    const after = msgInput.slice(end);
    if (start === end) {
      if (!before) return;
      before = before.replace(/[\uFE0F\u200D]+$/, '');
      const chars = Array.from(before);
      chars.pop();
      before = chars.join('').replace(/[\uFE0F\u200D]+$/, '');
    }
    handleChangeMsgInput(before + after);
    selectionRef.current = { start: before.length, end: before.length };
    setForcedSel({ start: before.length, end: before.length });
  };

  const comingSoon = (what: string) => showActionToast(`${what} is coming soon.`);

  // Apna verified status (useRankCache se - GET /profile/{myId}). undefined = abhi load ho raha hai.
  const iAmVerified: boolean | undefined = verifieds[String(getMyId())];

  const handleChangeWallpaper = async () => {
    if (iAmVerified === undefined) {
      showActionToast('Checking your account, try again in a moment.');
      return;
    }
    if (!iAmVerified) {
      showActionToast('Custom wallpaper is only for verified users.');
      return;
    }
    // Gallery -> crop screen (WallpaperCropModal neeche render hota hai) -> handleWallpaperCropConfirm
    const r = await startWallpaperPick();
    if (r === 'error') showActionToast('Could not open the image.');
  };

  const handleWallpaperCropConfirm = async (region: { originX: number; originY: number; width: number; height: number }) => {
    const res = await confirmWallpaperCrop(region);
    if (res.ok) showActionToast('Wallpaper updated (saved on this device only).');
    else if (res.reason === 'too_large') showActionToast('Image is too large, try a different one.');
    else showActionToast('Could not set wallpaper.');
  };

  const handleRemoveWallpaper = async () => {
    await clearWallpaper();
    showActionToast('Wallpaper removed.');
  };

  // Attachments: + button -> sheet (Gallery / Camera) -> photo DM mein jaati hai.
  const [attachOpen, setAttachOpen] = useState(false);
  const sendPickedPhoto = (uri?: string | null) => {
    if (!uri) return;
    onSendPhoto?.(uri, replyTarget?.id ?? null);
    setReplyTarget(null);
  };
  const pickFromGallery = async () => {
    setAttachOpen(false);
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 1 });
      if (picked.canceled) return;
      sendPickedPhoto(picked.assets?.[0]?.uri);
    } catch (err: any) {
      console.error('DM photo pick error:', err?.message);
    }
  };
  const pickFromCamera = async () => {
    setAttachOpen(false);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        showActionToast('Camera permission is needed to take a photo.');
        return;
      }
      const shot = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
      if (shot.canceled) return;
      sendPickedPhoto(shot.assets?.[0]?.uri);
    } catch (err: any) {
      console.error('DM camera error:', err?.message);
    }
  };

  // Reply: message ki id (replying_to) bhejte hain - input mein @naam nahi jodte.
  // Abhi tak server ack nahi aaya (id nahi) to reply nahi ho sakta.
  const handleReply = useCallback((msg: any, name: string) => {
    if (!msg?.id) return;
    setReplyTarget({ id: msg.id, name, content: msg.is_photo ? '📷 Photo' : msg.content });
    inputRef.current?.focus();
  }, []);

  // id -> message, taaki reply ka quoted block loaded messages se seedha mil jaye.
  const msgById = useMemo(() => {
    const map = new Map<string, any>();
    chatMessages.forEach((m) => {
      if (m?.id) map.set(String(m.id), m);
    });
    return map;
  }, [chatMessages]);

  // INVERTED list: newest message index 0 pe hota hai, aur list hamesha
  // bottom (latest) se hi shuru hoti hai - koi scrollToEnd/timing hack nahi.
  // Purane messages load hone par (end of list) position apne aap barkarar rehti hai.
  const invertedData = useMemo(() => [...chatMessages].reverse(), [chatMessages]);
  const msgKey = (m: any, i: number) => String(m?.id ?? `tmp-${chatMessages.length - 1 - i}`);

  // Naya message (mera ya samne wale ka) aaye to latest tak le jao.
  const lastMsgKey = chatMessages.length ? String(chatMessages[chatMessages.length - 1]?.id ?? `tmp-${chatMessages.length - 1}`) : null;
  useEffect(() => {
    if (!lastMsgKey) return;
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
  }, [lastMsgKey]);

  // Purane messages ka asli trigger: scroll position. FlatList ka onEndReached ek
  // content-length par SIRF EK baar fire hota hai - agar wo pehli baar (user ke
  // scroll karne se pehle) fire ho gaya to guard ne use rok diya aur baad mein upar
  // scroll karne par dobara kabhi nahi chalta tha (purane DMs load nahi hote the).
  // Isliye upar ke ~400px ke andar pahunchte hi yahin se load karte hain.
  const loadMoreLockRef = useRef(false);
  useEffect(() => {
    if (!loadingMore) loadMoreLockRef.current = false;
  }, [loadingMore]);
  const handleScroll = (e: any) => {
    if (!hasMoreMessages || loadingMore || loadMoreLockRef.current) return;
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 400) {
      loadMoreLockRef.current = true;
      onLoadMore?.();
    }
  };

  const handleEndReached = () => {
    if (!hasMoreMessages || loadingMore) return;
    // Start me sirf latest 10: user ne khud upar scroll kiya ho tab hi purane load karo
    // (ya agar 10 messages screen bhar hi na paayein).
    if (!userScrolledRef.current && contentHRef.current >= layoutHRef.current) return;
    onLoadMore?.();
  };

  useEffect(() => {
    chatMessages.forEach((m) => m.sender_id && ensureRank(m.sender_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages.length]);

  useEffect(() => {
    if (dmTargetId) ensureRank(dmTargetId);
    // Apna status bhi chahiye (wallpaper gate ke liye)
    const myId = getMyId();
    if (myId) ensureRank(myId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmTargetId]);

  if (!selectedDM) return null;

  const headerVerified = selectedDM.is_verified ?? verifieds[dmTargetId];
  const headerElite = selectedDM.is_elite ?? elites[dmTargetId];
  const headerAvatar = headerAvatarSrc || avatars[dmTargetId]?.photoUrl;

  const tradeForThisDM = activeTrade && String(activeTrade.otherId) === String(dmTargetId) ? activeTrade : null;
  const waitingForThisDM =
    outgoingTradeWaiting && String(outgoingTradeWaiting.to_id) === String(dmTargetId) ? outgoingTradeWaiting : null;

  const handleTradeButtonClick = () => {
    if (tradeForThisDM) {
      setTradePanelExpanded((prev) => !prev);
      return;
    }
    if (waitingForThisDM) return;
    onTradeRequest?.(selectedDM);
  };

  const renderItem = ({ item: msg, index }: { item: any; index: number }) => {
    const mine = String(msg.sender_id) === String(getMyId());
    const username = mine ? 'You' : selectedDM.username;

    // inverted data: index-1 = newer, index+1 = older
    const older = invertedData[index + 1];
    const newer = invertedData[index - 1];
    const thisDay = dayKey(msg.created_at);
    const showDate = !!thisDay && (older ? dayKey(older.created_at) !== thisDay : !hasMoreMessages);
    const dateLabel = showDate ? formatDayLabel(msg.created_at) : null;
    const showAvatar = !mine && (!newer || newer.isTip || String(newer.sender_id) !== String(msg.sender_id));

    // Reply hai to original message dhundo. Na mile (bahut purana, abhi load
    // nahi hua, ya delete ho gaya) to "Original message" dikhao.
    let replyInfo: { name: string; text: string; missing: boolean } | null = null;
    if (msg.replying_to) {
      const original = msgById.get(String(msg.replying_to));
      replyInfo = original
        ? {
            name: String(original.sender_id) === String(getMyId()) ? 'You' : selectedDM.username || 'User',
            text: original.is_photo ? '📷 Photo' : original.content,
            missing: false,
          }
        : { name: 'Reply', text: 'Original message', missing: true };
    }

    return (
      <DMMessageBubble
        msg={msg}
        mine={mine}
        dateLabel={dateLabel}
        showAvatar={showAvatar}
        avatarUri={headerAvatar}
        avatarLetter={(selectedDM.username || '?').charAt(0).toUpperCase()}
        onDelete={() => onDeleteMessage(msg.id)}
        onEdit={(newContent) => onEditMessage(msg.id, newContent)}
        onTip={() => onTip({ id: msg.sender_id, username: selectedDM.username }, null)}
        onReply={() => handleReply(msg, username)}
        replyInfo={replyInfo}
        onReport={() => setReportState({ mode: 'report_message', target: { id: msg.id, label: 'this message' } })}
        onRetry={() => onRetryMessage?.(msg)}
        onOpenProfile={openPartnerProfile}
        onOpenCommunity={onOpenCommunity}
      />
    );
  };

  return (
    // Slide/animation ab parent (DMOverlayScreen -> ChatSlide) karta hai -
    // yahan koi fade/translate nahi, warna blink hota hai.
    <View style={[styles.screen, { zIndex, elevation: 20 }]}>
      {/* Wallpaper: sirf tab dikhao jab abhi bhi verified ho (verification lapse -> default bg) */}
      <WallpaperCropModal
        source={wallpaperPending}
        saving={wallpaperSaving}
        onCancel={cancelWallpaperCrop}
        onConfirm={handleWallpaperCropConfirm}
      />
      {!!wallpaper && iAmVerified !== false && (
        <>
          <ExpoImage source={{ uri: wallpaper }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={styles.wallpaperDim} pointerEvents="none" />
        </>
      )}
      <View style={styles.flex}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={onClose} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="arrow-back" size={26} color="#ffffff" />
          </Pressable>

          <Pressable onPress={openPartnerProfile} style={styles.headerUser}>
            <View style={styles.headerAvatarWrap}>
              <View style={styles.headerAvatar}>
                {headerAvatar ? (
                  <Image source={{ uri: headerAvatar }} style={styles.fill} />
                ) : (
                  <Text style={styles.headerAvatarText}>{(selectedDM.username || '?').charAt(0).toUpperCase()}</Text>
                )}
              </View>
              {isOnline !== undefined && (
                <View style={[styles.headerDot, { backgroundColor: isOnline ? '#22c55e' : '#6b7280' }]} />
              )}
            </View>
            <View style={styles.headerTextCol}>
              <View style={styles.nameRow}>
                <Text style={styles.headerName} numberOfLines={1}>
                  {selectedDM.username}
                </Text>
                {headerVerified && <VerifiedBadge size="md" />}
                {headerElite && <EliteBadge size="md" />}
              </View>
              {isOnline !== undefined && <Text style={styles.headerSub}>{isOnline ? 'Online' : 'Offline'}</Text>}
            </View>
          </Pressable>

          <View style={styles.headerActions}>
            {/* Call - placeholder */}
            <Pressable onPress={() => comingSoon('Calling')} style={styles.iconBtn} hitSlop={6}>
              <Ionicons name="call-outline" size={22} color="#ffffff" />
            </Pressable>

            {/* Trade (video-call button ki jagah) */}
            <Pressable
              onPress={handleTradeButtonClick}
              disabled={!!waitingForThisDM}
              style={[styles.iconBtn, tradeForThisDM && styles.iconBtnActive, waitingForThisDM && { opacity: 0.5 }]}
              hitSlop={6}
            >
              <Ionicons name={waitingForThisDM ? 'hourglass-outline' : 'swap-horizontal'} size={24} color="#ffffff" />
            </Pressable>

            <Pressable onPress={() => kebabRef.current?.open()} style={styles.iconBtn} hitSlop={6}>
              <Ionicons name="ellipsis-vertical" size={22} color="#ffffff" />
            </Pressable>
            <KebabMenu
              ref={kebabRef}
              hideButton
              items={[
                {
                  label: iAmVerified === false ? 'Change wallpaper (Verified only)' : 'Change wallpaper',
                  icon: <Ionicons name={iAmVerified === false ? 'lock-closed-outline' : 'image-outline'} size={16} color="#ffffff" />,
                  onClick: handleChangeWallpaper,
                },
                ...(wallpaper && iAmVerified !== false
                  ? [
                      {
                        label: 'Remove wallpaper',
                        icon: <Ionicons name="trash-outline" size={16} color="#ffffff" />,
                        onClick: handleRemoveWallpaper,
                      },
                    ]
                  : []),
                {
                  label: 'Report user',
                  icon: <Ionicons name="warning-outline" size={16} color="#f87171" />,
                  danger: true,
                  onClick: () => setReportState({ mode: 'report', target: { id: dmTargetId, username: selectedDM.username } }),
                },
                {
                  label: 'Block user',
                  icon: <Ionicons name="ban-outline" size={16} color="#f87171" />,
                  danger: true,
                  onClick: () => setReportState({ mode: 'block', target: { id: dmTargetId, username: selectedDM.username } }),
                },
              ]}
            />
          </View>
        </View>

        {waitingForThisDM && (
          <View style={styles.waitBanner}>
            <Text style={styles.waitText}>Trade request sent, waiting for response...</Text>
            <Pressable onPress={onCancelOutgoingTradeRequest} hitSlop={8}>
              <Text style={styles.waitCancel}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {tradeForThisDM && tradePanelExpanded && (
          <View style={styles.tradeWrap}>
            <TradeModal
              trade={tradeForThisDM}
              myBalance={myBalance}
              onUpdateOffer={(items, z) => onUpdateTradeOffer?.(items, z)}
              onConfirm={() => onConfirmTrade?.()}
              onCancel={() => onCancelTrade?.()}
              embedded
            />
          </View>
        )}

        {/* Messages */}
        {loading ? (
          <View style={styles.skelWrap}>
            {[...Array(6)].map((_, i) => (
              <SkeletonBubble key={i} index={i} />
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={invertedData}
            inverted
            keyExtractor={msgKey}
            renderItem={renderItem}
            onEndReached={handleEndReached}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            onScrollBeginDrag={() => {
              userScrolledRef.current = true;
            }}
            onContentSizeChange={(_w, h) => {
              contentHRef.current = h;
            }}
            onLayout={(e) => {
              layoutHRef.current = e.nativeEvent.layout.height;
            }}
            initialNumToRender={10}
            maxToRenderPerBatch={8}
            windowSize={7}
            onEndReachedThreshold={0.5}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            overScrollMode="never"
            contentContainerStyle={styles.listContent}
            style={styles.flex}
            // Inverted list: footer = sabse UPAR. Jab tak purane messages baaki hain
            // (ya load ho rahe hain) Instagram jaisa spinner upar dikhta rehta hai.
            ListFooterComponent={
              hasMoreMessages || loadingMore ? (
                <View style={styles.loadMoreWrap}>
                  <View style={styles.loadMoreSpinner}>
                    <ActivityIndicator size="small" color="#d4d4d4" />
                  </View>
                </View>
              ) : null
            }
          />
        )}

        {isOtherTyping && (
          <View style={styles.typingRow}>
            <View style={styles.typingPill}>
              <TypingDots />
            </View>
            <Text style={styles.typingText}>{selectedDM.username} is typing...</Text>
          </View>
        )}

        {requestLock === 'declined_by_me' && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            <Text style={styles.reminder}>
              You declined their request — sending a message will start a new request from you.
            </Text>
          </View>
        )}

        {/* Reply preview bar - input ke upar, X se cancel */}
        {!!replyTarget && requestLock !== 'pending_incoming' && requestLock !== 'pending_sent' && requestLock !== 'denied' && (
          <View style={styles.replyBar}>
            <View style={styles.replyBarAccent} />
            <View style={styles.flex}>
              <Text style={styles.replyBarName} numberOfLines={1}>
                Replying to {replyTarget.name}
              </Text>
              <Text style={styles.replyBarText} numberOfLines={1}>
                {replyTarget.content}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTarget(null)} hitSlop={10} accessibilityLabel="Cancel reply">
              <Ionicons name="close" size={20} color="#a3a3a3" />
            </Pressable>
          </View>
        )}

        {/* Input area */}
        <View style={styles.inputRow}>
          {requestLock === 'pending_incoming' ? (
            <View style={styles.reqRow}>
              <Text style={styles.reqText}>{selectedDM.username} sent you a message request.</Text>
              <Pressable onPress={onDeclineRequest} style={[styles.reqBtn, { backgroundColor: '#262626' }]}>
                <Text style={styles.reqBtnText}>Decline</Text>
              </Pressable>
              <Pressable onPress={onAcceptRequest} style={[styles.reqBtn, { backgroundColor: '#4f46e5' }]}>
                <Text style={styles.reqBtnText}>Accept</Text>
              </Pressable>
            </View>
          ) : requestLock === 'pending_sent' ? (
            <View style={styles.lockBox}>
              <Text style={styles.lockText}>
                Message request sent — you can send more once {selectedDM.username} accepts.
              </Text>
            </View>
          ) : requestLock === 'denied' ? (
            <View style={styles.lockBox}>
              <Text style={[styles.lockText, { color: '#6e6e6e' }]}>
                They declined your message request. You can't send another request.
              </Text>
            </View>
          ) : (
            <>
              {/* + button - attachments (photo) */}
              <Pressable onPress={() => { Keyboard.dismiss(); setAttachOpen(true); }} style={styles.plusBtn}>
                <Ionicons name="add" size={28} color="#d4d4d4" />
              </Pressable>

              <View style={styles.inputWrap}>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="Type a message..."
                  placeholderTextColor="#6e6e6e"
                  value={msgInput}
                  onChangeText={handleChangeMsgInput}
                  // Enter = NEW LINE (Telegram jaisa), keyboard par send button nahi.
                  multiline
                  submitBehavior="newline"
                  onFocus={() => setEmojiOpen(false)}
                  selection={forcedSel}
                  onSelectionChange={(e) => {
                    selectionRef.current = e.nativeEvent.selection;
                    if (forcedSel) setForcedSel(undefined);
                  }}
                />
                <Pressable onPress={toggleEmoji} style={styles.emojiBtn} hitSlop={6}>
                  <Ionicons name={emojiOpen ? 'keypad-outline' : 'happy-outline'} size={26} color="#a3a3a3" />
                </Pressable>
              </View>

              <Pressable onPress={handleSend} style={[styles.sendBtn, !msgInput.trim() && { opacity: 0.6 }]}>
                <Ionicons name="send" size={20} color="#ffffff" />
              </Pressable>
            </>
          )}
        </View>

        <Modal visible={attachOpen} transparent animationType="fade" onRequestClose={() => setAttachOpen(false)} statusBarTranslucent>
          <Pressable style={styles.sheetScrim} onPress={() => setAttachOpen(false)}>
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Pressable onPress={pickFromGallery} style={styles.sheetRow}>
                <View style={styles.sheetIcon}>
                  <Ionicons name="image-outline" size={22} color="#ffffff" />
                </View>
                <Text style={styles.sheetLabel}>Photo from gallery</Text>
              </Pressable>
              <Pressable onPress={pickFromCamera} style={styles.sheetRow}>
                <View style={styles.sheetIcon}>
                  <Ionicons name="camera-outline" size={22} color="#ffffff" />
                </View>
                <Text style={styles.sheetLabel}>Take a photo</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        {emojiOpen && (
          <EmojiPanel
            height={Math.max(260, kbHeightRef.current)}
            bottomInset={insets.bottom}
            onPick={insertEmoji}
            onBackspace={backspaceEmoji}
          />
        )}

        {!!actionToast && (
          <View style={[styles.toast, { top: insets.top + 64 }]} pointerEvents="none">
            <Text style={styles.toastText}>{actionToast}</Text>
          </View>
        )}

        <ReportBlockModal
          mode={reportState?.mode}
          target={reportState?.target || null}
          onClose={() => setReportState(null)}
          onDone={(m: any) => showActionToast(m === 'block' ? 'User blocked.' : 'Report submitted, thank you.')}
        />
      <Animated.View style={keyboardSpacerStyle} pointerEvents="none" />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  wallpaperDim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  fill: { width: '100%', height: '100%' },
  header: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: '#0a0a0a',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
    gap: 6,
  },
  backBtn: { padding: 4 },
  headerAvatarWrap: { width: 42, height: 42 },
  headerDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  headerTextCol: { flexShrink: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerSub: { color: '#a3a3a3', fontSize: 13, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  iconBtnActive: { backgroundColor: '#4f46e5' },
  datePillWrap: { alignItems: 'center', marginVertical: 6 },
  datePill: { backgroundColor: '#1a1a1a', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  datePillText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end' },
  sideAvatarSlot: { width: 32, marginRight: 8 },
  sideAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4f46e5',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideAvatarText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  metaRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', gap: 4, marginTop: 2 },
  metaText: { fontSize: 11, color: '#9a9a9a' },
  failedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  failedText: { fontSize: 11, color: '#dc2626', fontWeight: '600' },
  metaTextMine: { color: 'rgba(0,0,0,0.5)' },
  plusBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#161616', alignItems: 'center', justifyContent: 'center' },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 24,
    minHeight: 44,
  },
  emojiBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  closeBtnText: { color: '#ffffff' },
  headerUser: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4f46e5',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  headerName: { color: '#ffffff', fontWeight: '700', fontSize: 18, flexShrink: 1 },
  tradeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  tradeBtnActive: { backgroundColor: '#4f46e5' },
  tradeBtnIdle: { backgroundColor: '#262626' },
  tradeBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  waitBanner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(22,22,22,0.8)',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  waitText: { fontSize: 12, color: '#d4d4d4' },
  waitCancel: { fontSize: 12, color: '#f87171', fontWeight: '700', marginLeft: 8 },
  tradeWrap: { paddingHorizontal: 16, paddingTop: 12 },
  listContent: { padding: 16, gap: 12, flexGrow: 1 },
  skelWrap: { flex: 1, padding: 16, gap: 12 },
  skelRow: { flexDirection: 'row' },
  skelBubble: { height: 40, backgroundColor: '#262626', borderRadius: 16 },
  loadMoreWrap: { alignItems: 'center', paddingVertical: 10 },
  loadMoreSpinner: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#161616', alignItems: 'center', justifyContent: 'center' },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  typingRow: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2, flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingPill: { backgroundColor: '#262626', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  typingText: { fontSize: 12, color: '#a3a3a3' },
  reminder: { fontSize: 11, color: '#6e6e6e', textAlign: 'center' },
  tipWrap: { alignItems: 'center' },
  tipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(113,63,18,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(133,77,14,0.4)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tipText: { fontSize: 11, color: '#fde047' },
  msgCol: { flexShrink: 1, maxWidth: '100%' },
  alignEnd: { alignItems: 'flex-end' },
  alignStart: { alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, borderRadius: 18, flexShrink: 1 },
  bubbleMine: { backgroundColor: '#e5e5e5', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#262626', borderBottomLeftRadius: 2 },
  bubbleText: { color: '#ffffff', fontSize: 14, lineHeight: 19, flexShrink: 1 },
  bubbleTextMine: { color: '#000000' },
  quote: { borderLeftWidth: 3, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, marginBottom: 6 },
  quoteMine: { backgroundColor: 'rgba(0,0,0,0.08)', borderLeftColor: '#4f46e5' },
  quoteTheirs: { backgroundColor: 'rgba(255,255,255,0.08)', borderLeftColor: '#818cf8' },
  quoteName: { color: '#a5b4fc', fontSize: 12, fontWeight: '700' },
  quoteNameMine: { color: '#4f46e5' },
  quoteText: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 17 },
  quoteTextMine: { color: 'rgba(0,0,0,0.7)' },
  quoteMissing: { fontStyle: 'italic', opacity: 0.7 },
  bubblePhoto: { padding: 4, paddingBottom: 4 },
  photoWrap: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#1a1a1a' },
  photoImg: { width: 230, height: 280 },
  photoOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' },
  metaRowPhoto: { paddingHorizontal: 6, paddingBottom: 2, marginTop: 4 },
  viewerBg: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' },
  viewerImg: { width: '100%', height: '100%' },
  viewerClose: { position: 'absolute', top: 44, right: 16, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, padding: 8 },
  sheetScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#161616', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28, gap: 6 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#3a3a3a', marginBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  sheetIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#262626', alignItems: 'center', justifyContent: 'center' },
  sheetLabel: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#161616',
    borderRadius: 12,
  },
  replyBarAccent: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: '#818cf8' },
  replyBarName: { color: '#a5b4fc', fontSize: 12, fontWeight: '700' },
  replyBarText: { color: '#a3a3a3', fontSize: 13 },
  editedTextMine: { color: 'rgba(0,0,0,0.55)' },
  editedText: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', marginTop: 2 },
  statusIcon: { position: 'absolute', bottom: 4, right: 10, flexDirection: 'row', alignItems: 'center' },
  timeText: { fontSize: 10, color: '#6e6e6e', marginTop: 2, paddingHorizontal: 4 },
  editWrap: { width: '75%', gap: 6 },
  editInput: {
    backgroundColor: '#e5e5e5',
    color: '#000000',
    fontSize: 14,
    padding: 12,
    borderRadius: 16,
    minHeight: 56,
    textAlignVertical: 'top',
    borderWidth: 2,
    borderColor: '#a3a3a3',
  },
  editBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  editBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  inputRow: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    paddingLeft: 16,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 120,
    textAlignVertical: 'center',
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#4f46e5', alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#ffffff', fontWeight: '700' },
  reqRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  reqText: { flex: 1, fontSize: 12, color: '#a3a3a3' },
  reqBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  reqBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  lockBox: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lockText: { fontSize: 12, color: '#a3a3a3', textAlign: 'center' },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: '90%',
    zIndex: 20,
    elevation: 6,
  },
  toastText: { color: '#ffffff', fontSize: 14, fontWeight: '700', textAlign: 'center' },
});

export default memo(DMChatWindow);