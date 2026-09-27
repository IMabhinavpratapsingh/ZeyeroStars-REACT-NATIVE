import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import SwipeableBubble from '../../../shared/components/SwipeableBubble';
import VerifiedBadge from '../../../shared/components/VerifiedBadge';
import EliteBadge from '../../../shared/components/EliteBadge';
import LongPressActionSheet from '../../../shared/components/LongPressActionSheet';
import ReportBlockModal from './ReportBlockModal';
import TradeModal from '../../trade/components/TradeModal';
import useRankCache from '../../../shared/hooks/useRankCache';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import useLongPress, { type LongPressPosition } from '../../../shared/hooks/useLongPress';
import networkManager from '../../../shared/services/NetworkManager';
import { renderWithMentions } from '../../../shared/utils/renderMentions';

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
  onDelete: () => void;
  onEdit: (content: string) => void;
  onTip: () => void;
  onReply: () => void;
  onReport: () => void;
  onOpenCommunity?: (slug: string, name: string) => void;
}

const DMMessageBubble = memo(({ msg, mine, onDelete, onEdit, onTip, onReply, onReport, onOpenCommunity }: DMMessageBubbleProps) => {
  const bubbleTime = formatBubbleTime(msg.created_at);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<LongPressPosition | null>(null);

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
      <View style={styles.tipWrap}>
        <View style={styles.tipPill}>
          <Ionicons name="cash-outline" size={11} color="#fde047" />
          <Text style={styles.tipText}>{msg.content}</Text>
        </View>
      </View>
    );
  }

  return (
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
              placeholderTextColor="#a5b4fc"
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
            style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
          >
            <Text style={styles.bubbleText}>{renderWithMentions(msg.content, null, onOpenCommunity)}</Text>
            {msg.edited && <Text style={styles.editedText}>edited</Text>}

            {mine && (
              <View style={styles.statusIcon}>
                {!msg.id ? (
                  <Ionicons name="time-outline" size={11} color="#000000" />
                ) : msg.seen ? (
                  <Ionicons name="checkmark-done-outline" size={12} color="#000000" />
                ) : (
                  <Ionicons name="checkmark" size={12} color="#000000" />
                )}
              </View>
            )}
          </Pressable>
        )}

        {bubbleTime && !editing && <Text style={styles.timeText}>{bubbleTime}</Text>}
      </View>

      <LongPressActionSheet
        open={menuOpen}
        anchor={menuAnchor}
        onClose={() => setMenuOpen(false)}
        items={
          mine
            ? [
                { label: 'Reply', icon: <Ionicons name="arrow-undo-outline" size={16} color="#ffffff" />, onClick: onReply },
                { label: 'Edit', icon: <Ionicons name="pencil-outline" size={16} color="#ffffff" />, onClick: startEdit },
                { label: 'Delete', icon: <Ionicons name="trash-outline" size={16} color="#f87171" />, danger: true, onClick: onDelete },
              ]
            : [
                { label: 'Reply', icon: <Ionicons name="arrow-undo-outline" size={16} color="#ffffff" />, onClick: onReply },
                { label: 'Tip', icon: <Ionicons name="cash-outline" size={16} color="#ffffff" />, onClick: onTip },
                { label: 'Report', icon: <Ionicons name="warning-outline" size={16} color="#f87171" />, danger: true, onClick: onReport },
              ]
        }
      />
    </SwipeableBubble>
  );
});
DMMessageBubble.displayName = 'DMMessageBubble';

interface DMChatWindowProps {
  selectedDM: any | null;
  chatMessages: any[];
  loading?: boolean;
  hasMoreMessages?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onSend: (text: string) => void;
  isOtherTyping?: boolean;
  onClose: () => void;
  getMyId: () => string | number | null;
  onDeleteMessage: (id: string | number) => void;
  onEditMessage: (id: string | number, content: string) => void;
  onOpenProfile?: (dm: any) => void;
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
  isOtherTyping,
  onClose,
  getMyId,
  onDeleteMessage,
  onEditMessage,
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
  const prevFirstKeyRef = useRef<string | null>(null);
  const prevLastKeyRef = useRef<string | null>(null);
  const initialScrolledRef = useRef(false);

