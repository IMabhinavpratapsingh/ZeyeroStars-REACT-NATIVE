import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import networkManager, { clearToken } from '../services/NetworkManager';
import { clearUserScopedCaches } from '../services/persistentCache';
import { buildBanMessage, clearMyId } from '../utils/auth';
import { showAlert } from '../utils/alertBus';

// Ban ka server-side push event: admin ne user ko ban kiya - agar user us
// waqt live/connected hai to backend seedha isi "banned" message ke through
// bata deta hai (websocket khud bhi 4403 code se close hota hai).
//
// WEB -> RN DIFFERENCES:
// 1. Web mein `window.location.href = "/"` se page reload hota tha - isse
//    saari JS state (token, my_id, socket, handledBan flag) apne aap reset
//    ho jaati thi. RN mein reload nahi hota, isliye yahan manually:
//    token/my_id/socket/caches clear + router.replace('/login').
// 2. Ban message ab localStorage ("z_ban_message") ke raaste nahi jaata -
//    app mount hi rehti hai, isliye seedha showAlert() (authInterceptor.ts
//    bhi yehi karta hai).
// 3. `handledBan` guard ab har naye hook-mount par reset hota hai (neeche
//    useEffect) - warna ek baar ban-event handle hone ke baad, us hi app
//    session mein dusra account login karke ban hota to event ignore ho
//    jaata (web mein reload guard khud reset kar deta tha).
let handledBan = false;

function handleGlobalBan(data: any) {
  if (handledBan) return;
  handledBan = true;

  clearToken().catch(() => {}); // in-memory token turant (sync) null hota hai
  networkManager.disconnect();
  clearMyId().catch(() => {});
  clearUserScopedCaches().catch(() => {});

  try {
    router.replace('/login');
  } catch (e) {
    console.error('useWebSocket: navigation to /login failed (router not ready?)', e);
  }

  showAlert(buildBanMessage(data?.reason));
}

export type WSHandler = (data: any) => void;

/**
 * Har handler OPTIONAL hai - jo pass karoge wahi chalega. Naam web version
 * ke props se bilkul same rakhe hain (Dashboard hooks ab bhi wahi naam
 * pass kar sakte hain).
 */
export interface WebSocketHandlers {
  // --- Chat ---
  onBroadcast?: WSHandler;
  onMention?: WSHandler;
  // --- DM ---
  onDM?: WSHandler;
  onDMDelete?: WSHandler;
  onDMEdit?: WSHandler;
  onDMEditAck?: WSHandler;
  onDMEditError?: WSHandler;
  onDMAck?: WSHandler;
  onDMBlocked?: WSHandler;
  onDMTyping?: WSHandler;
  onDMSeen?: WSHandler;
  onDMRequestPending?: WSHandler;
  onDMRequestAccepted?: WSHandler;
  // --- Battle ---
  onMatchFound?: WSHandler;
  onSetupRoom?: WSHandler;
  onBattleStart?: WSHandler;
  onRoundOver?: WSHandler;
  onRoundResult?: WSHandler;
  onMatchEnd?: WSHandler;
  onSkillOnCooldown?: WSHandler;
  onMatchmakingError?: WSHandler;
  // --- Trade ---
  onTradeRequest?: WSHandler;
  onTradeRequestSent?: WSHandler;
  onTradeDeclined?: WSHandler;
  onTradeStarted?: WSHandler;
  onTradeOfferUpdated?: WSHandler;
  onTradeConfirmed?: WSHandler;
  onTradeCompleted?: WSHandler;
  onTradeFailed?: WSHandler;
  onTradeCancelled?: WSHandler;
  onTradeError?: WSHandler;
  // --- Misc ---
  onInventoryUnequipped?: WSHandler;
  onTipMessage?: WSHandler;
  onTipError?: WSHandler;
  onBalanceUpdate?: WSHandler;
  onNotificationPing?: WSHandler;
  // --- Room ---
  onRoomJoined?: WSHandler;
  onRoomMessage?: WSHandler;
  onRoomMembersUpdate?: WSHandler;
  onRoomUserLeft?: WSHandler;
  onRoomKicked?: WSHandler;
  onRoomBanned?: WSHandler;
  onRoomBanAck?: WSHandler;
  onRoomUnbanAck?: WSHandler;
  onRoomRadioUpdate?: WSHandler;
  onRoomError?: WSHandler;
  onRoomTyping?: WSHandler;
  onRoomSystem?: WSHandler;
  onRoomPlayerMoved?: WSHandler;
  onRoomEquipUpdate?: WSHandler;
  onRoomAvatarUpdate?: WSHandler;
  onRoomReaction?: WSHandler;
  onRoomSlotsUpdate?: WSHandler;
  // --- Bluff ---
  onBluffQueued?: WSHandler;
  onBluffQueueLeft?: WSHandler;
  onBluffMatchFound?: WSHandler;
  onBluffPlayUpdate?: WSHandler;
  onBluffTurnSkipped?: WSHandler;
  onBluffReveal?: WSHandler;
  onBluffNewRound?: WSHandler;
  onBluffPlayerLeft?: WSHandler;
  onBluffGameOver?: WSHandler;
  onBluffError?: WSHandler;
  onBluffLobbyCreated?: WSHandler;
  onBluffLobbyUpdate?: WSHandler;
  onBluffLobbyLeft?: WSHandler;
}

