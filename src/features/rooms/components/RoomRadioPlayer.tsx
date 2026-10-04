import { memo, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import networkManager from '../../../shared/services/NetworkManager';
import { useRadioMuted } from '../services/radioMute';

// Room ka radio Dashboard ke root mein hamesha mounted rehta hai - room
// ki chat screen minimize ho to bhi yeh component unmount nahi hota,
// isliye radio bajta rehta hai. Band hota hai jab:
//   1. activeRoom null ho jaaye (radioUrl prop null aa jaata hai), YA
//   2. app background mein chali jaaye (room_leave bhi tabhi bhejte hain,
//      isliye server par hum room mein hain hi nahi - radio bhi nahi bajna chahiye), YA
//   3. websocket disconnect ho jaaye (room se connection toot gaya).
// Foreground + socket wapas open hote hi stream fresh load hoke phir chalti hai.
//
// WEB -> RN CHANGE: web ka <audio><source src /></audio> element ki
// jagah `expo-audio` ka useAudioPlayer hook - ek hi player instance pure
// component lifecycle mein reuse hota hai, URL badalne par sirf
// replace() call karte hain.
interface RoomRadioPlayerProps {
  radioUrl: string | null;
}

// iOS par 'inactive' (control center / notification shade) ek chhota
// transient state hai - sirf asli 'background' par radio rokte hain.
const computeCanPlay = () =>
  AppState.currentState !== 'background' && networkManager.isConnected();

const RoomRadioPlayer = ({ radioUrl }: RoomRadioPlayerProps) => {
  const player = useAudioPlayer(null);
  const loadedUrlRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const [canPlay, setCanPlay] = useState<boolean>(computeCanPlay);
  const radioMuted = useRadioMuted();

  // Mute: stream chalti rehti hai (unmute par turant awaaz), bas volume band.
  useEffect(() => {
    try {
      player.muted = radioMuted;
    } catch {}
  }, [radioMuted, player, radioUrl]);

  useEffect(() => {
    // Background mein radio nahi bajna chahiye (user ki requirement) -
    // shouldPlayInBackground false, upar se AppState par explicit pause bhi hai.
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false }).catch(() => {});
  }, []);

  // App foreground/background + socket open/close ko track karo.
  useEffect(() => {
    const sync = () => setCanPlay(computeCanPlay());
    const appSub = AppState.addEventListener('change', sync);
    const unsubState = networkManager.addStateListener(sync);
    sync();
    return () => {
      appSub.remove();
      unsubState();
    };
  }, []);

  useEffect(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Room nahi / background / disconnected - stream poori tarah rok do
    // (sirf pause nahi - source bhi hata do taaki network buffer bhi band ho).
    if (!radioUrl || !canPlay) {
      loadedUrlRef.current = null;
      retryCountRef.current = 0;
      try {
        player.pause();
      } catch {}
      try {
        player.replace(null);
      } catch {}
      return;
    }

    if (loadedUrlRef.current === radioUrl) return; // already loaded/playing yehi stream
    loadedUrlRef.current = radioUrl;
    retryCountRef.current = 0;

    const loadAndPlay = (url: string) => {
      try {
        player.replace({ uri: url });
        player.play();
      } catch {
        scheduleRetry(url);
      }
    };

    const scheduleRetry = (url: string) => {
      if (retryTimeoutRef.current) return; // ek retry already pending hai
      if (retryCountRef.current >= 3) return; // 3 attempts ke baad give up
      const attempt = retryCountRef.current + 1;
      retryCountRef.current = attempt;
      const delayMs = 2000 * 2 ** (attempt - 1); // 2s, 4s, 8s
      retryTimeoutRef.current = setTimeout(() => {
        retryTimeoutRef.current = null;
        if (loadedUrlRef.current !== url) return; // beech mein station/room switch ya stop ho gaya
        loadAndPlay(url);
      }, delayMs);
    };

    loadAndPlay(radioUrl);

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [radioUrl, canPlay, player]);

  return null; // audio hi hai, koi visible UI nahi
};

export default memo(RoomRadioPlayer);