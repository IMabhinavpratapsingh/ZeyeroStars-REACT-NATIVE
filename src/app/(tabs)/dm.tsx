import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { getMyId } from '../../shared/utils/auth';
import { showAlert } from '../../shared/utils/alertBus';
import useUserCache from '../../shared/hooks/useUserCache';
import useNotification from '../../shared/hooks/useNotification';
import useWebSocket from '../../shared/hooks/useWebSocket';
import useInboxState from '../../features/dashboard/hooks/useInboxState';
import useDMState from '../../features/dashboard/hooks/useDMState';
import InboxModal from '../../features/dm/components/InboxModal';
import DMChatWindow from '../../features/dm/components/DMChatWindow';

// WEB -> RN: Dashboard.jsx (web) ka DM/inbox slice - is tab mein
// useInboxState + useDMState (dono already poori tarah likhe hue the,
// sirf kisi screen se instantiate nahi ho rahe the) ko compose karke
// InboxModal + DMChatWindow wire kiya hai.
//
// SCOPE NOTE: `setRoomScreenVisible` aur `closeOtherNavPanels` Dashboard
// (web) mein "dusre panels minimize karo" ke liye the - is standalone tab
// mein koi aur panel nahi hai isliye no-op stubs hain. Tip-in-chat abhi
// "coming soon" hai (TipModal wiring agla pass), trade-in-chat bhi abhi
// wire nahi hai (activeTrade/onTradeRequest waghera undefined chhode hain).
export default function DMScreen() {
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
    <View style={styles.screen}>
      <InboxModal
        show={showInbox}
        inboxList={inbox.inboxList}
        loading={inbox.inboxLoading}
        loadingMore={inbox.inboxLoadingMore}
        onLoadMore={inbox.loadMoreInbox}
        onRefresh={inbox.refreshInbox}
        onClose={() => {}}
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
});