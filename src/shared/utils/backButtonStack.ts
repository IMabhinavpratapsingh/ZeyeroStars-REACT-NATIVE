// Jitni bhi full-screen modals/screens khuli hain (DM, Room chat, Post detail,
// Profile, Avatar customize, Search, Inbox, Rooms, Create post) sab apna
// "close" function yahan register kar dete hain jab wo khulti hain.
//
// RN CHANGE: web version Capacitor ke `App.addListener('backButton', ...)`
// ke saath use hota tha. RN mein iske liye core `BackHandler` API use hoga
// (Android-only - iOS mein hardware back button hota hi nahi, wahan yeh
// listener automatically no-op rahega).
//
// Root _layout.tsx mein ek baar setup karo:
//
//   import { BackHandler } from 'react-native';
//   import { handleHardwareBack } from '../shared/utils/backButtonStack';
//
//   useEffect(() => {
//     const sub = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
//     return () => sub.remove();
//   }, []);
//
// handleHardwareBack true return kare to RN maan leta hai "humne handle
// kar liya" (default exit-app behaviour cancel ho jaata hai). false return
// kare to RN apna default kaam karega (screen ke stack mein back jaana,
// ya app minimize/exit).

let stack: (() => void)[] = [];

export const pushBackHandler = (fn: () => void): void => {
  stack.push(fn);
};

export const popBackHandler = (fn: () => void): void => {
  stack = stack.filter((f) => f !== fn);
};

/** BackHandler 'hardwareBackPress' listener isko call karega. true return
 * matlab humne khud handle kar liya (kuch band kar diya), false matlab
 * kuch khula nahi tha - RN apna default back behaviour chalayega. */
export const handleHardwareBack = (): boolean => {
  if (stack.length > 0) {
    const top = stack[stack.length - 1];
    try {
      top();
    } catch (e) {
      console.error('Back handler error:', e);
    }
    return true;
  }
  return false;
};