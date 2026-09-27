import { MULTI_SELECT_CATEGORIES } from '../../features/avatar/utils/avatarAssets';

type PlayerProfile = Record<string, any>;

// Supabase ka nested relation kabhi object, kabhi array de sakta hai - dono handle karo
export const getProfile = (item: { players?: PlayerProfile | PlayerProfile[] } | null | undefined): PlayerProfile => {
  if (!item || !item.players) return { username: 'Unknown', rank: null };
  return Array.isArray(item.players) ? (item.players[0] || {}) : item.players;
};

// equipped_items (id array) ko AvatarLayers ke equippedByCategory format
// me convert karta hai. MULTI_SELECT_CATEGORIES ("back", "front") ke liye
// array milega (jaise { back: [3, 9], front: [7] }), baaki (single-select,
// jaise "background"/"frame") ke liye seedha ek id (jaise { background: 2 }).
// itemsById useItemsCatalog wala cached catalog hai (ek hi baar fetch hota
// hai, poore app ke liye).
export const getEquippedByCategory = (
  equippedItems: (string | number)[] | null | undefined,
  itemsById: Record<string | number, any>
): Record<string, (string | number)[] | string | number> => {
  const equippedByCategory: Record<string, (string | number)[] | string | number> = {};
  (equippedItems || []).forEach((id) => {
    const item = itemsById[id];
    if (!item?.item_category) return;
    const cat = item.item_category;
    if ((MULTI_SELECT_CATEGORIES as readonly string[]).includes(cat)) {
      if (!equippedByCategory[cat]) equippedByCategory[cat] = [];
      (equippedByCategory[cat] as (string | number)[]).push(id);
    } else {
      equippedByCategory[cat] = id;
    }
  });
  return equippedByCategory;
};

export const truncate = (text: string | null | undefined, len = 180): string => {
  if (!text) return '';
  return text.length > len ? text.slice(0, len) + '...' : text;
};

// Latest post sabse upar dikhane ke liye
export const sortByLatest = <T extends { created_at: string }>(list: T[]): T[] => {
  return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};