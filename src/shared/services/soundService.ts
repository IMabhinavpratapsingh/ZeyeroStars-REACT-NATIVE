import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Chhote UI sound effects. Player ek baar banta hai aur reuse hota hai
// (har baar naya load nahi hota, isliye delay nahi aata).
// expo-audio pehle se package.json mein hai -> naya native package nahi, rebuild nahi.

const SENT_VOLUME = 0.3; // 0.0 - 1.0, kam/zyada karna ho to yahan badal

// WAJAH (Spotify/music ruk jaata tha): Android par expo-audio ka audio mode
// jab tak set na ho `null` rehta hai, aur native code usse EXCLUSIVE audio
// focus (AUDIOFOCUS_GAIN_TRANSIENT) maanta hai - isliye bubble sound bajte
// hi doosre apps ka music pause ho jaata tha. 'mixWithOthers' par Android
// koi audio focus maangta hi nahi, sound music ke upar se bajta hai.
// playsInSilentMode: false -> phone silent/vibrate par bubble sound nahi bajega.
const SFX_MODE = {
  interruptionMode: 'mixWithOthers',
  playsInSilentMode: false,
  shouldPlayInBackground: false,
} as const;

// Sound khatam hone ke baad wahi purana mode (RoomRadioPlayer jaisa) wapas,
// taaki radio ka behaviour na badle. Audio mode app-wide hota hai.
const DEFAULT_MODE = {
  playsInSilentMode: true,
  shouldPlayInBackground: false,
} as const;

let sentPlayer: AudioPlayer | null = null;

export async function playMessageSent() {
  try {
    await setAudioModeAsync(SFX_MODE);
    if (!sentPlayer) {
      sentPlayer = createAudioPlayer(require('../../assets/sounds/message_send_bubble.mp3'));
      sentPlayer.volume = SENT_VOLUME;
      sentPlayer.addListener('playbackStatusUpdate', (status) => {
        if (status.didJustFinish) {
          setAudioModeAsync(DEFAULT_MODE).catch(() => {});
        }
      });
    }
    sentPlayer.seekTo(0);
    sentPlayer.play();
  } catch {
    // sound fail ho to chat flow kabhi nahi rukna chahiye
  }
}