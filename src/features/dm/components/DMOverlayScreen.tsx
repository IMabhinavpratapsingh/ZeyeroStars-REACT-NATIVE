import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import InboxModal from './InboxModal';
import DMChatWindow from './DMChatWindow';
import { setFullscreenOverlayOpen } from '../../../shared/utils/fullscreenOverlayBus';

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
// SCOPE NOTE (jaisa pehle dm.tsx mein tha): tip-in-chat abhi "coming soon"
// hai, trade-in-chat bhi abhi wire nahi hai.
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
}

export default function DMOverlayScreen({ show, onClose }: DMOverlayScreenProps) {
  useBackButtonHandler(show, onClose);

  const [showInbox, setShowInbox] = useState(true);
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
    showNotification,
    isInboxOpen: () => showInbox,
  });

  useWebSocket(dm.wsHandlers);

  useEffect(() => {
    inbox.fetchInbox();
    inbox.fetchDmUnreadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chat khuli ho to BottomNav hide + overlay poori screen tak (neeche sirf input).
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

  // Chat layer inbox (PersistentSlide) ka sibling hai aur `bottom: 0` tak jaati hai -
  // yaani slide-in ke dauran hi BottomNav ko dhak leti hai. Isliye BottomNav/Header
  // ko slide khatam hone ke BAAD hide karte hain (chat ke peeche, koi visible change
  // nahi) aur close shuru hote hi wapas laa dete hain (chat abhi bhi upar hai).
  const chatShown = show && chatVisible;
  useEffect(() => {
    if (!chatShown) {
      setFullscreenOverlayOpen(false);
      return;
    }
    const t = setTimeout(() => setFullscreenOverlayOpen(true), SLIDE_MS);
    return () => clearTimeout(t);
  }, [chatShown]);
  useEffect(() => () => setFullscreenOverlayOpen(false), []);

  // dm object har render badalta hai - ref se handlers stable rakhte hain taaki
  // Inbox (aur uski rows) chat state badalne par bekaar re-render na ho.
  const dmRef = useRef(dm);
  dmRef.current = dm;

  const handleSelectDM = useCallback((row: any) => {
    setShowInbox(false);
    dmRef.current.openChat(row);
  }, []);

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
            unreadTotal={inbox.dmUnread.total_messages}
            requestsList={inbox.requestsList}
            requestsLoading={inbox.requestsLoading}
            requestsLoadingMore={inbox.requestsLoadingMore}
            onLoadMoreRequests={inbox.loadMoreRequests}
            onRefreshRequests={inbox.refreshRequests}
            onAcceptRequest={handleAcceptRequest}
            onDeclineRequest={handleDeclineRequest}
            onDeleteConversation={handleDeleteConversation}
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
          />
        </ChatSlide>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  chatLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#0a0a0a' },
});