  const [tradePanelExpanded, setTradePanelExpanded] = useState(true);
  const [reportState, setReportState] = useState<{ mode: any; target: any } | null>(null);
  const [actionToast, setActionToast] = useState('');
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { verifieds, elites, avatars, ensureRank } = useRankCache();

  // Input + typing state LOCAL hai - keystroke par Dashboard re-render nahi hota.
  const [msgInput, setMsgInput] = useState('');
  const dmTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dmTypingSentRef = useRef(false);

  const dmTargetId = selectedDM?.id || selectedDM?.target_id;

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
    dmTypingSentRef.current = false;
    if (dmTypingTimeoutRef.current) {
      clearTimeout(dmTypingTimeoutRef.current);
      dmTypingTimeoutRef.current = null;
    }
    // Naye DM me list dobara "initial load" ki tarah behave kare.
    initialScrolledRef.current = false;
    prevFirstKeyRef.current = null;
    prevLastKeyRef.current = null;
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

  const handleSend = () => {
    if (!msgInput.trim()) return;
    if (dmTypingTimeoutRef.current) {
      clearTimeout(dmTypingTimeoutRef.current);
      dmTypingTimeoutRef.current = null;
    }
    if (dmTypingSentRef.current) {
      dmTypingSentRef.current = false;
      networkManager.send({ type: 'typing', target_id: dmTargetId, is_typing: false });
    }
    onSend(msgInput);
    setMsgInput('');
  };

  const handleReply = useCallback((username?: string) => {
    setMsgInput((prev) => `${prev}@${username} `);
  }, []);

  // Scroll behaviour: initial -> bottom (no anim), append -> bottom (anim),
  // prepend (older loaded) -> maintainVisibleContentPosition sambhalta hai.
  const msgKey = (m: any, i: number) => String(m?.id ?? `tmp-${i}`);
  useEffect(() => {
    const len = chatMessages.length;
    if (len === 0) {
      prevFirstKeyRef.current = null;
      prevLastKeyRef.current = null;
      return;
    }
    const firstKey = msgKey(chatMessages[0], 0);
    const lastKey = msgKey(chatMessages[len - 1], len - 1);
    const prevFirst = prevFirstKeyRef.current;
    const prevLast = prevLastKeyRef.current;
    prevFirstKeyRef.current = firstKey;
    prevLastKeyRef.current = lastKey;

    if (!initialScrolledRef.current) {
      initialScrolledRef.current = true;
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
      return;
    }
    const prepended = prevFirst !== null && prevFirst !== firstKey && prevLast === lastKey;
    if (!prepended) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [chatMessages]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!hasMoreMessages || loadingMore) return;
    if (e.nativeEvent.contentOffset.y < 60) onLoadMore?.();
  };

