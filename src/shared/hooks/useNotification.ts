import { useState, useRef, useEffect, useCallback } from 'react';

export interface InAppNotification {
  user?: { id?: string | number; [key: string]: any } | null;
  content?: any;
  [key: string]: any;
}

// In-app toast (NotificationToast) ke liye - kuch second dikhta hai, phir
// khud gayab. Web version se logic bilkul same, bas typed.
export default function useNotification(duration = 4000) {
  const [notif, setNotif] = useState<InAppNotification | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const showNotification = useCallback(
    (user: InAppNotification['user'], content: any, extra: Record<string, any> = {}) => {
      setNotif({ user, content, ...extra });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setNotif(null), duration);
    },
    [duration]
  );

  const clearForUser = useCallback((id: string | number) => {
    setNotif((prev) => (prev && prev.user?.id === id ? null : prev));
  }, []);

  return { notif, showNotification, clearForUser };
}