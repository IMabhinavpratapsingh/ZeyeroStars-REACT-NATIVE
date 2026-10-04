import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { Image } from 'react-native';
import useAvatarImage from '../../avatar/hooks/useAvatarImage';
import { FIELD } from '../../../shared/utils/profileFields';
import { getToken } from '../../../shared/services/NetworkManager';
import { API_BASE } from '../../../shared/config/config';
import {
  applyMemberProfileUpdate,
  getMemberProfilePatch,
  subscribeMemberProfileUpdates,
} from '../services/roomFloorBus';
import CurrencyIcon from '../../../shared/components/CurrencyIcon';
import SwipeableBubble from '../../../shared/components/SwipeableBubble';
import VerifiedBadge from '../../../shared/components/VerifiedBadge';
import EliteBadge from '../../../shared/components/EliteBadge';
import AvatarLayers from '../../avatar/components/AvatarLayers';
import RoomFloorView, { type RoomFloorViewHandle } from './RoomFloorView';
import RoomChessPanel from './RoomChessPanel';
import RoomRadioModal, { type RadioStation } from './RoomRadioModal';
import EditRoomModal from './EditRoomModal';
import RoomInputOverlay from './RoomInputOverlay';
import useRankCache from '../../../shared/hooks/useRankCache';
import useItemsCatalog from '../../../shared/hooks/useItemsCatalog';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { renderWithMentions } from '../../../shared/utils/renderMentions';
import { getEquippedByCategory as buildEquippedByCategory } from '../../../shared/utils/profileHelpers';
import { AVATAR_ASPECT_RATIO_NUM } from '../../avatar/utils/avatarAssets';
import networkManager from '../../../shared/services/NetworkManager';
import { toggleRadioMuted, useRadioMuted } from '../services/radioMute';

/**
 * Web version (RoomChatWindow.jsx, 915 lines) ka RN port - room screen
 * ka shell: header, floor (RoomFloorView), transparent chat-log
 * overlay, members/info drawer, radio/edit-room/chess modals, aur
 * (RoomInputOverlay ke andar) message input.
 *
 * SCOPE: room-shop/novel/community-story/hair-split is port mein
 * shamil nahi hain (jaisa maanga gaya) - "+" quick-actions drawer mein
 * sirf "Play Chess" hai (RoomChessPanel already RN mein ban chuka hai).
 *
 * WEB -> RN CHANGES:
 * - `useLockedViewportHeight` + body-scroll-lock hack (web ka "keyboard
 *   ki wajah se screen resize/jump na ho" fix) hata diya - RN screen
 *   khud hi ek fixed-size native view hai, browser-jaisa viewport
 *   resize/auto-scroll-into-view issue yahan exist hi nahi karta.
 * - `motion/react` -> `moti` MotiView (DMChatWindow jaisa hi pattern).
 * - Scrollable div (chat-log) -> ScrollView, auto-scroll-to-end via ref.
 * - `SwipeableBubble`/`VerifiedBadge`/`EliteBadge`/`AvatarLayers`/
 *   `useRankCache`/`useItemsCatalog`/`useBackButtonHandler`/
 *   `useTopZIndex`/`renderWithMentions` - sab already RN-ported shared
 *   pieces, web jaisa hi istemal.
 * - Long-press (bubble par) -> reply/profile/tip mini-menu, single tap
 *   ki jagah (mobile par long-press hi "options" ka natural gesture hai).
 */

const MAX_FLOOR_BUBBLES_PER_USER = 4;
const FLOOR_BUBBLE_LIFETIME_MS = 4500;
const LONG_PRESS_MS = 400;

