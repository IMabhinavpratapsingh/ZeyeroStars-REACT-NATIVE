import { useCallback, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE } from '../../../shared/config/config';
import networkManager, { getToken } from '../../../shared/services/NetworkManager';
import { getMyId } from '../../../shared/utils/auth';
import { showAlert } from '../../../shared/utils/alertBus';
import showRulesWarning from '../../../shared/utils/rulesWarningBus';
import { showRoomInterstitial } from '../../../shared/services/adsService';
import { getMyRoom } from '../../rooms/services/roomsApi';
import {
  applyMemberProfileUpdate,
  triggerRoomTipFly,
  triggerRoomReaction,
  ROOM_MAIN_GATE_POS,
} from '../../rooms/services/roomFloorBus';

export type RoomMessage = {
  sender_id?: string | number;
  username?: string;
  content?: string;
  isSystem?: boolean;
  isTip?: boolean;
  to_id?: string | number;
  [key: string]: any;
};

export type ActiveRoom = {
  id: string | number;
  radio_name?: string;
  radio_url?: string;
  user_count?: number;
  [key: string]: any;
};

export interface UseRoomStateArgs {
  /** Header profile fetch se - Verified/Elite users ke liye room-join interstitial band */
  isPrivileged: () => boolean;
  /** Dashboard ka closeOtherNavPanels("rooms") - Rooms browser kholte waqt baaki panels band karne ke liye */
  closeOtherNavPanels: (exceptKey: string) => void;
  /** screenLoading overlay - useDashboardBalance/misc hook se */
  beginScreenLoading: (text?: string) => void;
  endScreenLoading: () => void;
}

/**
 * Web ke Dashboard.jsx (4281 lines) ka ROOM (persistent "players_rooms",
 * Highrise-jaisa floor) hissa. Room ki floor-rendering (RoomFloorView.tsx)
 * abhi khud stub hai - iske "member profile patch" / "tip fly" /
 * "emoji reaction" imperative animation triggers isliye ek chhoti alag
 * file (roomFloorBus.ts) mein nikale gaye hain, taaki yeh hook usse
 * consume kar sake bina poori RoomFloorView component ka wait kiye.
 *
 * NOTE: Room ke andar ki CHAT WINDOW ka apna local input/typing-debounce
 * state RoomChatWindow.tsx ke andar hi local rahega (perf ke liye, jaisa
 * web version mein tha) - yahan sirf roomMessages (history) hai.
 */
