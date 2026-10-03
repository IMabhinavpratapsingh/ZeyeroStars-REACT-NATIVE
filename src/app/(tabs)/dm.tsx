import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { getMyId } from '../../shared/utils/auth';
import { showAlert } from '../../shared/utils/alertBus';
import { requestOpenProfile } from '../../shared/utils/profileOpenBus';
import useUserCache from '../../shared/hooks/useUserCache';
import useNotification from '../../shared/hooks/useNotification';
import useWebSocket from '../../shared/hooks/useWebSocket';
import useBackButtonHandler from '../../shared/hooks/useBackButtonHandler';
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
  const router = useRouter();
  // Rooms tab jaisa hi - pathname se focus check (Tabs mount rakhta hai,
  // background tab back-press hijack na kare). Focused par native back
  // -> Dashboard.
  const pathname = usePathname();
  const isFocused = pathname.includes('/dm');
  useBackButtonHandler(isFocused, useCallback(() => router.push('/(tabs)/dashboard'), [router]));

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
        unreadTotal={inbox.dmUnread.senders_count}
        typingIds={dm.dmTypingIds}
        requestsList={inbox.requestsList}
        requestsLoading={inbox.requestsLoading}
        requestsLoadingMore={inbox.requestsLoadingMore}
        onLoadMoreRequests={inbox.loadMoreRequests}
        onRefreshRequests={inbox.refreshRequests}
        onAcceptRequest={async (id) => {
          await dm.acceptMessageRequest(id);
        }}
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
          requestLock={(dm.dmRequestLocks as any)[String(dm.selectedDM.id ?? dm.selectedDM.target_id)] ?? null}
          onAcceptRequest={() => dm.acceptMessageRequest((dm.selectedDM!.id ?? dm.selectedDM!.target_id) as any)}
          onDeclineRequest={() => dm.declineMessageRequest((dm.selectedDM!.id ?? dm.selectedDM!.target_id) as any)}
          onClose={handleCloseChat}
          getMyId={getMyId}
          onDeleteMessage={dm.deleteDMMessage}
          onEditMessage={dm.editDMMessage}
          onTip={() => showAlert('Tipping in chat is coming soon.', 'info')}
          onOpenProfile={(u) => requestOpenProfile(u)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
});