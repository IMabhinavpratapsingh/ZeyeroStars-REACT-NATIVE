import { useCallback, useMemo, useRef, useState } from 'react';
import networkManager from '../../../shared/services/NetworkManager';
import { getMyId } from '../../../shared/utils/auth';
import { showAlert } from '../../../shared/utils/alertBus';
import { invalidateInventory } from '../../../shared/hooks/useInventory';

/**
 * Web ke Dashboard.jsx ka "Trade handlers" hissa (Highrise jaisa trade):
 * incoming request, outgoing waiting, active trade + saare websocket events.
 *
 * WEB -> RN:
 * - `showTradeToast` (portal div) -> `showAlert` (alertBus) - RN mein
 *   already global alert host hai.
 * - `acceptTradeRequest` ke baad `openChat` `onOpenChat` callback se hota hai
 *   (DM overlay khud khulta hai + chat select hoti hai).
 * - Trade complete par balance `onBalanceMerge` se parent ko milta hai
 *   (sirf z_money aata hai - MERGE karna hai, replace nahi).
 */
export interface TradeOffer {
  items: Record<string, number>;
  z_money: number;
}
export interface ActiveTrade {
  trade_id: string | number;
  myId: string | number;
  otherId: string | number;
  otherUsername?: string;
  offers: Record<string, TradeOffer>;
  confirmed: Record<string, boolean>;
}
export interface IncomingTradeRequest {
  trade_id: string | number;
  from_id: string | number;
  from_username?: string;
}
export interface OutgoingTradeWaiting {
  trade_id: string | number;
  to_id: string | number;
}

interface Args {
  /** Incoming request accept hone par - us user ki DM chat kholni hai */
  onOpenChat: (user: { id: string | number; username?: string }) => void;
  /** trade_completed ke `new_balance` (sirf z_money) ko parent ke balance mein merge karo */
  onBalanceMerge?: (newBalance: { coins?: number; z_money?: number }) => void;
}

