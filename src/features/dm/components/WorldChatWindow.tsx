import React, { memo, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import useRankCache from '../../../shared/hooks/useRankCache';
import useLongPress, { type LongPressPosition } from '../../../shared/hooks/useLongPress';
import networkManager from '../../../shared/services/NetworkManager';
import { getWorldChatMessages, subscribeWorldChat, type WorldChatMessage } from '../../../shared/services/worldChatCache';
import SwipeableBubble from '../../../shared/components/SwipeableBubble';
import VerifiedBadge from '../../../shared/components/VerifiedBadge';
import EliteBadge from '../../../shared/components/EliteBadge';
import LongPressActionSheet from '../../../shared/components/LongPressActionSheet';
import ReportBlockModal from './ReportBlockModal';

const formatBubbleTime = (date: Date) => date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/**
 * World Chat - sabhi (jo bhi is waqt game khole/connected hain) ek hi
 * chat mein. DM ya Room chat se do bade farak hain:
 *   1. Yeh SIRF real-time hai - koi SERVER-SIDE history load nahi hoti,
 *      koi DB save nahi hota. App band karke dobara kholo (ya reload karo) -
 *      pichhle messages gayab, bilkul fresh shuru. Lekin ek hi session ke
 *      andar ab yeh messages `worldChatCache.ts` (module-level, background-
 *      listening store) mein hamesha collect hote rehte hain - window
 *      dobara kholte hi last 100 messages turant wapas dikh jaate hain.
 *   2. Koi notification is se kabhi nahi aati - sirf jo log ABHI yeh
 *      window khole baithe hain unhi ko turant dikhta hai.
 *
 * Room jaisa koi "join" concept nahi hai - jo bhi connected hai wo
 * automatically ismein shamil hai, isliye yahan koi explicit join/leave
 * call nahi bhejni padti - sirf listen + send.
 *
 * WEB -> RN CHANGES:
 * - `fixed inset-x-0 top-0` + stableHeight/keyboardInset hook -> full
 *   screen absolute View, RN native keyboard handling par chhod diya
 *   (custom viewport hook abhi RN side nahi bana - keyboard khulne par
 *   OS khud content ko push/resize karta hai).
 * - `motion/react` -> `moti` MotiView (slide-in-from-right).
 * - `useLongPress` (web: spread event handlers) -> RN version
 *   `pressableProps` deta hai jo seedha Pressable par spread hote hain.
 * - `scrollIntoView` -> FlatList `inverted` nahi kiya (web jaisa hi order
 *   rakha), isliye naya message aane par `scrollToEnd` call karte hain.
 */
interface WorldMessageBubbleProps {
  msg: WorldChatMessage;
  mine: boolean;
  photoUrl?: string | null;
  verified: boolean;
  elite: boolean;
  onReply: () => void;
  onProfile: () => void;
  onReport: () => void;
}

const WorldMessageBubble = memo(
  ({ msg, mine, photoUrl, verified, elite, onReply, onProfile, onReport }: WorldMessageBubbleProps) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<LongPressPosition | null>(null);
    const { pressableProps } = useLongPress((pt) => {
      setMenuAnchor(pt);
      setMenuOpen(true);
    });

    return (
      <SwipeableBubble align={mine ? 'end' : 'start'} onReply={onReply}>
        <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
          {!mine && (
            <Pressable onPress={onProfile} style={styles.avatar}>
              {photoUrl ? (
                <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarFallback}>{(msg.username || '?').charAt(0).toUpperCase()}</Text>
              )}
            </Pressable>
          )}

          <View style={[styles.bubbleCol, mine ? styles.alignEnd : styles.alignStart]}>
            {!mine && (
              <View style={styles.nameRow}>
                <Text style={styles.nameText}>{msg.username}</Text>
                {verified && <VerifiedBadge size="xs" />}
                {elite && <EliteBadge size="xs" />}
              </View>
            )}
            <Pressable
              {...pressableProps}
              style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}
            >
              <Text style={styles.bubbleText}>{msg.content}</Text>
              <Text style={styles.bubbleTime}>{formatBubbleTime(msg.at)}</Text>
            </Pressable>
          </View>
        </View>

        <LongPressActionSheet
          open={menuOpen}
          anchor={menuAnchor}
          onClose={() => setMenuOpen(false)}
          items={
            mine
              ? [{ label: 'Reply', icon: <Ionicons name="arrow-undo-outline" size={16} color="#ffffff" />, onClick: onReply }]
              : [
                  { label: 'Reply', icon: <Ionicons name="arrow-undo-outline" size={16} color="#ffffff" />, onClick: onReply },
                  { label: 'View Profile', icon: <Ionicons name="person-outline" size={16} color="#ffffff" />, onClick: onProfile },
                  { label: 'Report', icon: <Ionicons name="warning-outline" size={16} color="#f87171" />, danger: true, onClick: onReport },
                ]
          }
        />
      </SwipeableBubble>
    );
  }
);
WorldMessageBubble.displayName = 'WorldMessageBubble';

interface WorldChatWindowProps {
  show: boolean;
  onClose: () => void;
  getMyId: () => string | number | null;
  onOpenProfile?: (p: { id: string | number; username?: string }) => void;
}

