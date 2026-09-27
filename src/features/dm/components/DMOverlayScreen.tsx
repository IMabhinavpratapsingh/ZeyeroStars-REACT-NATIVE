import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
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

  const handleSelectDM = useCallback(
    (row: any) => {
      setShowInbox(false);
      dm.openChat(row);
    },
    [dm]
  );

  const handleCloseChat = useCallback(() => {
    dm.closeChat();
    setShowInbox(true);
  }, [dm]);

  return (
    <PersistentSlide show={show} style={styles.screen}>
      <View style={styles.screen}>
        <InboxModal
          show={showInbox}
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
          onAcceptRequest={(id) => dm.acceptMessageRequest(id)}
          onDeclineRequest={(id) => dm.declineMessageRequest(id)}
          onDeleteConversation={(id) => dm.deleteConversation(id)}
        />

        {!showInbox && dm.selectedDM && (
          <DMChatWindow
            selectedDM={dm.selectedDM}
            chatMessages={dm.chatMessages}
            loading={dm.chatLoading}
            hasMoreMessages={dm.dmHasMore}
            loadingMore={dm.dmLoadingMore}
            onLoadMore={dm.loadMoreDMHistory}
            onSend={dm.sendMessage}
            isOtherTyping={dm.dmOtherTyping}
            onClose={handleCloseChat}
            getMyId={getMyId}
            onDeleteMessage={dm.deleteDMMessage}
            onEditMessage={dm.editDMMessage}
            onTip={() => showAlert('Tipping in chat is coming soon.', 'info')}
          />
        )}
      </View>
    </PersistentSlide>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
});