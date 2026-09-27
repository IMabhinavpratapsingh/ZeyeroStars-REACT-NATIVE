// Room-placeable items (furniture, floors, walls, waghera) ki asset registry -
// avatarAssets.ts jaisa hi pattern, bas alag folder scan karta hai:
// `src/assets/room_items/<category>/<items_id>.svg` (jaise
// assets/room_items/chairs/3.svg, assets/room_items/tables/1.svg).
//
// IMPORTANT (web -> RN difference): Vite ka `import.meta.glob` (jo build
// time par khud hi poora folder scan kar leta tha) Metro (RN bundler)
// mein NAHI chalta - Metro ko compile-time par pata hona chahiye konsi
// exact files bundle karni hain, koi dynamic folder-scan support nahi
// hai. Isliye ab REGISTRY manually banani padegi - naya item add karo to
// bas neeche uski category ke andar ek `require(...)` line add kar do.
//
// NOTE: yeh avatarAssets.ts ki registry se ALAG/independent hai -
// avatar ke kapde (eyes/hairs/top/bottom/...) aur room ke items
// (floors/walls/tables/...) dono ek hi backend `items` table + item_category
// column se aate hain, lekin unki asset files do alag folders mein rehti hain
// (assets/<category>/ vs assets/room_items/<category>/), isliye do alag
// registries chahiye taaki dono kabhi mix-up na ho.
//
// ASSUMPTION: category names exactly yeh hain - floors, mats, walls,
// tables, chairs, blocks. Naya category add karo to ROOM_ITEM_CATEGORIES
// aur ROOM_ITEM_CATEGORY_LABELS dono mein bhi add karna (warna woh
// category kahin dikhegi hi nahi).

export const ROOM_ITEM_CATEGORIES = ['floors', 'mats', 'walls', 'tables', 'chairs', 'blocks'] as const;
export type RoomItemCategory = (typeof ROOM_ITEM_CATEGORIES)[number];

// Single source of truth for human-readable category names - room-items
// picker/tabs (RoomFloorView ka "Add item" panel) yahi use kar sakta hai.
export const ROOM_ITEM_CATEGORY_LABELS: Record<RoomItemCategory, string> = {
  floors: 'Floors',
  mats: 'Mats',
  walls: 'Walls',
  tables: 'Tables',
  chairs: 'Chairs',
  blocks: 'Blocks',
};

// Categories jinke upar se avatar CHAL sakta hai (walkable) - floor aur mat.
// Baaki sab (tables/chairs/blocks/...) obstacles hain, walls kabhi floor par
// walkable-area mein aate hi nahi (dekho WALL_ITEM_CATEGORY neeche).
export const WALKABLE_ROOM_ITEM_CATEGORIES: RoomItemCategory[] = ['floors', 'mats'];

// Yeh category sirf WALL par place ho sakti hai, room ke floor par nahi.
export const WALL_ITEM_CATEGORY: RoomItemCategory = 'walls';

// TODO: apni actual room-item SVGs ke hisaab se har category ke andar
// require() lines add karo. Placeholder pattern neeche diya hai -
// jitne bhi items_id hain us category ke, sabke liye ek line.
const REGISTRY: Record<RoomItemCategory, Record<string, any>> = {
  floors: {
    '1': require('../../assets/room_items/floors/1.svg'),
    // '2': require('../../assets/room_items/floors/2.svg'),
  },
  mats: {
    // '1': require('../../assets/room_items/mats/1.svg'),
  },
  walls: {
    '1': require('../../assets/room_items/walls/1.svg'),
    // '2': require('../../assets/room_items/walls/2.svg'),
  },
  tables: {
    '1': require('../../assets/room_items/tables/1.svg'),
    // '2': require('../../assets/room_items/tables/2.svg'),
  },
  chairs: {
    '1': require('../../assets/room_items/chairs/1.svg'),
    // '2': require('../../assets/room_items/chairs/2.svg'),
    // '3': require('../../assets/room_items/chairs/3.svg'),
  },
  blocks: {
    // '1': require('../../assets/room_items/blocks/1.svg'),
  },
};

/** Given a room-item category + items_id, returns the require()'d asset (ya null agar file nahi mili) */
export const getRoomItemAssetUrl = (category: RoomItemCategory | string, itemsId: number | string | null | undefined): any => {
  if (itemsId === null || itemsId === undefined) return null;
  return REGISTRY[category as RoomItemCategory]?.[String(itemsId)] || null;
};

export default REGISTRY;