// Server event `type` -> handler prop ka naam. Web mein yeh 65 if/else-if
// aur 65 alag useRef/useEffect the - ab ek lookup table + ek single
// handlersRef (neeche) - behaviour bilkul same, sirf boilerplate khatam.
// Naya event add karna ho: interface mein handler + yahan ek line.
const EVENT_TO_HANDLER: Record<string, keyof WebSocketHandlers> = {
  // --- Chat ---
  broadcast: 'onBroadcast',
  mention: 'onMention',
  // --- DM ---
  dm: 'onDM',
  dm_delete: 'onDMDelete',
  dm_edit: 'onDMEdit',
  dm_edit_ack: 'onDMEditAck',
  dm_edit_error: 'onDMEditError',
  dm_self_ack: 'onDMAck',
  dm_blocked: 'onDMBlocked',
  dm_typing: 'onDMTyping',
  dm_seen: 'onDMSeen',
  dm_request_pending: 'onDMRequestPending',
  dm_request_accepted: 'onDMRequestAccepted',
  // --- Battle ---
  match_found: 'onMatchFound',
  setup_room: 'onSetupRoom',
  battle_start: 'onBattleStart',
  round_over: 'onRoundOver',
  round_result: 'onRoundResult',
  match_end: 'onMatchEnd',
  skill_on_cooldown: 'onSkillOnCooldown',
  // --- Trade ---
  trade_request: 'onTradeRequest',
  trade_request_sent: 'onTradeRequestSent',
  trade_declined: 'onTradeDeclined',
  trade_started: 'onTradeStarted',
  trade_offer_updated: 'onTradeOfferUpdated',
  trade_confirmed: 'onTradeConfirmed',
  trade_completed: 'onTradeCompleted',
  trade_failed: 'onTradeFailed',
  trade_cancelled: 'onTradeCancelled',
  trade_error: 'onTradeError',
  // --- Misc ---
  inventory_unequipped: 'onInventoryUnequipped',
  tip_message: 'onTipMessage',
  tip_error: 'onTipError',
  balance_update: 'onBalanceUpdate',
  notification_ping: 'onNotificationPing',
  // --- Room ---
  room_joined: 'onRoomJoined',
  room_message: 'onRoomMessage',
  room_members_update: 'onRoomMembersUpdate',
  room_user_left: 'onRoomUserLeft',
  room_kicked: 'onRoomKicked',
  room_banned: 'onRoomBanned',
  room_ban_ack: 'onRoomBanAck',
  room_unban_ack: 'onRoomUnbanAck',
  room_radio_update: 'onRoomRadioUpdate',
  room_error: 'onRoomError',
  room_typing: 'onRoomTyping',
  room_system: 'onRoomSystem',
  room_player_moved: 'onRoomPlayerMoved',
  room_equip_update: 'onRoomEquipUpdate',
  room_avatar_update: 'onRoomAvatarUpdate',
  room_reaction: 'onRoomReaction',
  room_slots_update: 'onRoomSlotsUpdate',
  // --- Bluff ---
  bluff_queued: 'onBluffQueued',
  bluff_queue_left: 'onBluffQueueLeft',
  bluff_match_found: 'onBluffMatchFound',
  bluff_play_update: 'onBluffPlayUpdate',
  bluff_turn_skipped: 'onBluffTurnSkipped',
  bluff_reveal: 'onBluffReveal',
  bluff_new_round: 'onBluffNewRound',
  bluff_player_left: 'onBluffPlayerLeft',
  bluff_game_over: 'onBluffGameOver',
  bluff_error: 'onBluffError',
  bluff_lobby_created: 'onBluffLobbyCreated',
  bluff_lobby_update: 'onBluffLobbyUpdate',
  bluff_lobby_left: 'onBluffLobbyLeft',
};

export default function useWebSocket(handlers: WebSocketHandlers): void {
  // Poore handlers object ka latest version ref mein - har render par
  // update hota hai, isliye listener KABHI re-subscribe nahi hota aur
  // stale closure ka issue bhi nahi (web ke 65 alag refs ka wahi kaam tha).
  const handlersRef = useRef<WebSocketHandlers>(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    handledBan = false; // naya login/mount - purana ban-guard reset (upar note 3)

    // PEHLE (web) har 300ms `networkManager.ws` poll karke seedha
    // `ws.onmessage` overwrite hota tha - reconnect ke baad ke pehle
    // messages gum ho jaate the. Ab NetworkManager khud (race-free) har
    // message registered listeners ko deta hai - hum bas ek listener
    // register karte hain, socket instance se seedha chhedchaad nahi.
    const handleMessage = (data: any) => {
      if (!data) return;

      if (data.type === 'banned') {
        handleGlobalBan(data);
        return;
      }

      const handlerName = EVENT_TO_HANDLER[data.type];
      if (!handlerName) return;

      const fn = handlersRef.current[handlerName];
      if (fn) fn(data);
    };

    const unsubscribe = networkManager.addListener(handleMessage);
    return unsubscribe;
  }, []);
}