  useEffect(() => {
    chatMessages.forEach((m) => m.sender_id && ensureRank(m.sender_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMessages.length]);

  useEffect(() => {
    if (dmTargetId) ensureRank(dmTargetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmTargetId]);

  if (!selectedDM) return null;

  const headerVerified = selectedDM.is_verified ?? verifieds[dmTargetId];
  const headerElite = selectedDM.is_elite ?? elites[dmTargetId];
  const headerAvatar = avatars[dmTargetId]?.photoUrl;

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

  const renderItem = ({ item: msg }: { item: any }) => {
    const mine = String(msg.sender_id) === String(getMyId());
    const username = mine ? 'You' : selectedDM.username;
    return (
      <DMMessageBubble
        msg={msg}
        mine={mine}
        onDelete={() => onDeleteMessage(msg.id)}
        onEdit={(newContent) => onEditMessage(msg.id, newContent)}
        onTip={() => onTip({ id: msg.sender_id, username: selectedDM.username }, null)}
        onReply={() => handleReply(username)}
        onReport={() => setReportState({ mode: 'report_message', target: { id: msg.id, label: 'this message' } })}
        onOpenCommunity={onOpenCommunity}
      />
    );
  };

  return (
    <MotiView
      from={{ opacity: 0, translateX: 24 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'timing', duration: 200 }}
      style={[styles.screen, { zIndex, elevation: 20 }]}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="arrow-back" size={16} color="#ffffff" />
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>

          <Pressable onPress={() => onOpenProfile?.(selectedDM)} style={styles.headerUser}>
            <View style={styles.headerAvatar}>
              {headerAvatar ? (
                <Image source={{ uri: headerAvatar }} style={styles.fill} />
              ) : (
                <Text style={styles.headerAvatarText}>{(selectedDM.username || '?').charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <Text style={styles.headerName} numberOfLines={1}>
              {selectedDM.username}
            </Text>
            {headerVerified && <VerifiedBadge size="md" />}
            {headerElite && <EliteBadge size="md" />}
          </Pressable>

          <Pressable
            onPress={handleTradeButtonClick}
            disabled={!!waitingForThisDM}
            style={[
              styles.tradeBtn,
              tradeForThisDM ? styles.tradeBtnActive : styles.tradeBtnIdle,
              waitingForThisDM && { opacity: 0.7 },
            ]}
          >
            {waitingForThisDM ? (
              <Text style={[styles.tradeBtnText, { color: '#a3a3a3' }]}>Waiting...</Text>
            ) : (
              <>
                <Ionicons name="refresh-outline" size={12} color="#ffffff" />
                <Text style={styles.tradeBtnText}>{tradeForThisDM ? (tradePanelExpanded ? 'Hide' : 'Show') : 'Trade'}</Text>
              </>
            )}
          </Pressable>
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
            data={chatMessages}
            keyExtractor={msgKey}
            renderItem={renderItem}
            onScroll={handleScroll}
            scrollEventThrottle={64}
            keyboardShouldPersistTaps="handled"
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            contentContainerStyle={styles.listContent}
            style={styles.flex}
            ListHeaderComponent={
              loadingMore ? (
                <View style={styles.loadMoreWrap}>
                  <View style={styles.loadMorePill}>
                    <TypingDots color="#a3a3a3" />
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

        {/* Input area */}
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 16 }]}>
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
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor="#6e6e6e"
                value={msgInput}
                onChangeText={handleChangeMsgInput}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                blurOnSubmit={false}
              />
              <Pressable onPress={handleSend} style={styles.sendBtn}>
                <Text style={styles.sendBtnText}>Send</Text>
              </Pressable>
            </>
          )}
        </View>

        {!!actionToast && (
          <View style={[styles.toast, { top: insets.top + 64 }]} pointerEvents="none">
            <Text style={styles.toastText}>{actionToast}</Text>
          </View>
        )}

        <ReportBlockModal
          mode={reportState?.mode}
          target={reportState?.target || null}
          onClose={() => setReportState(null)}
          onDone={() => showActionToast('Report submitted, thank you.')}
        />
      </KeyboardAvoidingView>
    </MotiView>
  );
};

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#161616',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    gap: 8,
  },
  closeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  closeBtnText: { color: '#ffffff' },
  headerUser: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, justifyContent: 'center' },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  loadMoreWrap: { alignItems: 'center', paddingBottom: 8 },
  loadMorePill: { backgroundColor: '#161616', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
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
  msgCol: { maxWidth: '100%' },
  alignEnd: { alignItems: 'flex-end' },
  alignStart: { alignItems: 'flex-start' },
  bubble: { padding: 12, borderRadius: 16, maxWidth: '75%' },
  bubbleMine: { backgroundColor: '#4f46e5', borderBottomRightRadius: 2, paddingBottom: 20, paddingRight: 56 },
  bubbleTheirs: { backgroundColor: '#262626', borderBottomLeftRadius: 2 },
  bubbleText: { color: '#ffffff', fontSize: 14 },
  editedText: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', marginTop: 2 },
  statusIcon: { position: 'absolute', bottom: 4, right: 10, flexDirection: 'row', alignItems: 'center' },
  timeText: { fontSize: 10, color: '#6e6e6e', marginTop: 2, paddingHorizontal: 4 },
  editWrap: { width: '75%', gap: 6 },
  editInput: {
    backgroundColor: '#4338ca',
    color: '#ffffff',
    fontSize: 14,
    padding: 12,
    borderRadius: 16,
    minHeight: 56,
    textAlignVertical: 'top',
    borderWidth: 2,
    borderColor: '#818cf8',
  },
  editBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  editBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  inputRow: { padding: 16, flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
  },
  sendBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 24, paddingVertical: 8, borderRadius: 999, justifyContent: 'center' },
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