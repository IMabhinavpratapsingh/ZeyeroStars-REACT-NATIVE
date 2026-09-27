import { Redirect } from 'expo-router';
import { getToken } from '../shared/services/NetworkManager';

// WEB -> RN CHANGE: web version App.jsx mein "/" route par hi sync
// isAuthenticated() check karke <Navigate> ho jaata tha (localStorage
// sync tha). RN mein root _layout.tsx AsyncStorage se load hone ke baad
// hi getToken() reliable hai, isliye yahan sirf render karte waqt cached
// (already-loaded) token check kar rahe hain - root _layout ne already
// loadNetworkToken() await kar liya hai isliye ye tab tak render hi nahi
// hota jab tak boot complete na ho.
export default function Index() {
  const token = getToken();

  if (token) {
    return <Redirect href="/(tabs)/dashboard" />;
  }
  return <Redirect href="/login" />;
}