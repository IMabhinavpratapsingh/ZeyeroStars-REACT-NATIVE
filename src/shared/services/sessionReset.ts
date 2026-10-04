import networkManager, { clearToken } from './NetworkManager';
import { clearMyId } from '../utils/auth';
import { clearUserScopedCaches } from './persistentCache';
import { clearWorldChatCache } from './worldChatCache';
import { clearAllCachedMessages } from '../../features/dm/services/dmMessagesCache';
import { clearPostViewTracker } from '../../features/feed/services/postViewTracker';

/**
 * Logout / forced-logout / ban - teeno ke liye EK hi jagah.
 *
 * Pehle SettingsMenu.handleLogout sirf token + caches clear karta tha, socket
 * ko haath nahi lagata tha - isliye purane account ka WebSocket khula rehta
 * tha. Dusra account login karne par TabsLayout "already connected" dekh kar
 * connect() skip kar deta tha, aur naya account purane account ke socket par
 * chalta tha (A ke events B ko dikhte, messages repeat, glitches).
 *
 * Order important hai: socket + token SYNC pehle (koi reconnect purane token
 * ke saath na ho), phir async storage/caches.
 */
export async function resetSession(): Promise<void> {
  networkManager.disconnect();
  const tokenCleared = clearToken().catch(() => {});
  clearAllCachedMessages();
  clearPostViewTracker();
  await Promise.all([
    tokenCleared,
    clearMyId().catch(() => {}),
    clearUserScopedCaches().catch(() => {}),
    clearWorldChatCache().catch(() => {}),
  ]);
}