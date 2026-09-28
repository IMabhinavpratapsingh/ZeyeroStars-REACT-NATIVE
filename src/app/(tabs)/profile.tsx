import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { getMyId } from '../../shared/utils/auth';
import ProfileViewModal from '../../features/dm/components/ProfileViewModal';
import SettingsMenu from '../../features/dm/components/SettingsMenu';
import CommunityListScreen from '../../features/communities/components/CommunityListScreen';
import useDashboardBalance from '../../features/dashboard/hooks/useDashboardBalance';
import { requestOpenRooms } from '../../shared/utils/navOverlayBus';
import { requestOpenCommunityById } from '../../shared/utils/communityOpenBus';

// WEB -> RN SCOPE NOTE: pehle yahan ek bahut chhota placeholder self-profile
// screen tha (sirf avatar + coins/z_money + logout). Ab web ke ProfileViewModal
// jaisa hi poora component (Bio, Rank/Power/Stars, Community Joined, Your Room,
// Edit Avatar/Edit Profile Photo/Edit Skills, Posts/Store tabs) is tab ka body
// hai - woh khud apna data fetch karta hai (GET /profile/{myId}), isliye
// yahan sirf `profile={{ id: myId }}` + `isMe` pass karna kaafi hai.
//
// "Your Room" card abhi Rooms overlay (list) khol deta hai - poori
// RoomChatWindow floor yahan duplicate nahi ki (woh already Rooms tab mein
// hai); "Community" card apna khud ka CommunityListScreen ("mine" tab) khol
// deta hai, tap karne par global CommunityDetailScreen (_layout.tsx) bus se
// khulta hai. Settings gear SettingsMenu (logout yahin se) kholta hai.
export default function ProfileScreen() {
  const myId = getMyId();
  const pathname = usePathname();
  const isFocused = pathname.includes('/profile');
  const { balance, setBalance } = useDashboardBalance();
  const [showSettings, setShowSettings] = useState(false);
  const [showCommunities, setShowCommunities] = useState(false);
  const [settingsUsername, setSettingsUsername] = useState<string | undefined>();

  return (
    <View style={styles.screen}>
      <ProfileViewModal
        profile={{ id: myId }}
        isMe
        embedded
        active={isFocused}
        onClose={() => router.push('/(tabs)/dashboard')}
        onMessageClick={() => {}}
        onOpenRoom={() => requestOpenRooms()}
        onOpenSettings={(username) => {
          setSettingsUsername(username);
          setShowSettings(true);
        }}
        onOpenMyCommunities={() => setShowCommunities(true)}
      />

      <SettingsMenu
        show={showSettings}
        onClose={() => setShowSettings(false)}
        balance={balance}
        onBalanceUpdate={setBalance}
        currentUsername={settingsUsername}
        onLogout={() => router.replace('/login')}
      />

      <CommunityListScreen
        show={showCommunities}
        onClose={() => setShowCommunities(false)}
        initialTab="mine"
        onOpenCommunity={(c) => {
          setShowCommunities(false);
          requestOpenCommunityById(c);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
});