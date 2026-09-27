import { useRef, useCallback } from 'react';

// id -> username ka chhota in-memory map (re-render trigger nahi karta).
export default function useUserCache() {
  const userMapRef = useRef<Record<string, string>>({});

  const cacheUser = useCallback((user: { id?: string | number; target_id?: string | number; username?: string } | null | undefined) => {
    if (!user) return;
    const id = user.id || user.target_id;
    if (!id || !user.username) return; // khaali/placeholder naam se real cache overwrite mat karo
    userMapRef.current[String(id)] = user.username;
  }, []);

  const getUsername = useCallback((id: string | number): string | undefined => userMapRef.current[String(id)], []);

  return { cacheUser, getUsername };
}