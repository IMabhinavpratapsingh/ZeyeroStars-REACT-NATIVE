import React, { memo, useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
// IMPORTANT: RN ka FlatList nahi, gesture-handler wala. Floor (neeche) ka
// Pan/Tap GestureDetector drawer ke NEECHE bhi touch pakadta hai (RNGH
// orchestrator un jagahon par jahan upar wale view me koi handler nahi mila,
// neeche ke siblings tak chala jaata hai) - isliye vertical drag floor ka
// camera-pan ban jaata tha aur list scroll nahi hoti thi. RNGH FlatList
// khud ek native-gesture handler hai, to drawer ka poora area "claim" ho
// jaata hai aur floor ko touch milta hi nahi.
import { FlatList } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import CurrencyIcon from '../../../shared/components/CurrencyIcon';
import SwipeableBubble from '../../../shared/components/SwipeableBubble';
import VerifiedBadge from '../../../shared/components/VerifiedBadge';
import EliteBadge from '../../../shared/components/EliteBadge';
import AvatarLayers from '../../avatar/components/AvatarLayers';
import { renderWithMentions } from '../../../shared/utils/renderMentions';
import { getEquippedByCategory as buildEquippedByCategory } from '../../../shared/utils/profileHelpers';
import { AVATAR_ASPECT_RATIO_NUM } from '../../avatar/utils/avatarAssets';
import type { CachedAvatar } from '../../../shared/hooks/useRankCache';

/**
 * Room ka chat-log (transparent drawer / chat-only room ka full screen log).
 *
 * PEHLE (lag + freeze + scroll jam ki wajah):
 * - Yeh RoomChatWindow ke andar ek plain <ScrollView> + `messages.map()` tha -
 *   yaani room ke SAARE messages ek saath mount hote the, aur har message
 *   ke saath AvatarLayers (5+ SVG layers) + SwipeableBubble (gesture +
 *   2 animated styles). Room-history badi ho to chat kholte hi UI freeze.
 * - Drawer `chatDrawerOpen && (...)` se mount/unmount hota tha, yaani har
 *   toggle par poori list dobara build.
 * - Har bubble ko naye inline closures milte the, isliye React.memo bekaar
 *   tha: floor par koi bhi walk/position update poore log ko re-render
 *   karta tha.
 * - `onContentSizeChange` har baar scrollToEnd() maarta tha - avatar/rank
 *   load hote hi content size badalta, aur list user ki ungli se wapas
 *   neeche kheench li jaati thi (scroll "chalta hi nahi" lagta tha).
 *
 * AB:
 * - FlatList (inverted, DMChatWindow jaisa) - sirf screen ke aas-paas ke
 *   rows mount hote hain. Newest message hamesha bottom par rehta hai,
 *   scrollToEnd hack ki zaroorat hi nahi.
 * - Component HAMESHA mounted (pehli baar khulne ke baad) - open/close par
 *   sirf `display: none` toggle hota hai (hide/unhide), unmount nahi.
 * - Saare handlers stable (msg/key argument lete hain), rows memo'd hain,
 *   isliye sirf jo row badli wahi re-render hoti hai.
 * - Sirf latest MAX_LOG_MESSAGES messages render hote hain.
 */

const MAX_LOG_MESSAGES = 150;
const LONG_PRESS_MS = 400;

interface LogItem {
  msg: any;
  key: string;
}

const RoomMessageBubble = memo(function RoomMessageBubble({
  msg, rowKey, isMeMsg, verified, elite, power, avatar, itemsById, myUsername,
  isActive, onToggleActive, onReply, onProfile, onTip, onOpenCommunity,
}: {
  msg: any;
  rowKey: string;
  isMeMsg: boolean;
  verified: boolean;
  elite: boolean;
  power: number | null;
  avatar: CachedAvatar | undefined;
  itemsById: Record<string, any>;
  myUsername?: string;
  isActive: boolean;
  onToggleActive: (key: string) => void;
  onReply: (msg: any) => void;
  onProfile: (msg: any) => void;
  onTip: (msg: any) => void;
  onOpenCommunity?: (slug: string, name: string) => void;
}) {
  const equippedByCategory = useMemo(
    () => (avatar ? buildEquippedByCategory(avatar.equippedItems, itemsById) : null),
    [avatar, itemsById]
  );
  const handleReply = useCallback(() => onReply(msg), [onReply, msg]);
  const handleProfile = useCallback(() => onProfile(msg), [onProfile, msg]);
  const handleTip = useCallback(() => onTip(msg), [onTip, msg]);
  const handleToggle = useCallback(() => onToggleActive(rowKey), [onToggleActive, rowKey]);

  if (msg.isSystem) {
    return (
      <View style={styles.centerRow}>
        <Text style={styles.systemPill}>{msg.content}</Text>
      </View>
    );
  }
  if (msg.isTip) {
    return (
      <View style={styles.centerRow}>
        <View style={styles.tipPill}>
          <CurrencyIcon type="zmoney" size={11} />
          <Text style={styles.tipPillText}>{msg.content}</Text>
        </View>
      </View>
    );
  }

  return (
    <SwipeableBubble align={isMeMsg ? 'end' : 'start'} onReply={handleReply}>
      <View style={[styles.msgRow, isMeMsg ? styles.msgRowMine : styles.msgRowTheirs]}>
        {!isMeMsg && (
          <Pressable onPress={handleProfile} style={styles.avatarSmall}>
            {equippedByCategory ? (
              <AvatarLayers equippedByCategory={equippedByCategory} photoUrl={avatar?.photoUrl} />
            ) : (
              <Text style={styles.avatarSmallLetter}>{(msg.username || '?').charAt(0).toUpperCase()}</Text>
            )}
          </Pressable>
        )}

        <View style={[styles.msgCol, isMeMsg ? styles.alignEnd : styles.alignStart]}>
          <View style={styles.senderRow}>
            <Text style={styles.senderName}>{isMeMsg ? 'You' : msg.username}</Text>
            {verified && <VerifiedBadge size="xs" />}
            {elite && <EliteBadge size="xs" />}
            {power != null && power > 0 && (
              <View style={styles.powerInline}>
                <Ionicons name="flash" size={9} color="#facc15" />
                <Text style={styles.powerInlineText}>{power}</Text>
              </View>
            )}
          </View>
          <Pressable
            onLongPress={handleToggle}
            delayLongPress={LONG_PRESS_MS}
            style={[styles.bubble, isMeMsg ? styles.bubbleMine : styles.bubbleTheirs]}
          >
            <Text style={styles.bubbleText}>{renderWithMentions(msg.content, myUsername, onOpenCommunity)}</Text>
          </Pressable>

          {isActive && (
            <View style={styles.actionMenu}>
              <Pressable onPress={handleReply} style={styles.actionRow}>
                <Ionicons name="arrow-undo-outline" size={14} color="#ffffff" />
                <Text style={styles.actionText}>Reply</Text>
              </Pressable>
              <Pressable onPress={handleProfile} style={styles.actionRow}>
                <Ionicons name="person-outline" size={14} color="#ffffff" />
                <Text style={styles.actionText}>Profile</Text>
              </Pressable>
              {!isMeMsg && (
                <Pressable onPress={handleTip} style={styles.actionRow}>
                  <CurrencyIcon type="zmoney" size={14} />
                  <Text style={styles.actionText}>Tip</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </SwipeableBubble>
  );
});

interface RoomChatLogProps {
  messages: any[];
  /** drawer khula hai AUR room screen dikh rahi hai - false hone par sirf hide hota hai, unmount nahi. */
  visible: boolean;
  /** chat-only room: poori screen opaque log. */
  opaque: boolean;
  myId: any;
  myUsername?: string;
  powers: Record<string, any>;
  verifieds: Record<string, boolean>;
  elites: Record<string, boolean>;
  avatars: Record<string, CachedAvatar>;
  itemsById: Record<string, any>;
  onReply: (msg: any) => void;
  onProfile: (msg: any) => void;
  onTip: (msg: any) => void;
  onOpenCommunity?: (slug: string, name: string) => void;
}

const Separator = () => <View style={styles.separator} />;

const RoomChatLog = ({
  messages, visible, opaque, myId, myUsername,
  powers, verifieds, elites, avatars, itemsById,
  onReply, onProfile, onTip, onOpenCommunity,
}: RoomChatLogProps) => {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const toggleActive = useCallback((key: string) => setActiveKey((prev) => (prev === key ? null : key)), []);

  // Menu ke kisi bhi action ke baad menu band.
  const handleReply = useCallback((m: any) => { setActiveKey(null); onReply(m); }, [onReply]);
  const handleProfile = useCallback((m: any) => { setActiveKey(null); onProfile(m); }, [onProfile]);
  const handleTip = useCallback((m: any) => { setActiveKey(null); onTip(m); }, [onTip]);

  // Inverted list: newest pehle. Key = absolute index (append-only list) -
  // isliye cap lagne ke baad bhi key stable rehti hai.
  const data = useMemo<LogItem[]>(() => {
    const start = Math.max(0, messages.length - MAX_LOG_MESSAGES);
    const out: LogItem[] = [];
    for (let i = messages.length - 1; i >= start; i--) {
      out.push({ msg: messages[i], key: `${messages[i]?.sender_id ?? 's'}:${i}` });
    }
    return out;
  }, [messages]);

  const keyExtractor = useCallback((item: LogItem) => item.key, []);

  const renderItem = useCallback(
    ({ item }: { item: LogItem }) => {
      const { msg, key } = item;
      const sid = msg.sender_id;
      return (
        <RoomMessageBubble
          msg={msg}
          rowKey={key}
          isMeMsg={String(sid) === String(myId)}
          verified={!!verifieds[sid]}
          elite={!!elites[sid]}
          power={powers[sid] ?? null}
          avatar={avatars[sid]}
          itemsById={itemsById}
          myUsername={myUsername}
          isActive={activeKey === key}
          onToggleActive={toggleActive}
          onReply={handleReply}
          onProfile={handleProfile}
          onTip={handleTip}
          onOpenCommunity={onOpenCommunity}
        />
      );
    },
    [myId, myUsername, verifieds, elites, powers, avatars, itemsById, activeKey, toggleActive, handleReply, handleProfile, handleTip, onOpenCommunity]
  );

  return (
    <View
      style={[styles.chatDrawer, opaque && styles.chatDrawerOpaque, !visible && styles.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <FlatList
        data={data}
        inverted
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={Separator}
        initialNumToRender={10}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        overScrollMode="never"
        nestedScrollEnabled
        contentContainerStyle={styles.content}
        style={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  chatDrawer: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '45%', zIndex: 15, backgroundColor: 'rgba(15,19,41,0.72)' },
  chatDrawerOpaque: { top: 0, backgroundColor: '#0f1329' },
  hidden: { display: 'none' },
  list: { flex: 1 },
  content: { padding: 12 },
  separator: { height: 10 },
  centerRow: { alignItems: 'center' },
  systemPill: { fontSize: 11, color: '#a1a1aa', backgroundColor: 'rgba(38,43,82,0.6)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  tipPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(113,63,18,0.2)', borderWidth: 1, borderColor: 'rgba(133,77,14,0.4)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  tipPillText: { fontSize: 11, color: '#fde047' },
  msgRow: { flexDirection: 'row', gap: 8, minWidth: 0 },
  msgRowMine: { flexDirection: 'row-reverse' },
  msgRowTheirs: { flexDirection: 'row' },
  avatarSmall: { height: 72, aspectRatio: AVATAR_ASPECT_RATIO_NUM, borderRadius: 12, backgroundColor: '#33397a', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarSmallLetter: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  msgCol: { flexShrink: 1, maxWidth: '78%' },
  alignEnd: { alignItems: 'flex-end' },
  alignStart: { alignItems: 'flex-start' },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3, paddingHorizontal: 2 },
  senderName: { fontSize: 11, color: '#a1a1aa' },
  powerInline: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  powerInlineText: { fontSize: 9, fontWeight: '700', color: '#facc15' },
  bubble: { padding: 12, borderRadius: 16 },
  bubbleMine: { backgroundColor: '#4f46e5', borderBottomRightRadius: 2 },
  bubbleTheirs: { backgroundColor: '#262b52', borderBottomLeftRadius: 2 },
  bubbleText: { color: '#ffffff', fontSize: 14 },
  actionMenu: { marginTop: 4, backgroundColor: '#1c2044', borderWidth: 1, borderColor: '#2a2f55', borderRadius: 12, overflow: 'hidden' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  actionText: { color: '#ffffff', fontSize: 13 },
});

export default memo(RoomChatLog);