// Members list ki chhoti round pfp. Profile roomFloorBus ke cache se aati hai
// (floor already fetch karta hai); chat-only room mein floor nahi hota, isliye
// cache khaali ho to yahin se ek baar fetch kar lete hain.
const MEMBER_PFP = 34;
const MemberAvatar = memo(function MemberAvatar({ userId, username }: { userId: string | number; username?: string }) {
  const [, setTick] = useState(0);
  useEffect(() => subscribeMemberProfileUpdates(() => setTick((t) => t + 1)), []);

  const patch = getMemberProfilePatch(userId);
  const hasProfile = patch[FIELD.avatar] !== undefined || patch[FIELD.avatarVersion] !== undefined;
  useEffect(() => {
    if (hasProfile) return;
    let cancelled = false;
    const token = getToken();
    axios
      .get(`${API_BASE}/profile/${userId}`, token ? { headers: { Authorization: `Bearer ${token}` } } : {})
      .then((res) => {
        if (!cancelled) applyMemberProfileUpdate(userId, res.data || {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, hasProfile]);

  const src = useAvatarImage(userId, patch[FIELD.avatar], patch[FIELD.avatarVersion]);
  return (
    <View style={styles.memberPfp}>
      {src ? (
        <Image source={{ uri: src }} style={styles.memberPfpImg} />
      ) : (
        <Text style={styles.memberPfpInitial}>{(username || '?').charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
});

const RoomMessageBubble = memo(
  ({
    msg, isMeMsg, verified, elite, power, equippedByCategory, photoUrl, myUsername,
    isActive, onToggleActive, onReply, onProfile, onTip, onOpenCommunity,
  }: {
    msg: any; isMeMsg: boolean; verified: boolean; elite: boolean; power: number | null;
    equippedByCategory: Record<string, any> | null; photoUrl?: string | null; myUsername?: string;
    isActive: boolean; onToggleActive: () => void; onReply: () => void; onProfile: () => void;
    onTip: () => void; onOpenCommunity?: (slug: string, name: string) => void;
  }) => {
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
      <SwipeableBubble align={isMeMsg ? 'end' : 'start'} onReply={onReply}>
        <View style={[styles.msgRow, isMeMsg ? styles.msgRowMine : styles.msgRowTheirs]}>
          {!isMeMsg && (
            <Pressable onPress={onProfile} style={styles.avatarSmall}>
              {equippedByCategory ? (
                <AvatarLayers equippedByCategory={equippedByCategory} photoUrl={photoUrl} />
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
              onLongPress={onToggleActive}
              delayLongPress={LONG_PRESS_MS}
              style={[styles.bubble, isMeMsg ? styles.bubbleMine : styles.bubbleTheirs]}
            >
              <Text style={styles.bubbleText}>{renderWithMentions(msg.content, myUsername, onOpenCommunity)}</Text>
            </Pressable>

            {isActive && (
              <View style={styles.actionMenu}>
                <Pressable onPress={onReply} style={styles.actionRow}>
                  <Ionicons name="arrow-undo-outline" size={14} color="#ffffff" />
                  <Text style={styles.actionText}>Reply</Text>
                </Pressable>
                <Pressable onPress={onProfile} style={styles.actionRow}>
                  <Ionicons name="person-outline" size={14} color="#ffffff" />
                  <Text style={styles.actionText}>Profile</Text>
                </Pressable>
                {!isMeMsg && (
                  <Pressable onPress={onTip} style={styles.actionRow}>
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
  }
);

interface RoomChatWindowProps {
  activeRoom: any | null;
  show: boolean;
  roomMessages: Record<string, any[]>;
  onClose: () => void;
  onExit: () => void;
  onSwitchRoom: () => void;
  getMyId: () => any;
  onViewProfile: (u: { id: any; username: string }) => void;
  onTip: (u: { id: any; username: string }, roomId: any) => void;
  members: any[];
  onKick: (id: any) => void;
  onSetRadio: (station: { name: string; url: string }) => void;
  typingUsers: { id: any; username?: string }[];
  onBan: (id: any) => void;
  onOpenBannedList: () => void;
  showBannedList: boolean;
  onCloseBannedList: () => void;
  bannedUsers: any[];
  bannedListLoading: boolean;
  onUnban: (id: any) => void;
  roomPositions: Record<string, { x: number; y: number }>;
  onOpenSettings?: () => void;
  onOpenCommunity?: (slug: string, name: string) => void;
  isPrivileged: () => boolean;
  onRoomSaved?: (patch: any) => void;
}

const RoomChatWindow = ({
  activeRoom, show, roomMessages, onClose, onExit, onSwitchRoom,
  getMyId, onViewProfile, onTip, members, onKick, onSetRadio, typingUsers,
  onBan, onOpenBannedList, showBannedList, onCloseBannedList, bannedUsers, bannedListLoading, onUnban,
  roomPositions, onOpenSettings, onOpenCommunity, isPrivileged, onRoomSaved,
}: RoomChatWindowProps) => {
  const __z = useTopZIndex(!!activeRoom && !!show);
  const scrollRef = useRef<ScrollView>(null);
  const floorRef = useRef<RoomFloorViewHandle>(null);
  const [activeMsgKey, setActiveMsgKey] = useState<string | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showRadioModal, setShowRadioModal] = useState(false);
  const radioMuted = useRadioMuted();
  const insets = useSafeAreaInsets();
  const [showEditRoomModal, setShowEditRoomModal] = useState(false);
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [showRoomDrawer, setShowRoomDrawer] = useState(false);
  const [showChessPanel, setShowChessPanel] = useState(false);

  const [floorBubbles, setFloorBubbles] = useState<Record<string, { id: string; text: string }[]>>({});
  const bubbleTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const { powers, verifieds, elites, avatars, ensureRank } = useRankCache();
  const { itemsById } = useItemsCatalog();

  const [roomMsgInput, setRoomMsgInput] = useState('');
  const roomTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roomTypingSentRef = useRef(false);

  const getEquippedByCategoryFor = useCallback(
    (userId: any) => {
      const av = avatars[userId];
      if (!av) return null;
      return buildEquippedByCategory(av.equippedItems, itemsById);
    },
    [avatars, itemsById]
  );

  useBackButtonHandler(!!activeRoom && !!show, onClose);

  useEffect(() => {
    setRoomMsgInput('');
    roomTypingSentRef.current = false;
    if (roomTypingTimeoutRef.current) {
      clearTimeout(roomTypingTimeoutRef.current);
      roomTypingTimeoutRef.current = null;
    }
    Object.values(bubbleTimeoutsRef.current).forEach(clearTimeout);
    bubbleTimeoutsRef.current = {};
    setFloorBubbles({});
    setShowInfoPanel(false);
  }, [activeRoom?.id]);

  useEffect(() => {
    return () => {
      if (roomTypingTimeoutRef.current) clearTimeout(roomTypingTimeoutRef.current);
      Object.values(bubbleTimeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

  const handleChangeRoomMsgInput = useCallback(
    (val: string) => {
      setRoomMsgInput(val);
      if (!activeRoom) return;
      if (!roomTypingSentRef.current) {
        roomTypingSentRef.current = true;
        networkManager.send({ type: 'room_typing', room_id: activeRoom.id, is_typing: true });
      }
      if (roomTypingTimeoutRef.current) clearTimeout(roomTypingTimeoutRef.current);
      roomTypingTimeoutRef.current = setTimeout(() => {
        roomTypingSentRef.current = false;
        networkManager.send({ type: 'room_typing', room_id: activeRoom.id, is_typing: false });
      }, 2000);
    },
    [activeRoom]
  );

  const handleSendRoomMessage = useCallback(() => {
    if (!roomMsgInput.trim() || !activeRoom) return;
    if (roomTypingTimeoutRef.current) {
      clearTimeout(roomTypingTimeoutRef.current);
      roomTypingTimeoutRef.current = null;
    }
    if (roomTypingSentRef.current) {
      roomTypingSentRef.current = false;
      networkManager.send({ type: 'room_typing', room_id: activeRoom.id, is_typing: false });
    }
    networkManager.send({ type: 'room_message', room_id: activeRoom.id, content: roomMsgInput });
    setRoomMsgInput('');
  }, [roomMsgInput, activeRoom]);

  const messages = roomMessages[activeRoom?.id] || [];

  useEffect(() => {
    messages.forEach((m) => m.sender_id && ensureRank(m.sender_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  useEffect(() => {
    (members || []).forEach((m) => m.user_id && ensureRank(m.user_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members]);

  // Chat-log drawer khulte hi / naya message aane par sabse neeche jump.
  const isChatOnly = !!activeRoom?.chat_only;
  const chatDrawerOpen = isChatOnly || showChatDrawer;
  useEffect(() => {
    if (activeRoom && show && chatDrawerOpen) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
    }
  }, [activeRoom, show, chatDrawerOpen]);
  useEffect(() => {
    if (activeRoom && show && chatDrawerOpen) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Naya message -> sender ke floor-card ke upar chhota speech-bubble.
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.isSystem || last.isTip || !last.sender_id) return;
    const uid = String(last.sender_id);
    const bubbleId = `${uid}:${messages.length}:${Date.now()}`;

    setFloorBubbles((prev) => {
      const existing = prev[uid] || [];
      const nextArr = [...existing, { id: bubbleId, text: last.content }];
      if (nextArr.length > MAX_FLOOR_BUBBLES_PER_USER) {
        const removed = nextArr.splice(0, nextArr.length - MAX_FLOOR_BUBBLES_PER_USER);
        removed.forEach((b) => {
          const key = `${uid}:${b.id}`;
          if (bubbleTimeoutsRef.current[key]) {
            clearTimeout(bubbleTimeoutsRef.current[key]);
            delete bubbleTimeoutsRef.current[key];
          }
        });
      }
      return { ...prev, [uid]: nextArr };
    });

    const key = `${uid}:${bubbleId}`;
    bubbleTimeoutsRef.current[key] = setTimeout(() => {
      setFloorBubbles((prev) => {
        const arr = prev[uid];
        if (!arr) return prev;
        const filtered = arr.filter((b) => b.id !== bubbleId);
        if (filtered.length === arr.length) return prev;
        const next = { ...prev };
        if (filtered.length === 0) delete next[uid];
        else next[uid] = filtered;
        return next;
      });
      delete bubbleTimeoutsRef.current[key];
    }, FLOOR_BUBBLE_LIFETIME_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const typingUserIds = useMemo(() => (typingUsers || []).map((u) => u.id), [typingUsers]);
  const typingNames = (typingUsers || []).map((u) => u.username).filter(Boolean) as string[];
  const typingText =
    typingNames.length === 1
      ? `${typingNames[0]} is typing...`
      : typingNames.length === 2
      ? `${typingNames[0]} and ${typingNames[1]} are typing...`
      : typingNames.length > 2
      ? `${typingNames[0]}, ${typingNames[1]} and ${typingNames.length - 2} others are typing...`
      : '';

  if (!activeRoom) return null;

  const myId = getMyId();
  const isHost = String(activeRoom.owner_id) === String(myId);
  const myUsername = (members || []).find((m) => String(m.user_id) === String(myId))?.username;

  const handleProfile = (msg: any) => {
    onViewProfile({ id: msg.sender_id, username: msg.username });
    setActiveMsgKey(null);
  };
  const handleReply = (msg: any) => {
    setRoomMsgInput((prev) => `${prev}@${msg.username} `);
    setActiveMsgKey(null);
  };
  const handleTip = (msg: any) => {
    onTip({ id: msg.sender_id, username: msg.username }, activeRoom.id);
    setActiveMsgKey(null);
  };
  const handleSelectStation = (station: RadioStation) => {
    if (typeof station.url !== 'string' || !station.url) return;
    onSetRadio({ name: station.name, url: station.url });
    setShowRadioModal(false);
  };

  return (
    <MotiView
      from={{ translateX: 24, opacity: 0 }}
      animate={{ translateX: 0, opacity: 1 }}
      transition={{ type: 'timing', duration: 200 }}
      style={[styles.screen, { zIndex: __z, display: show ? 'flex' : 'none' }]}
    >
      {/* Top bar - status bar / notch ke neeche (safe-area), title center mein */}
      <View style={[styles.header, { paddingTop: insets.top - 18 }]}>
        <Pressable onPress={onClose} style={styles.circleBtn} hitSlop={6}>
          <Ionicons name="chevron-back" size={20} color="#ffffff" />
        </Pressable>

        <View style={styles.titleWrap}>
          <Text style={styles.roomTitle} numberOfLines={1}>{activeRoom.room_name || 'Room'}</Text>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{(members || []).length} online</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {!isChatOnly && (
            <Pressable onPress={() => floorRef.current?.recenterOnSelf()} style={styles.circleBtn} hitSlop={6}>
              <Ionicons name="locate" size={17} color="#ffffff" />
            </Pressable>
          )}
          <Pressable onPress={() => setShowInfoPanel((v) => !v)} style={styles.membersPill} hitSlop={6}>
            <Ionicons name="people" size={15} color="#c7d2fe" />
            <Text style={styles.membersPillText}>{(members || []).length}</Text>
          </Pressable>
          <Pressable onPress={onExit} style={styles.exitCircle} hitSlop={6}>
            <Ionicons name="power" size={16} color="#fca5a5" />
          </Pressable>
        </View>
      </View>

      {/* Floor + chat-log overlay */}
      <View style={styles.floorArea}>
        {!isChatOnly && (
          <RoomFloorView
            ref={floorRef}
            room={activeRoom}
            members={members}
            positions={roomPositions}
            bubbles={floorBubbles}
            typingUserIds={typingUserIds}
            onViewProfile={onViewProfile}
            onTip={onTip}
          />
        )}

        {chatDrawerOpen && (
          <View style={[styles.chatDrawer, isChatOnly && styles.chatDrawerOpaque]} pointerEvents="box-none">
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.chatDrawerContent}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            >
              {messages.map((msg, idx) => {
                const key = `${msg.sender_id}:${idx}`;
                const isMeMsg = String(msg.sender_id) === String(myId);
                return (
                  <RoomMessageBubble
                    key={key}
                    msg={msg}
                    isMeMsg={isMeMsg}
                    verified={!!verifieds[msg.sender_id]}
                    elite={!!elites[msg.sender_id]}
                    power={powers[msg.sender_id] ?? null}
                    equippedByCategory={getEquippedByCategoryFor(msg.sender_id)}
                    photoUrl={avatars[msg.sender_id]?.photoUrl}
                    myUsername={myUsername}
                    isActive={activeMsgKey === key}
                    onToggleActive={() => setActiveMsgKey((k) => (k === key ? null : key))}
                    onReply={() => handleReply(msg)}
                    onProfile={() => handleProfile(msg)}
                    onTip={() => handleTip(msg)}
                    onOpenCommunity={onOpenCommunity}
                  />
                );
              })}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Info drawer - room name/radio/settings + member list (kick/ban for host) */}
      {showInfoPanel && (
        <View style={styles.infoOverlay} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowInfoPanel(false)} />
          <View style={[styles.infoDrawer, { paddingTop: insets.top + 14 }]}>
            <View style={styles.infoDrawerHeader}>
              <Text style={styles.infoDrawerTitle} numberOfLines={1}>{activeRoom.room_name || 'Room'}</Text>
              <Pressable onPress={() => setShowInfoPanel(false)}>
                <Ionicons name="close" size={18} color="#a1a1aa" />
              </Pressable>
            </View>

            <View style={styles.infoDrawerActions}>
              <Pressable onPress={() => setShowRadioModal(true)} style={styles.infoActionBtn}>
                <Ionicons name="musical-notes-outline" size={14} color="#ffffff" />
                <Text style={styles.infoActionText}>Radio</Text>
              </Pressable>
              <Pressable onPress={onSwitchRoom} style={styles.infoActionBtn}>
                <Ionicons name="swap-horizontal" size={14} color="#ffffff" />
                <Text style={styles.infoActionText}>Change Room</Text>
              </Pressable>
              {!!activeRoom.radio_url && (
                <Pressable onPress={toggleRadioMuted} style={styles.infoActionBtn}>
                  <Ionicons name={radioMuted ? 'volume-mute' : 'volume-high-outline'} size={14} color="#ffffff" />
                  <Text style={styles.infoActionText}>{radioMuted ? 'Unmute' : 'Mute'}</Text>
                </Pressable>
              )}
              {isHost && (
                <Pressable onPress={() => setShowEditRoomModal(true)} style={styles.infoActionBtn}>
                  <Ionicons name="settings-outline" size={14} color="#ffffff" />
                  <Text style={styles.infoActionText}>Edit Room</Text>
                </Pressable>
              )}
              {isHost && (
                <Pressable onPress={onOpenBannedList} style={styles.infoActionBtn}>
                  <Ionicons name="ban-outline" size={14} color="#ffffff" />
                  <Text style={styles.infoActionText}>Banned</Text>
                </Pressable>
              )}
              {onOpenSettings && (
                <Pressable onPress={onOpenSettings} style={styles.infoActionBtn}>
                  <Ionicons name="ellipsis-horizontal" size={14} color="#ffffff" />
                  <Text style={styles.infoActionText}>More</Text>
                </Pressable>
              )}
            </View>

            <ScrollView style={styles.memberList}>
              {(members || []).map((m) => (
                <View key={m.user_id} style={styles.memberRow}>
                  <View style={styles.memberInfo}>
                    <MemberAvatar userId={m.user_id} username={m.username} />
                    <Text style={styles.memberName} numberOfLines={1}>
                      {m.username}{String(m.user_id) === String(activeRoom.owner_id) ? ' 👑' : ''}
                    </Text>
                  </View>
                  {isHost && String(m.user_id) !== String(myId) && (
                    <View style={styles.memberActions}>
                      <Pressable onPress={() => onKick(m.user_id)} style={styles.memberActionBtn}>
                        <Text style={styles.memberActionText}>Kick</Text>
                      </Pressable>
                      <Pressable onPress={() => onBan(m.user_id)} style={[styles.memberActionBtn, styles.memberActionBtnDanger]}>
                        <Ionicons name="ban-outline" size={11} color="#fca5a5" />
                        <Text style={[styles.memberActionText, styles.memberActionTextDanger]}>Ban</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      <RoomChessPanel show={showChessPanel} onClose={() => setShowChessPanel(false)} />

      {/* Message input - isolated overlay, keyboard-aware on its own. */}
      <RoomInputOverlay show={!!activeRoom && !!show} zIndex={__z + 1}>
        {!isChatOnly && (
          <>
            {showRoomDrawer && (
              <Pressable style={styles.drawerScrim} onPress={() => setShowRoomDrawer(false)} />
            )}
            <Pressable onPress={() => setShowRoomDrawer((v) => !v)} style={styles.plusBtn}>
              <Ionicons name={showRoomDrawer ? 'close' : 'add'} size={22} color="#ffffff" />
            </Pressable>
            {showRoomDrawer && (
              <View style={styles.quickDrawer}>
                <Pressable
                  onPress={() => {
                    setShowRoomDrawer(false);
                    setShowChessPanel(true);
                  }}
                  style={styles.quickDrawerItem}
                >
                  <Ionicons name="game-controller-outline" size={16} color="#ffffff" />
                  <Text style={styles.quickDrawerText}>Play Chess</Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {chatDrawerOpen && !!typingText && (
          <View style={styles.typingRow}>
            <View style={styles.typingDotsPill}>
              <View style={styles.typingDotSmall} />
              <View style={styles.typingDotSmall} />
              <View style={styles.typingDotSmall} />
            </View>
            <Text style={styles.typingRowText}>{typingText}</Text>
          </View>
        )}

        {!isChatOnly && (
          <Pressable onPress={() => setShowChatDrawer((v) => !v)} style={styles.chatToggle}>
            <Ionicons name={showChatDrawer ? 'chevron-down' : 'chevron-up'} size={16} color="#ffffff" />
          </Pressable>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#6e6e6e"
            value={roomMsgInput}
            onChangeText={handleChangeRoomMsgInput}
            onSubmitEditing={handleSendRoomMessage}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <Pressable onPress={handleSendRoomMessage} style={styles.sendBtn}>
            <Text style={styles.sendBtnText}>Send</Text>
          </Pressable>
        </View>
      </RoomInputOverlay>

      <RoomRadioModal show={showRadioModal} onClose={() => setShowRadioModal(false)} onSelectStation={handleSelectStation} />

      <EditRoomModal
        show={showEditRoomModal}
        room={activeRoom}
        isPrivileged={isPrivileged()}
        onClose={() => setShowEditRoomModal(false)}
        onSaved={(patch: any) => onRoomSaved?.(patch)}
      />

      {showBannedList && (
        <View style={styles.bannedOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCloseBannedList} />
          <View style={styles.bannedCard}>
            <View style={styles.bannedHeader}>
              <View style={styles.bannedHeaderTitleRow}>
                <Ionicons name="ban-outline" size={16} color="#ffffff" />
                <Text style={styles.bannedHeaderTitle}>Banned Users</Text>
              </View>
              <Pressable onPress={onCloseBannedList}>
                <Ionicons name="close" size={18} color="#a1a1aa" />
              </Pressable>
            </View>
            <ScrollView style={styles.bannedList}>
              {bannedListLoading ? (
                <Text style={styles.bannedEmpty}>Loading...</Text>
              ) : (bannedUsers || []).length === 0 ? (
                <Text style={styles.bannedEmpty}>No banned users.</Text>
              ) : (
                (bannedUsers || []).map((u) => (
                  <View key={u.user_id} style={styles.bannedRow}>
                    <Text style={styles.bannedName}>{u.username}</Text>
                    <Pressable onPress={() => onUnban(u.user_id)} style={styles.unbanBtn}>
                      <Ionicons name="arrow-undo-outline" size={12} color="#ffffff" />
                      <Text style={styles.unbanBtnText}>Unban</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </MotiView>
  );
};

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0f1329', flexDirection: 'column' },
  header: {
    paddingHorizontal: 12, paddingBottom: 10, backgroundColor: '#12152b',
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(129,140,248,0.22)', zIndex: 20,
    shadowColor: '#6366f1', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  circleBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  titleWrap: { flex: 1, minWidth: 0 },
  roomTitle: { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#22c55e' },
  liveText: { color: '#a5b4fc', fontSize: 11, fontWeight: '600' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  membersPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: 12, borderRadius: 18,
    backgroundColor: 'rgba(99,102,241,0.22)', borderWidth: 1, borderColor: 'rgba(129,140,248,0.45)',
  },
  membersPillText: { color: '#e0e7ff', fontSize: 12, fontWeight: '800' },
  exitCircle: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(248,113,113,0.12)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.45)',
  },
  floorArea: { flex: 1, position: 'relative', overflow: 'hidden' },
  chatToggle: {
    alignSelf: 'center', marginBottom: 8, width: 36, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(15,19,41,0.7)', borderWidth: 1, borderColor: '#2a2f55',
    alignItems: 'center', justifyContent: 'center',
  },
  chatDrawer: { position: 'absolute', left: 0, right: 0, bottom: 0, top: '45%', zIndex: 15, backgroundColor: 'rgba(15,19,41,0.72)' },
  chatDrawerOpaque: { top: 0, backgroundColor: '#0f1329' },
  chatDrawerContent: { padding: 12, gap: 10 },
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
  infoOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, flexDirection: 'row', justifyContent: 'flex-end' },
  infoDrawer: { width: '78%', maxWidth: 320, backgroundColor: '#161a33', borderLeftWidth: 1, borderLeftColor: '#2a2f55', padding: 14, gap: 12 },
  infoDrawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoDrawerTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700', flexShrink: 1 },
  infoDrawerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  infoActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#262b52', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  infoActionText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  memberList: { flex: 1 },
  memberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#20244a' },
  memberInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  memberPfp: {
    width: MEMBER_PFP, height: MEMBER_PFP, borderRadius: MEMBER_PFP / 2, overflow: 'hidden',
    backgroundColor: '#20244a', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(129,140,248,0.35)',
  },
  memberPfpImg: { width: '100%', height: '100%' },
  memberPfpInitial: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  memberName: { color: '#ffffff', fontSize: 13, flexShrink: 1 },
  memberActions: { flexDirection: 'row', gap: 6 },
  memberActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#20244a', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  memberActionBtnDanger: { borderWidth: 1, borderColor: 'rgba(248,113,113,0.5)' },
  memberActionText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
  memberActionTextDanger: { color: '#fca5a5' },
  drawerScrim: { position: 'absolute', top: -1000, left: -1000, right: -1000, bottom: -1000 },
  plusBtn: {
    position: 'absolute', right: 12, bottom: '100%', marginBottom: 12, width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#4f46e5', borderWidth: 2, borderColor: '#0f1329', alignItems: 'center', justifyContent: 'center', zIndex: 30,
  },
  quickDrawer: {
    position: 'absolute', right: 12, bottom: '100%', marginBottom: 72, backgroundColor: '#1c2044',
    borderWidth: 1, borderColor: '#2a2f55', borderRadius: 16, padding: 6, minWidth: 170, zIndex: 30,
  },
  quickDrawerItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  quickDrawerText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  typingRow: { paddingHorizontal: 16, paddingTop: 6, flexDirection: 'row', alignItems: 'center', gap: 8 },
  typingDotsPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(38,43,82,0.8)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  typingDotSmall: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#a1a1aa' },
  typingRowText: { fontSize: 11, color: '#a1a1aa' },
  inputRow: { padding: 12, flexDirection: 'row', gap: 8, backgroundColor: '#0f1329' },
  input: { flex: 1, backgroundColor: 'rgba(22,26,51,0.8)', borderWidth: 1, borderColor: '#2a2f55', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, color: '#ffffff' },
  sendBtn: { backgroundColor: '#4f46e5', paddingHorizontal: 22, borderRadius: 999, justifyContent: 'center' },
  sendBtnText: { color: '#ffffff', fontWeight: '700' },
  bannedOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 16, zIndex: 999996 },
  bannedCard: { width: '100%', maxWidth: 380, maxHeight: '75%', backgroundColor: '#161a33', borderRadius: 20, borderWidth: 1, borderColor: '#2a2f55', padding: 18 },
  bannedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  bannedHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bannedHeaderTitle: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  bannedList: {},
  bannedEmpty: { color: '#6e6e6e', fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  bannedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0f1329', borderWidth: 1, borderColor: '#2a2f55', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  bannedName: { color: '#ffffff', fontSize: 13 },
  unbanBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#4f46e5', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  unbanBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },
});

export default memo(RoomChatWindow);