export default function useTradeState({ onOpenChat, onBalanceMerge }: Args) {
  const [incomingTradeRequest, setIncomingTradeRequest] = useState<IncomingTradeRequest | null>(null);
  const [outgoingTradeWaiting, setOutgoingTradeWaiting] = useState<OutgoingTradeWaiting | null>(null);
  const [activeTrade, setActiveTrade] = useState<ActiveTrade | null>(null);

  // Handlers stable rahein (useWebSocket ref se latest leta hai, phir bhi
  // callbacks ko latest props chahiye) - isliye latest args ref mein.
  const argsRef = useRef({ onOpenChat, onBalanceMerge });
  argsRef.current = { onOpenChat, onBalanceMerge };
  const activeTradeRef = useRef<ActiveTrade | null>(null);
  activeTradeRef.current = activeTrade;
  const outgoingRef = useRef<OutgoingTradeWaiting | null>(null);
  outgoingRef.current = outgoingTradeWaiting;

  // ---- WebSocket event handlers ----
  const handleTradeRequest = useCallback((data: any) => {
    // Ek waqt mein ek hi incoming request - backend dusri ko busy bolke reject karta hai.
    setIncomingTradeRequest({ trade_id: data.trade_id, from_id: data.from_id, from_username: data.from_username });
  }, []);

  const handleTradeRequestSent = useCallback((data: any) => {
    setOutgoingTradeWaiting({ trade_id: data.trade_id, to_id: data.to_id });
  }, []);

  const handleTradeDeclined = useCallback(() => {
    setOutgoingTradeWaiting(null);
    showAlert('Trade request declined.', 'info');
  }, []);

  const handleTradeStarted = useCallback((data: any) => {
    setIncomingTradeRequest(null);
    setOutgoingTradeWaiting(null);

    const myId = getMyId();
    const iAmP1 = String(data.player1) === String(myId);
    const otherId = iAmP1 ? data.player2 : data.player1;
    const otherUsername = iAmP1 ? data.player2_username : data.player1_username;

    setActiveTrade({
      trade_id: data.trade_id,
      myId: myId as any,
      otherId,
      otherUsername,
      offers: data.offers || {},
      confirmed: data.confirmed || {},
    });
  }, []);

  const handleTradeOfferUpdated = useCallback((data: any) => {
    setActiveTrade((prev) =>
      prev && prev.trade_id === data.trade_id ? { ...prev, offers: data.offers, confirmed: data.confirmed } : prev
    );
  }, []);

  const handleTradeConfirmed = useCallback((data: any) => {
    setActiveTrade((prev) =>
      prev && prev.trade_id === data.trade_id ? { ...prev, confirmed: data.confirmed } : prev
    );
  }, []);

  const handleTradeCompleted = useCallback((data: any) => {
    setActiveTrade(null);
    // new_balance sirf z_money bhejta hai - parent merge karega.
    if (data?.new_balance) argsRef.current.onBalanceMerge?.(data.new_balance);
    // Trade ke baad items turant sab jagah reflect hon.
    invalidateInventory();
    showAlert('Trade successful!', 'success');
  }, []);

  const handleTradeFailed = useCallback((data: any) => {
    setActiveTrade(null);
    showAlert(data?.reason || 'Trade failed.', 'error');
  }, []);

  const handleTradeCancelled = useCallback((data: any) => {
    setActiveTrade((prev) => (prev && prev.trade_id === data.trade_id ? null : prev));
    setOutgoingTradeWaiting((prev) => (prev && prev.trade_id === data.trade_id ? null : prev));
    setIncomingTradeRequest((prev) => (prev && prev.trade_id === data.trade_id ? null : prev));
    showAlert(
      data?.reason === 'disconnect' ? 'The other player went offline, trade cancelled.' : 'Trade cancelled.',
      'info'
    );
  }, []);

  const handleTradeError = useCallback((data: any) => {
    showAlert(data?.message || 'Trade error occurred.', 'error');
  }, []);

  // ---- UI actions ----
  // DMChatWindow ke Trade button se. Backend khud check karta hai target
  // online/busy hai ya nahi aur trade_error bhejta hai.
  const openTrade = useCallback((profile: any) => {
    const targetId = profile?.id || profile?.target_id;
    if (!targetId) return;
    if (!networkManager.isConnected()) {
      showAlert('Not connected. Please check your internet and try again.', 'error');
      return;
    }
    networkManager.send({ type: 'trade_request', target_id: targetId });
  }, []);

  const acceptTradeRequest = useCallback((request: IncomingTradeRequest) => {
    networkManager.send({ type: 'trade_accept', trade_id: request.trade_id });
    setIncomingTradeRequest(null);
    argsRef.current.onOpenChat({ id: request.from_id, username: request.from_username });
  }, []);

  const declineTradeRequest = useCallback((request: IncomingTradeRequest) => {
    networkManager.send({ type: 'trade_decline', trade_id: request.trade_id });
    setIncomingTradeRequest(null);
  }, []);

  const cancelOutgoingTradeRequest = useCallback(() => {
    const w = outgoingRef.current;
    if (!w) return;
    networkManager.send({ type: 'trade_cancel', trade_id: w.trade_id });
    setOutgoingTradeWaiting(null);
  }, []);

  const updateTradeOffer = useCallback((items: Record<string, number>, zMoney: number) => {
    const t = activeTradeRef.current;
    if (!t) return;
    networkManager.send({ type: 'trade_update_offer', trade_id: t.trade_id, items, z_money: zMoney });
  }, []);

  const confirmActiveTrade = useCallback(() => {
    const t = activeTradeRef.current;
    if (!t) return;
    networkManager.send({ type: 'trade_confirm', trade_id: t.trade_id });
  }, []);

  const cancelActiveTrade = useCallback(() => {
    const t = activeTradeRef.current;
    if (!t) return;
    networkManager.send({ type: 'trade_cancel', trade_id: t.trade_id });
    setActiveTrade(null);
  }, []);

  const wsHandlers = useMemo(
    () => ({
      onTradeRequest: handleTradeRequest,
      onTradeRequestSent: handleTradeRequestSent,
      onTradeDeclined: handleTradeDeclined,
      onTradeStarted: handleTradeStarted,
      onTradeOfferUpdated: handleTradeOfferUpdated,
      onTradeConfirmed: handleTradeConfirmed,
      onTradeCompleted: handleTradeCompleted,
      onTradeFailed: handleTradeFailed,
      onTradeCancelled: handleTradeCancelled,
      onTradeError: handleTradeError,
    }),
    [
      handleTradeRequest,
      handleTradeRequestSent,
      handleTradeDeclined,
      handleTradeStarted,
      handleTradeOfferUpdated,
      handleTradeConfirmed,
      handleTradeCompleted,
      handleTradeFailed,
      handleTradeCancelled,
      handleTradeError,
    ]
  );

  return {
    incomingTradeRequest,
    outgoingTradeWaiting,
    activeTrade,
    openTrade,
    acceptTradeRequest,
    declineTradeRequest,
    cancelOutgoingTradeRequest,
    updateTradeOffer,
    confirmActiveTrade,
    cancelActiveTrade,
    wsHandlers,
  };
}

export type UseTradeStateReturn = ReturnType<typeof useTradeState>;