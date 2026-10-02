import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

// Chhote UI sound effects. Player ek baar banta hai aur reuse hota hai
// (har baar naya load nahi hota, isliye delay nahi aata).
// expo-audio pehle se package.json mein hai -> naya native package nahi, rebuild nahi.

const SENT_VOLUME = 0.3; // 0.0 - 1.0, kam/zyada karna ho to yahan badal

let sentPlayer: AudioPlayer | null = null;

export function playMessageSent() {
  try {
    if (!sentPlayer) {
      sentPlayer = createAudioPlayer(require('../../assets/sounds/message_send_bubble.mp3'));
      sentPlayer.volume = SENT_VOLUME;
    }
    sentPlayer.seekTo(0);
    sentPlayer.play();
  } catch {
    // sound fail ho to chat flow kabhi nahi rukna chahiye
  }
}