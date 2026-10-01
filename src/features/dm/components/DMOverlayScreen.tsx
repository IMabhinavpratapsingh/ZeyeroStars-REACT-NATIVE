import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Keyboard, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { getMyId } from '../../../shared/utils/auth';
import { showAlert } from '../../../shared/utils/alertBus';
import useUserCache from '../../../shared/hooks/useUserCache';
import useNotification from '../../../shared/hooks/useNotification';
import useWebSocket from '../../../shared/hooks/useWebSocket';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import { PersistentSlide } from '../../../shared/components/motion/ScreenTransition';
import useInboxState from '../../dashboard/hooks/useInboxState';
import useDMState from '../../dashboard/hooks/useDMState';
import useTradeState from '../../dashboard/hooks/useTradeState';
import TradeRequestModal from '../../trade/components/TradeRequestModal';
import InboxModal from './InboxModal';
import DMChatWindow from './DMChatWindow';
import WorldChatWindow from './WorldChatWindow';
import { requestOpenProfile } from '../../../shared/utils/profileOpenBus';
import networkManager from '../../../shared/services/NetworkManager';

// WEB -> RN: yeh pehle `app/(tabs)/dm.tsx` tha (ek Tabs.Screen route). Ab
// `(tabs)/_layout.tsx` ke andar Community list/detail jaisa hi ek PERSISTENT
// overlay hai - route change/`router.push` NAHI hota, sirf `show` boolean
// se slide hota hai. Isse Dashboard ke upar "hide/unhide" full-screen
// (Community jaisa hi) behaviour milta hai, aur route-level Tabs-container
// slide (jo poore Tabs blob ko re-animate karta tha) is screen ke liye
// bypass ho jaata hai - isolated, lightweight slide, koi navigation
// overhead nahi.
//
// STATE NOTE: yeh component ab HAMESHA mounted rehta hai (dashboard tab ki
// tarah) - `useInboxState`/`useDMState` (inbox list, open chat, WS
// handlers) kabhi remount/reset nahi hote sirf DM se aana-jaana karne par -
// pehle se BEHTAR hai (route-based Tabs bhi mounted rakhta tha, lekin ab
// route/pathname involve hi nahi hota).
//
// SCOPE NOTE: tip-in-chat abhi "coming soon" hai. Trade-in-chat ab wired hai
// (useTradeState + DMChatWindow ka Trade button).
// Chat ke liye PersistentSlide jaisi hi slide (same duration/easing, bina bounce).
// Inbox neeche hamesha mounted rehta hai, chat uske upar slide hoti hai.
const SLIDE_MS = 260;
const ChatSlide = ({ visible, children }: { visible: boolean; children: ReactNode }) => {
  const { width } = useWindowDimensions();
  const zIndex = useTopZIndex(visible);
  const translateX = useSharedValue(width);
  useEffect(() => {
    translateX.value = withTiming(visible ? 0 : width, {
      duration: SLIDE_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [visible, width, translateX]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.chatLayer, { zIndex, elevation: zIndex }, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
};

interface DMOverlayScreenProps {
  show: boolean;
  onClose: () => void;
  /** Incoming trade request accept hone par DM overlay khud khulna chahiye (kahin se bhi) */
  onOpenOverlay?: () => void;
  /** Header/Profile ka balance - trade Z Money check ke liye */
  myBalance?: { coins?: number; z_money?: number } | null;
  /** trade_completed ka new_balance parent ke balance mein merge karne ke liye */
  onBalanceMerge?: (newBalance: { coins?: number; z_money?: number }) => void;
  /** Kitni conversations mein unread messages hain - BottomNav ke DM button ka badge isi se chalta hai. */
  onUnreadConversationsChange?: (count: number) => void;
}

export default function DMOverlayScreen({ show, onClose, onOpenOverlay, myBalance, onBalanceMerge, onUnreadConversationsChange }: DMOverlayScreenProps) {
  useBackButtonHandler(show, onClose);

  const [showInbox, setShowInbox] = useState(true);
  const [showWorld, setShowWorld] = useState(false);
  const { cacheUser, getUsername } = useUserCache();
  const { notif, showNotification, clearForUser } = useNotification();

  const inbox = useInboxState({
    cacheUser,
    closeOtherNavPanels: () => {},
  });

  const dm = useDMState({
    inbox,
    cacheUser,
    getUsername,
    clearForUser,
    setRoomScreenVisible: () => {},
    // In-app toast ki jagah ab FCM banner aata hai (backend ko dm_view se pata
    // chalta hai ki user Inbox/chat par nahi hai) - dono dikhne se double
    // notification hota tha.
    showNotification: () => {},
    isInboxOpen: () => show && showInbox,
  });

  // Server ko batao: user abhi (app foreground mein) Inbox dekh raha hai ya kisi
  // ki chat. Inbox/chat na khula ho to backend FCM push bhejta hai, bhale
  // websocket connected ho.
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);
  const viewingInbox = show && appActive && showInbox && !showWorld;
  const viewingChatId =
    show && appActive && !showInbox && dm.selectedDM
      ? String((dm.selectedDM as any).id ?? (dm.selectedDM as any).target_id)
      : null;
  useEffect(() => {
    const report = () => networkManager.send({ type: 'dm_view', inbox: viewingInbox, chat: viewingChatId });
    report();
    // Reconnect ke baad server ka view-state reset ho jaata hai - dobara bhejo.
    return networkManager.addStateListener((open) => {
      if (open) report();
    });
  }, [viewingInbox, viewingChatId]);

  // Trade (DM header ke Trade button se) - web Dashboard ka trade state ab yahan.
  // Incoming request accept -> DM overlay khulta hai + us user ki chat select hoti hai.
  const openChatForTradeRef = useRef<(u: { id: string | number; username?: string }) => void>(() => {});
  const trade = useTradeState({
    onOpenChat: (u) => openChatForTradeRef.current(u),
    onBalanceMerge,
  });

  useWebSocket({ ...dm.wsHandlers, ...trade.wsHandlers });

  // Dashboard ke DM button badge ke liye conversation-count parent ko bhejo.
  const unreadConversations = inbox.dmUnread.senders_count;
  useEffect(() => {
    onUnreadConversationsChange?.(unreadConversations);
  }, [unreadConversations, onUnreadConversationsChange]);

  useEffect(() => {
    inbox.fetchInbox();
    inbox.fetchDmUnreadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chat khuli ho to overlay poori screen tak, BottomNav ke upar (nav hide nahi hota).
  const chatVisible = !showInbox && !!dm.selectedDM;
  const [chatMounted, setChatMounted] = useState(false);
  const snapRef = useRef<any>(null);
  if (chatVisible) {
    snapRef.current = {
      selectedDM: dm.selectedDM,
      chatMessages: dm.chatMessages,
      loading: dm.chatLoading,
      hasMore: dm.dmHasMore,
      loadingMore: dm.dmLoadingMore,
      typing: dm.dmOtherTyping,
    };
  }
  useEffect(() => {
    if (chatVisible) {
      setChatMounted(true);
      return;
    }
    // Close: slide-out khatam hone tak chat mounted (last snapshot ke saath) rakho.
    const t = setTimeout(() => {
      setChatMounted(false);
      snapRef.current = null;
    }, SLIDE_MS + 40);
    return () => clearTimeout(t);
  }, [chatVisible]);
  const renderChat = (chatVisible || chatMounted) && !!snapRef.current;
  const snap = snapRef.current;

  // Chat layer inbox (PersistentSlide) ka sibling hai aur `bottom: 0` tak jaati hai
  // (zIndex 1000+ > BottomNav) - yaani BottomNav ke UPAR se dhak leti hai, bilkul
  // Community/Rooms overlays jaisa. BottomNav ko hide/unmount NAHI karte
  // (pehle setFullscreenOverlayOpen se karte the) - isse close karte waqt layout
  // shift / khali jagah pe nav aane ka jhatka khatam.
  const chatShown = show && chatVisible;

  // dm object har render badalta hai - ref se handlers stable rakhte hain taaki
  // Inbox (aur uski rows) chat state badalne par bekaar re-render na ho.
  const dmRef = useRef(dm);
  dmRef.current = dm;

  const handleSelectDM = useCallback((row: any) => {
    setShowInbox(false);
    dmRef.current.openChat(row);
  }, []);

  openChatForTradeRef.current = (u) => {
    onOpenOverlay?.();
    handleSelectDM(u);
  };

  const handleOpenWorldChat = useCallback(() => setShowWorld(true), []);
  const handleCloseWorldChat = useCallback(() => setShowWorld(false), []);
  const handleWorldProfile = useCallback((u: { id: string | number; username?: string }) => requestOpenProfile(u), []);

  // DM overlay band hote hi World Chat bhi band - dobara DM kholne par world chat apne aap na khule.
  useEffect(() => {
    if (!show) setShowWorld(false);
  }, [show]);

  const handleCloseChat = useCallback(() => {
    Keyboard.dismiss();
    dmRef.current.closeChat();
    setShowInbox(true);
  }, []);

  const handleAcceptRequest = useCallback((id: any) => dmRef.current.acceptMessageRequest(id), []);
  const handleDeclineRequest = useCallback((id: any) => dmRef.current.declineMessageRequest(id), []);
  const handleDeleteConversation = useCallback((id: any) => dmRef.current.deleteConversation(id), []);
  const handleLoadMore = useCallback(() => dmRef.current.loadMoreDMHistory(), []);
  const handleSend = useCallback((text: string) => dmRef.current.sendMessage(text), []);
  const handleDeleteMsg = useCallback((id: any) => dmRef.current.deleteDMMessage(id), []);
  const handleEditMsg = useCallback((id: any, c: string) => dmRef.current.editDMMessage(id, c), []);
  const handleTip = useCallback(() => showAlert('Tipping in chat is coming soon.', 'info'), []);

  return (
    <>
      <PersistentSlide show={show} style={styles.screen}>
        <View style={styles.screen}>
          <InboxModal
            show={showInbox || renderChat}
            inboxList={inbox.inboxList}
            loading={inbox.inboxLoading}
            loadingMore={inbox.inboxLoadingMore}
            onLoadMore={inbox.loadMoreInbox}
            onRefresh={inbox.refreshInbox}
            onClose={onClose}
            onSelectDM={handleSelectDM}
            unreadTotal={inbox.dmUnread.senders_count}
            typingIds={dm.dmTypingIds}
            requestsList={inbox.requestsList}
            requestsLoading={inbox.requestsLoading}
            requestsLoadingMore={inbox.requestsLoadingMore}
            onLoadMoreRequests={inbox.loadMoreRequests}
            onRefreshRequests={inbox.refreshRequests}
            onAcceptRequest={handleAcceptRequest}
            onDeclineRequest={handleDeclineRequest}
            onDeleteConversation={handleDeleteConversation}
            onOpenWorldChat={handleOpenWorldChat}
          />
        </View>
      </PersistentSlide>

      {renderChat && (
        <ChatSlide visible={chatShown}>
          <DMChatWindow
            selectedDM={snap.selectedDM}
            chatMessages={snap.chatMessages}
            loading={snap.loading}
            hasMoreMessages={snap.hasMore}
            loadingMore={snap.loadingMore}
            onLoadMore={handleLoadMore}
            onSend={handleSend}
            isOtherTyping={snap.typing}
            onClose={handleCloseChat}
            getMyId={getMyId}
            onDeleteMessage={handleDeleteMsg}
            onEditMessage={handleEditMsg}
            onTip={handleTip}
            activeTrade={trade.activeTrade}
            outgoingTradeWaiting={trade.outgoingTradeWaiting}
            myBalance={myBalance}
            onTradeRequest={trade.openTrade}
            onCancelOutgoingTradeRequest={trade.cancelOutgoingTradeRequest}
            onUpdateTradeOffer={trade.updateTradeOffer}
            onConfirmTrade={trade.confirmActiveTrade}
            onCancelTrade={trade.cancelActiveTrade}
            onOpenProfile={handleWorldProfile}
          />
        </ChatSlide>
      )}

      {/* World Chat - InboxModal ki pehli row se khulta hai */}
      <WorldChatWindow
        show={show && showWorld}
        onClose={handleCloseWorldChat}
        getMyId={getMyId}
        onOpenProfile={handleWorldProfile}
      />

      {/* Incoming trade request - jahan bhi ho turant chhota banner (non-blocking) */}
      <TradeRequestModal
        request={trade.incomingTradeRequest}
        onAccept={trade.acceptTradeRequest}
        onDecline={trade.declineTradeRequest}
        onOpenChat={(req) => openChatForTradeRef.current({ id: req.from_id, username: req.from_username })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  chatLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0a0a0a' },
});