import { useRef } from 'react';
import { getNextZIndex } from '../utils/zIndexManager';

/**
 * `active` (true/open) hote hi is modal/overlay ko ek naya, sabse-bada
 * zIndex mil jaata hai - taaki jo sabse aakhri baar khula ho wahi
 * hamesha sabse upar dikhe, bina kisi manual/hardcoded ordering ke.
 *
 * Jab tak modal open rehta hai, wahi zIndex stable rehta hai (dobara
 * re-render hone par badalta nahi) - sirf close->open transition par
 * naya number milta hai.
 *
 * IMPORTANT: boolean (`show`) modals ke liye "close->open transition"
 * matlab false->true hai. Lekin Profile jaise modals `active` ke roop
 * mein ek OBJECT lete hain (jaise `viewingProfile`), aur open-hi-open
 * rehte hue bhi dubara khole ja sakte hain - is case mein `active` kabhi
 * false nahi hota, sirf ek NAYA object reference milta hai. Isliye hum
 * sirf `!wasActive` nahi, balki "value hi badal gayi" (reference change)
 * bhi check karte hain.
 *
 * RN NOTE: iska return value style ke `zIndex` mein jaata hai, aur woh
 * tabhi asar karta hai jab view `position: 'absolute'` ho. Android par
 * kabhi kabhi saath mein `elevation` bhi lagana padta hai (dekho
 * zIndexManager.ts ka comment). NOTE: agar modal RN ke <Modal> component
 * se render ho raha hai to woh apni alag native window mein aata hai -
 * uske liye zIndex ki zaroorat hi nahi; yeh hook sirf in-tree overlays
 * (absolute-positioned Views) ke liye hai.
 */
export default function useTopZIndex(active: unknown): number {
  const zRef = useRef<number | null>(null);
  const prevActive = useRef<unknown>(undefined);

  if (active && active !== prevActive.current) {
    zRef.current = getNextZIndex();
  }
  prevActive.current = active;

  if (zRef.current === null) {
    zRef.current = getNextZIndex();
  }

  return zRef.current;
}