export default function useRoomState({
  isPrivileged,
  closeOtherNavPanels,
  beginScreenLoading,
  endScreenLoading,
}: UseRoomStateArgs) {
  const [showRoomsModal, setShowRoomsModal] = useState(false);
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);

  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null);
  // Visibilitychange/AppState listener ko hamesha LATEST activeRoom chahiye
  // hota hai bina use dependency mein daale (warna listener baar-baar
  // re-attach karna padta) - isliye ref mein bhi rakha hai.
  const activeRoomRef = useRef<ActiveRoom | null>(null);
  const setActiveRoomBoth = useCallback((updater: ActiveRoom | null | ((prev: ActiveRoom | null) => ActiveRoom | null)) => {
    setActiveRoom((prev) => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      activeRoomRef.current = next;
      return next;
    });
  }, []);

  // Room switch karte waqt "leave old + join new" ka race guard - dekho
  // web-version ka comment (openRoom neeche) - dobara tap/double-switch
  // is dauraan ignore hota hai.
  const roomSwitchPendingRef = useRef(false);
  // Agla "room_joined" ek SILENT resync ka jawab hai (background
  // resume/reconnect) - aisi state mein screen ko zabardasti upar nahi
  // laana (dekho handleRoomJoined).
  const silentRoomResyncRef = useRef(false);

  const [roomScreenVisible, setRoomScreenVisible] = useState(false);
  const [roomMessages, setRoomMessages] = useState<Record<string, RoomMessage[]>>({});
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [roomPositions, setRoomPositions] = useState<Record<string, { x: number; y: number }>>({});
  // Reconnect/rejoin ke waqt apni AKHIRI known position server ko wapas
  // bhejne ke liye (warna server naya/random spawn tile de deta hai).
  const roomPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const setRoomPositionsBoth = useCallback(
    (updater: Record<string, any> | ((prev: Record<string, any>) => Record<string, any>)) => {
      setRoomPositions((prev) => {
        const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
        roomPositionsRef.current = next;
        return next;
      });
    },
    []
  );
  const [roomGrid, setRoomGrid] = useState({ width: 14, height: 10 });

  const [bannedUsers, setBannedUsers] = useState<any[]>([]);
  const [showBannedList, setShowBannedList] = useState(false);
  const [bannedListLoading, setBannedListLoading] = useState(false);

  const [roomTypingUsers, setRoomTypingUsers] = useState<{ id: string | number; username?: string }[]>([]);

  // RoomsStrip (feed ke upar) ke liye - apna room (agar bana rakha hai) +
  // online count. `roomsStripRefreshKey` badalte hi RoomsStrip force-refresh
  // karta hai (app resume par).
  const [myRoom, setMyRoom] = useState<any>(null);
  const [myRoomLoading, setMyRoomLoading] = useState(true);
  const [roomsStripRefreshKey, setRoomsStripRefreshKey] = useState(0);
  const bumpRoomsStripRefresh = useCallback(() => setRoomsStripRefreshKey((k) => k + 1), []);

  const fetchMyRoom = useCallback(async () => {
    try {
      const res = await getMyRoom();
      setMyRoom(res.data?.room || null);
    } catch (err: any) {
      console.error('My room fetch error:', err?.response?.data || err?.message);
    } finally {
      setMyRoomLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------

  const openRoom = useCallback(
    async (room: ActiveRoom) => {
      if (!room?.id || !networkManager.isConnected()) return;

      // Already isi room mein hain - bas screen wapas dikha do (Highrise
      // jaisa: room ek baar join hone ke baad kahin bhi ghoomo, "Rooms"
      // button dabate hi seedha usi room mein wapas aa jaate ho, jab tak
      // khud "Exit Room" na dabao).
      if (activeRoomRef.current && String(activeRoomRef.current.id) === String(room.id)) {
        setRoomScreenVisible(true);
        setShowRoomsModal(false);
        return;
      }

      const proceed = await showRulesWarning('room');
      if (!proceed) return;

      if (roomSwitchPendingRef.current) return;

      const hadPreviousRoom = !!(activeRoomRef.current && networkManager.isConnected());
      if (hadPreviousRoom) {
        networkManager.send({ type: 'room_leave', room_id: activeRoomRef.current!.id });
      }

      roomSwitchPendingRef.current = true;
      // Safety net - agar switch ke dauraan connection drop ho jaaye, koi
      // bhi jawab (room_joined/room_error) kabhi nahi aayega - 6s baad
      // khud-ba-khud clear kar do (warna future switches bhi block ho jaate).
      setTimeout(() => {
        roomSwitchPendingRef.current = false;
      }, 6000);

      // TAP karte hi turant loading dikhao - server ke jawab ka wait nahi
      // karna. handleRoomJoined/handleRoomError isko band karenge.
      beginScreenLoading('Entering room...');

      const sendJoin = () => {
        networkManager.send({
          type: 'room_join',
          room_id: room.id,
          x: ROOM_MAIN_GATE_POS.x,
          y: ROOM_MAIN_GATE_POS.y,
        });
        if (!isPrivileged()) {
          showRoomInterstitial();
        }
      };

      if (hadPreviousRoom) {
        // room_leave server par thoda async cleanup kar sakta hai - ek
        // chhota safe gap dekar leave ko pehle poora settle hone dete hain.
        setTimeout(sendJoin, 150);
      } else {
        sendJoin();
      }

      setShowRoomsModal(false);
    },
    [beginScreenLoading, isPrivileged]
  );

  /** Room ki SCREEN band karo - membership barkarar rehti hai. */
  const minimizeRoom = useCallback(() => {
    setRoomScreenVisible(false);
  }, []);

  /** Room se ASAL mein nikalna - "Exit Room" button (ya kick) se hi chalta hai. */
  const exitRoom = useCallback(() => {
    if (activeRoomRef.current && networkManager.isConnected()) {
      networkManager.send({ type: 'room_leave', room_id: activeRoomRef.current.id });
    }
    setActiveRoomBoth(null);
    setRoomMembers([]);
    setRoomScreenVisible(false);
    setRoomTypingUsers([]);
  }, [setActiveRoomBoth]);

  /** BottomNav "Rooms" button - already room mein ho to screen toggle, warna browser modal. */
  const handleRoomsNavClick = useCallback(() => {
    if (activeRoomRef.current) {
      setRoomScreenVisible((prev) => !prev);
    } else {
      setShowRoomsModal((prev) => {
        const next = !prev;
        if (next) closeOtherNavPanels('rooms');
        return next;
      });
    }
  }, [closeOtherNavPanels]);

  const handleSetRoomRadio = useCallback((station: { name: string; url: string }) => {
    if (!activeRoomRef.current || !networkManager.isConnected()) return;
    networkManager.send({
      type: 'room_set_radio',
      room_id: activeRoomRef.current.id,
      radio_name: station.name,
      radio_url: station.url,
    });
  }, []);

  const handleKickUser = useCallback((targetId: string | number) => {
    if (!activeRoomRef.current || !networkManager.isConnected()) return;
    networkManager.send({ type: 'room_kick', room_id: activeRoomRef.current.id, target_id: targetId });
  }, []);

  const handleBanUser = useCallback((targetId: string | number) => {
    if (!activeRoomRef.current || !networkManager.isConnected()) return;
    networkManager.send({ type: 'room_ban', room_id: activeRoomRef.current.id, target_id: targetId });
  }, []);

  const handleUnbanUser = useCallback((targetId: string | number) => {
    if (!activeRoomRef.current || !networkManager.isConnected()) return;
    networkManager.send({ type: 'room_unban', room_id: activeRoomRef.current.id, target_id: targetId });
    // Optimistic - list se turant hata do, ban_unack aane par backend ke saath consistent ho hi jaayega.
    setBannedUsers((prev) => prev.filter((u) => String(u.user_id) !== String(targetId)));
  }, []);

  const fetchBannedUsers = useCallback(async () => {
    if (!activeRoomRef.current) return;
    setBannedListLoading(true);
    try {
      const token = getToken();
      const res = await axios.get(`${API_BASE}/rooms/${activeRoomRef.current.id}/banned`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBannedUsers(res.data.banned || []);
    } catch (err: any) {
      console.error('fetchBannedUsers error:', err?.response?.data || err?.message);
    } finally {
      setBannedListLoading(false);
    }
  }, []);

  const openBannedList = useCallback(() => {
    setShowBannedList(true);
    fetchBannedUsers();
  }, [fetchBannedUsers]);

  /** Feed post ke "🏠 Room" button se - us author abhi kis room mein hain wahan jump karo. */
  const openUserRoom = useCallback(
    async (user: { id?: string | number; username?: string }, knownRoom?: ActiveRoom) => {
      const targetId = user?.id;
      if (!targetId) return;
      if (knownRoom) {
        openRoom(knownRoom);
        return;
      }
      try {
        const res = await axios.get(`${API_BASE}/rooms/user/${targetId}/current`);
        if (res.data?.room) {
          openRoom(res.data.room);
        } else {
          showAlert(`${user.username || 'This user'} is not in a room right now.`);
        }
      } catch (err) {
        console.error('openUserRoom error:', err);
        showAlert('Could not load room.');
      }
    },
    [openRoom]
  );

  // ---------------------------------------------------------------------
  // App lifecycle (background/foreground) - Dashboard/root layout ka
  // AppState listener inhe call karega.
  // ---------------------------------------------------------------------

  /** App background mein ja rahi hai - agar room mein the to explicit room_leave bhejo (ghost-avatar bug fix). */
  const handleAppHidden = useCallback(() => {
    if (activeRoomRef.current && networkManager.isConnected()) {
      networkManager.send({ type: 'room_leave', room_id: activeRoomRef.current.id });
    }
  }, []);

  /** App wapas foreground mein aayi (aur socket zinda hai) - silently room_join resend karo, apni akhri position ke saath. */
  const rejoinRoomIfNeeded = useCallback(() => {
    if (!activeRoomRef.current) return;
    silentRoomResyncRef.current = true;
    const myLastPos = roomPositionsRef.current[String(getMyId())];
    networkManager.send({
      type: 'room_join',
      room_id: activeRoomRef.current.id,
      ...(myLastPos ? { x: myLastPos.x, y: myLastPos.y } : {}),
    });
  }, []);

  // ---------------------------------------------------------------------
  // Websocket handlers - Dashboard inko useWebSocket() ke merged handlers
  // object mein spread karega.
  // ---------------------------------------------------------------------

  const handleRoomJoined = useCallback(
    (data: any) => {
      roomSwitchPendingRef.current = false;
      setActiveRoomBoth(data.room);

      if (silentRoomResyncRef.current) {
        silentRoomResyncRef.current = false;
      } else {
        setRoomScreenVisible(true);
      }
      setRoomTypingUsers([]);
      setRoomPositionsBoth(data.positions || {});
      if (data.grid) setRoomGrid(data.grid);

      // Double rAF - room floor render/paint ho chuki ho, tabhi overlay
      // hatao (warna khaali/half-drawn room ek pal ke liye dikh jaata).
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          endScreenLoading();
        });
      });
    },
    [endScreenLoading, setActiveRoomBoth, setRoomPositionsBoth]
  );

  const handleRoomPlayerMoved = useCallback(
    (data: any) => {
      setRoomPositionsBoth((prev) => ({ ...prev, [data.user_id]: { x: data.x, y: data.y } }));
    },
    [setRoomPositionsBoth]
  );

  const handleRoomEquipUpdate = useCallback((data: any) => {
    const patch: Record<string, any> = {};
    if (data.equipped_items !== undefined) patch.equipped_items = data.equipped_items;
    applyMemberProfileUpdate(data.user_id, patch);
  }, []);

  const handleRoomAvatarUpdate = useCallback((data: any) => {
    applyMemberProfileUpdate(data.user_id, {
      avatar_url: data.avatar_url,
      avatar_version: data.avatar_version,
    });
  }, []);

  const handleRoomMessage = useCallback((data: any) => {
    setRoomMessages((prev) => ({
      ...prev,
      [data.room_id]: [
        ...(prev[data.room_id] || []),
        { sender_id: data.sender_id, username: data.username, content: data.content },
      ],
    }));
    setRoomTypingUsers((prev) => prev.filter((u) => String(u.id) !== String(data.sender_id)));
  }, []);

  const handleRoomSystem = useCallback((data: any) => {
    const text =
      data.event === 'joined'
        ? `${data.username || 'Someone'} joined the room`
        : `${data.username || 'Someone'} left the room`;
    setRoomMessages((prev) => ({
      ...prev,
      [data.room_id]: [...(prev[data.room_id] || []), { isSystem: true, content: text, sender_id: data.sender_id }],
    }));
  }, []);

  const handleRoomTyping = useCallback((data: any) => {
    if (!activeRoomRef.current || String(data.room_id) !== String(activeRoomRef.current.id)) return;
    if (String(data.sender_id) === String(getMyId())) return;
    setRoomTypingUsers((prev) => {
      const filtered = prev.filter((u) => String(u.id) !== String(data.sender_id));
      if (data.is_typing) return [...filtered, { id: data.sender_id, username: data.username }];
      return filtered;
    });
  }, []);

  const handleRoomMembersUpdate = useCallback(
    (data: any) => {
      setActiveRoomBoth((prev) => {
        if (!prev || String(prev.id) !== String(data.room_id)) return prev;
        setRoomMembers(data.members || []);
        const memberIds = new Set((data.members || []).map((m: any) => String(m.user_id)));
        setRoomPositionsBoth((prevPositions) => {
          const next: Record<string, any> = {};
          for (const [uid, pos] of Object.entries(prevPositions)) {
            if (memberIds.has(String(uid))) next[uid] = pos;
          }
          return next;
        });
        return { ...prev, user_count: (data.members || []).length };
      });
    },
    [setActiveRoomBoth, setRoomPositionsBoth]
  );

  const handleRoomKicked = useCallback(
    (data: any) => {
      setActiveRoomBoth((prev) => {
        if (!prev || String(prev.id) !== String(data.room_id)) return prev;
        showAlert('You have been kicked from this room.');
        setRoomMembers([]);
        setRoomPositionsBoth({});
        setRoomScreenVisible(false);
        return null;
      });
    },
    [setActiveRoomBoth, setRoomPositionsBoth]
  );

  const handleRoomBanned = useCallback(
    (data: any) => {
      setActiveRoomBoth((prev) => {
        if (!prev || String(prev.id) !== String(data.room_id)) return prev;
        showAlert('You have been banned from this room.');
        setRoomMembers([]);
        setRoomPositionsBoth({});
        setRoomScreenVisible(false);
        return null;
      });
    },
    [setActiveRoomBoth, setRoomPositionsBoth]
  );

  // NOTE: dono handlers ek ref (showBannedListRef) ke through current
  // showBannedList padhte hain - state ko dependency mein daalne se
  // useWebSocket ke merged-handlers object ko baar baar naya banane se
  // bachte hain (dekho useWebSocket.ts - woh khud bhi ref-based hai,
  // isliye yahan bhi wahi pattern istemal kiya).
  const showBannedListRef = useRef(showBannedList);
  showBannedListRef.current = showBannedList;

  const handleRoomBanAck = useCallback(() => {
    if (showBannedListRef.current) fetchBannedUsers();
  }, [fetchBannedUsers]);

  const handleRoomUnbanAck = useCallback(() => {
    if (showBannedListRef.current) fetchBannedUsers();
  }, [fetchBannedUsers]);

  const handleRoomRadioUpdate = useCallback(
    (data: any) => {
      setActiveRoomBoth((prev) => {
        if (!prev || String(prev.id) !== String(data.room_id)) return prev;
        return { ...prev, radio_name: data.radio_name, radio_url: data.radio_url };
      });
    },
    [setActiveRoomBoth]
  );

  const handleRoomError = useCallback(
    (data: any) => {
      roomSwitchPendingRef.current = false;
      silentRoomResyncRef.current = false;
      endScreenLoading();
      showAlert(data.message || 'Something went wrong in the room.');
    },
    [endScreenLoading]
  );

  /** Room floor par emoji reaction (long-press popup) - koi state persist nahi, sirf animation trigger. */
  const handleRoomReaction = useCallback((data: any) => {
    triggerRoomReaction(data.room_id, data.from_id, data.target_id, data.emoji);
  }, []);

  /** Room mein tip receive hui - chat feed mein system-style bubble + floor par coin-fly animation. */
  const handleRoomTipMessage = useCallback((data: any, tipEntry: RoomMessage) => {
    setRoomMessages((prev) => ({
      ...prev,
      [data.room_id]: [...(prev[data.room_id] || []), tipEntry],
    }));
    triggerRoomTipFly(data.room_id, data.from_id, data.to_id, data.amount);
  }, []);

  return {
    // state
    showRoomsModal,
    setShowRoomsModal,
    showCreateRoomModal,
    setShowCreateRoomModal,
    activeRoom,
    roomScreenVisible,
    setRoomScreenVisible,
    roomMessages,
    roomMembers,
    roomPositions,
    roomGrid,
    bannedUsers,
    showBannedList,
    setShowBannedList,
    bannedListLoading,
    roomTypingUsers,
    myRoom,
    setMyRoom,
    myRoomLoading,
    roomsStripRefreshKey,
    bumpRoomsStripRefresh,

    // actions
    fetchMyRoom,
    openRoom,
    minimizeRoom,
    exitRoom,
    handleRoomsNavClick,
    handleSetRoomRadio,
    handleKickUser,
    handleBanUser,
    handleUnbanUser,
    fetchBannedUsers,
    openBannedList,
    openUserRoom,

    // app lifecycle (AppState listener consumes these)
    handleAppHidden,
    rejoinRoomIfNeeded,

    // room_id -> tip websocket dispatch (called from a shared tip handler, dekho useDMState/agla misc hook)
    handleRoomTipMessage,

    // ws handlers - Dashboard spreads these into the single useWebSocket() call
    wsHandlers: {
      onRoomJoined: handleRoomJoined,
      onRoomPlayerMoved: handleRoomPlayerMoved,
      onRoomEquipUpdate: handleRoomEquipUpdate,
      onRoomAvatarUpdate: handleRoomAvatarUpdate,
      onRoomMessage: handleRoomMessage,
      onRoomSystem: handleRoomSystem,
      onRoomTyping: handleRoomTyping,
      onRoomMembersUpdate: handleRoomMembersUpdate,
      onRoomKicked: handleRoomKicked,
      onRoomBanned: handleRoomBanned,
      onRoomBanAck: handleRoomBanAck,
      onRoomUnbanAck: handleRoomUnbanAck,
      onRoomRadioUpdate: handleRoomRadioUpdate,
      onRoomError: handleRoomError,
      onRoomReaction: handleRoomReaction,
    },
  };
}

export type UseRoomStateReturn = ReturnType<typeof useRoomState>;