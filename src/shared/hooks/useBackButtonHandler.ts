import { useEffect } from 'react';
import { pushBackHandler, popBackHandler } from '../utils/backButtonStack';

/**
 * isOpen: yeh screen/modal abhi khuli hai kya
 * onClose: khuli hone par ise close karne wala function (wahi jo
 *          on-screen "<- Back/Close" button call karta hai)
 *
 * Jab tak isOpen true hai, phone ka hardware back button isi onClose
 * ko call karega (app exit hone ki jagah). Root _layout.tsx mein
 * BackHandler ka ek baar setup zaroori hai (dekho backButtonStack.ts).
 *
 * TIP: onClose ko useCallback/useStableCallback se stable rakho, warna
 * har render par stack mein push/pop hota rahega (order bigad sakta hai).
 */
export default function useBackButtonHandler(isOpen: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) return;
    pushBackHandler(onClose);
    return () => popBackHandler(onClose);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose]);
}