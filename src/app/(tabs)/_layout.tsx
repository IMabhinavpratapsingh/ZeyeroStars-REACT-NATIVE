import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// NOTE: Web version mein "Dashboard" ek hi monolithic page (Dashboard.jsx,
// 4281 lines) tha jismein feed/rooms/profile/DM/games sab internal state
// se (bina real routes ke) render hote the, aur neeche apna custom
// BottomNav.tsx (already converted, shared/components/BottomNav.tsx) tha.
//
// ZSFR ka folder structure alag route files banwata hai (dashboard/feed/
// profile/rooms) - isliye yeh layout un THEORETICAL tabs ke liye standard
// expo-router <Tabs> hai. Dashboard.jsx ka asli 4000+ line logic abhi
// in files mein NAHI toda gaya hai (woh khud ek bada alag feature hai -
// hooks: useFeedState, useRoomState, useDMState, useDashboardBalance,
// etc. sab abhi khali placeholders hain). Filhaal yeh sirf routing
// skeleton hai taaki navigation test ho sake - agla step Dashboard
// breakup hoga.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#71717a',
        tabBarStyle: { backgroundColor: '#000000', borderTopColor: '#27272a' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color, size }) => <Ionicons name="albums-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="rooms"
        options={{
          title: 'Rooms',
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="dm"
        options={{
          title: 'DMs',
          tabBarIcon: ({ color, size }) => <Ionicons name="mail-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}