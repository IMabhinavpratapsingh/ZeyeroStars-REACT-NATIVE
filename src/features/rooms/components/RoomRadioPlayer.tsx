import { memo, useEffect, useRef } from 'react';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

// Room ka radio Dashboard ke root mein hamesha mounted rehta hai - room
// ki chat screen minimize ho to bhi yeh component unmount nahi hota,
// isliye radio bajta rehta hai. Sirf tab band hota hai jab activeRoom
// hi null ho jaaye (radioUrl prop null aa jaata hai).
//
// WEB -> RN CHANGE: web ka <audio><source src /></audio> element ki
// jagah `expo-audio` ka useAudioPlayer hook - ek hi player instance pure
// component lifecycle mein reuse hota hai, URL badalne par sirf
// replace() call karte hain (naya element mount/unmount nahi karna
// padta, jo purane web wale double-load guard jaisa hi kaam karta hai).
interface RoomRadioPlayerProps {
  radioUrl: string | null;
}

const RoomRadioPlayer = ({ radioUrl }: RoomRadioPlayerProps) => {
  const player = useAudioPlayer(null);
  const loadedUrlRef = useRef<string | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    // iOS silent switch / background me bhi radio bajna chahiye.
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!radioUrl) {
      loadedUrlRef.current = null;
      try {
        player.pause();
      } catch {}
      return;
    }
    if (loadedUrlRef.current === radioUrl) return; // already loaded/playing yehi stream
    loadedUrlRef.current = radioUrl;
    retryCountRef.current = 0;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

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
        if (loadedUrlRef.current !== url) return; // beech mein station/room switch ho gaya
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
  }, [radioUrl]);

  return null; // audio hi hai, koi visible UI nahi
};

export default memo(RoomRadioPlayer);