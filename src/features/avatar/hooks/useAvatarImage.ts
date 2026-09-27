import { useMemo } from 'react';
import { resolveAvatarUrl } from '../services/avatarCache';

/**
 * Dusre kisi bhi user ka avatar dikhane ke liye - `avatarVersion`-aware,
 * memory + AsyncStorage-backed URL cache ke through (dekh lo
 * services/avatarCache.ts ka comment - koi network call yahan nahi hoti).
 *
 * Return: expo-image / <Image source={{ uri }}> me seedha use hone layak
 * URL (ya null).
 *
 * NOTE: apna khud ka avatar dikhane/edit karne waali jagah
 * (AvatarCustomizeModal preview, ShopModal preview) isko use NAHI karti -
 * wahan seedha live photoUrl chahiye, cache ke through nahi.
 */
export default function useAvatarImage(
  userId: string | number | null | undefined,
  avatarUrl: string | null | undefined,
  avatarVersion: number | string | null | undefined
): string | null {
  return useMemo(
    () => resolveAvatarUrl(userId, avatarVersion, avatarUrl),
    [userId, avatarUrl, avatarVersion]
  );
}