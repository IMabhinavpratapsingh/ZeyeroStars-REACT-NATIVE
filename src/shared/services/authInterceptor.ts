import axios, { AxiosError } from 'axios';
import { router } from 'expo-router';
import networkManager, { clearToken, getToken } from './NetworkManager';
import { clearUserScopedCaches } from './persistentCache';
import { buildBanMessage, clearMyId } from '../utils/auth';
import { showAlert } from '../utils/alertBus';

// Global auto-logout - agar KISI BHI authenticated API call se 401 (token
// invalid/expired) ya 403+banned aaye, session clear karke Login par bhej do.
//
// NOTE: yeh interceptor axios ke DEFAULT (global) instance par lagta hai -
// saare API files (`import axios from 'axios'`) isi ko use karti hain, isliye
// root _layout.tsx mein EK baar setupAuthInterceptor() kaafi hai.
//
// WEB -> RN DIFFERENCES:
// 1. `window.location.href = "/"` (hard reload) ki jagah `router.replace('/login')`.
//    Reload nahi hota, isliye JS state (in-memory token, my_id, WebSocket)
//    khud clear karni padti hai - neeche forceLogout() yehi karta hai.
// 2. Web mein ban message localStorage ("z_ban_message") ke through Login
//    page ko dete the kyunki reload se AlertPopupHost unmount ho jaata tha.
//    RN mein app mount rehti hai, isliye seedha showAlert() chalta hai -
//    "z_ban_message" wala flow ab zaroori nahi.
// 3. `loggingOut` flag ki jagah "stale token" check: sirf wahi failed request
//    logout trigger karti hai jo ABHI ke token ke saath gayi thi. forceLogout()
//    token turant (sync) null kar deta hai, isliye ek saath fail hui baaki
//    calls (5-6 endpoints ek saath 401) apne aap ignore ho jaati hain - aur
//    naya login karte hi guard khud fresh ho jaata hai (flag reset yaad
//    rakhne ki zaroorat nahi). Bina Authorization wali calls kabhi logout
//    trigger nahi karti.

let installed = false;

function forceLogout(banMessage: string | null) {
  // Sabse pehle token (sync) - isse baaki in-flight failures stale ho jaate hain.
  clearToken().catch(() => {});
  networkManager.disconnect();
  clearMyId().catch(() => {});
  clearUserScopedCaches().catch(() => {}); // owned skills/inventory waghera - agla login galat account ka data na dikhaye

  try {
    router.replace('/login');
  } catch (e) {
    console.error('authInterceptor: navigation to /login failed (router not ready?)', e);
  }

  if (banMessage) showAlert(banMessage);
}

export function setupAuthInterceptor(): void {
  if (installed) return;
  installed = true;

  axios.interceptors.response.use(
    (response: any) => response,
    (error: AxiosError<any>) => {
      const status = error.response?.status;
      const detail = error.response?.data?.detail;

      // 403 + detail.banned - backend ne account ban ki wajah se request block ki.
      const banned = status === 403 && !!detail?.banned;

      if (status === 401 || banned) {
        const sentAuth = String((error.config?.headers as any)?.Authorization ?? '');
        const currentToken = getToken();

        if (currentToken && sentAuth === `Bearer ${currentToken}`) {
          forceLogout(banned ? buildBanMessage(detail?.reason) : null);
        }
      }
      return Promise.reject(error);
    }
  );
}