const WorldChatWindow = ({ show, onClose, getMyId, onOpenProfile }: WorldChatWindowProps) => {
  const zIndex = useTopZIndex(show);
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<WorldChatMessage[]>(getWorldChatMessages);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);
  const { verifieds, elites, avatars, ensureRank } = useRankCache();
  const [reportTarget, setReportTarget] = useState<{ id: string | number; username?: string } | null>(null);

  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(show, handleClose);

  // worldChatCache.ts hamesha background me sun raha hota hai (window
  // khuli ho ya band) - yahan bas current cached list se sync hote hain
  // aur naye messages aane par re-render trigger karte hain. Window band
  // hone par bhi subscribe rehna zaroori hai warna room/dm/shop/community
  // mein ghoomte waqt bhi is component ka apna state stale reh jaata
  // (component khud Dashboard se hamesha mounted hai, bas `show` se
  // sirf uski visibility control hoti hai).
  useEffect(() => {
    const unsubscribe = subscribeWorldChat((latest) => setMessages(latest));
    return unsubscribe;
  }, []);

  useEffect(() => {
    messages.forEach((m) => m.sender_id && ensureRank(m.sender_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    if (show) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages, show]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    // sendOrQueue() nahi - World Chat purposely "best effort, abhi ke
    // liye" hai; agar socket down hai to yeh silently drop ho jaana hi
    // sahi hai (koi persistence/queue nahi chahiye, jaisa rooms mein hota
    // hai).
    networkManager.send({ type: 'world_message', content: trimmed });
    setInput('');
  };

  // Reply dabane par "@username " input mein jod do - DM/Room jaisa hi.
  const handleReply = (username?: string) => {
    setInput((prev) => `${prev}@${username} `);
  };

  const handleProfile = (msg: WorldChatMessage) => {
    onOpenProfile?.({ id: msg.sender_id, username: msg.username });
  };

  const handleReport = (msg: WorldChatMessage) => {
    setReportTarget({ id: msg.sender_id, username: msg.username });
  };

  if (!show) return null;

  return (
    <MotiView
      from={{ opacity: 0, translateX: 24 }}
      animate={{ opacity: 1, translateX: 0 }}
      exit={{ opacity: 0, translateX: 24 }}
      transition={{ type: 'timing', duration: 180 }}
      style={[styles.screen, { zIndex, elevation: 20 }]}
    >
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Pressable onPress={onClose} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={18} color="#d4d4d4" />
        </Pressable>
        <View style={styles.headerIcon}>
          <Ionicons name="globe-outline" size={18} color="#818cf8" />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            World Chat
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Everyone playing right now
          </Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No messages yet - say hi to everyone online!</Text>}
        renderItem={({ item: msg }) => {
          const mine = String(msg.sender_id) === String(getMyId());
          return (
            <WorldMessageBubble
              msg={msg}
              mine={mine}
              photoUrl={avatars[msg.sender_id]?.photoUrl}
              verified={!!verifieds[msg.sender_id]}
              elite={!!elites[msg.sender_id]}
              onReply={() => handleReply(msg.username)}
              onProfile={() => handleProfile(msg)}
              onReport={() => handleReport(msg)}
            />
          );
        }}
      />

      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 16 }]}>
        <TextInput
          style={styles.input}
          placeholder="Message everyone..."
          placeholderTextColor="#6e6e6e"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
        />
        <Pressable onPress={handleSend} style={styles.sendBtn}>
          <Text style={styles.sendBtnText}>Send</Text>
        </Pressable>
      </View>

      <ReportBlockModal mode="report" target={reportTarget} onClose={() => setReportTarget(null)} onDone={() => {}} />
    </MotiView>
  );
};

const styles = StyleSheet.create({
  screen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0a0a', // star-900
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#161616', // star-800
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: 'rgba(129,140,248,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontWeight: '700', color: '#ffffff' },
  headerSubtitle: { fontSize: 11, color: '#6e6e6e' },
  listContent: { flexGrow: 1, padding: 16, gap: 12 },
  emptyText: { color: '#6e6e6e', fontSize: 12, textAlign: 'center', marginTop: 40 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, minWidth: 0 },
  bubbleRowMine: { flexDirection: 'row-reverse' },
  bubbleRowTheirs: { flexDirection: 'row' },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  bubbleCol: { flexDirection: 'column', minWidth: 0 },
  alignEnd: { alignItems: 'flex-end' },
  alignStart: { alignItems: 'flex-start' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2, paddingHorizontal: 4 },
  nameText: { fontSize: 10, color: '#6e6e6e' },
  bubble: { padding: 12, borderRadius: 16 },
  bubbleMine: { backgroundColor: '#4f46e5', borderBottomRightRadius: 2 }, // star-primary-600
  bubbleTheirs: { backgroundColor: '#262626', borderBottomLeftRadius: 2 }, // star-700
  bubbleText: { color: '#ffffff', fontSize: 14 },
  bubbleTime: { fontSize: 9, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  inputRow: { padding: 16, flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#0a0a0a', // star-900
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
  },
  sendBtn: {
    backgroundColor: '#4f46e5', // star-primary-600
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { color: '#ffffff', fontWeight: '700' },
});

export default memo(WorldChatWindow);