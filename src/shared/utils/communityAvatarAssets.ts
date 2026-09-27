// Preset community icons - items_id jaisa hi integer-id pattern
// (avatarAssets.ts / roomItemAssets.ts waala convention). Backend
// (community_service.py) ab community row par sirf ek chhota integer
// `icon_id` (1..COMMUNITY_AVATAR_PRESET_COUNT) store karta hai - koi
// path/string nahi. Yeh file sirf us id ko actual bundled asset resolve
// karti hai.
//
// IMPORTANT (web -> RN difference): Vite ka `import.meta.glob` (jo
// folder ko runtime pe automatically scan karta tha) Metro (RN bundler)
// mein NAHI chalta - Metro ko compile-time par pata hona chahiye konsi
// files bundle karni hain. Isliye ab har asset ko yahan MANUALLY
// `require(...)` karna padega. Naya preset icon add karo to bas neeche
// REGISTRY mein ek line add karo - baaki sab code same rahega.
//
// Files: src/assets/community_avatar/1.svg .. N.svg honi chahiye
// (react-native-svg ke transformer ke saath, ya .png bhi chalega agar
// SVG setup nahi kiya).
//
// COMMUNITY_AVATAR_PRESET_COUNT must match the backend constant of the
// same name in services/community_service.py - if you add/remove presets,
// bump both AND add/remove the matching require() line below.
export const COMMUNITY_AVATAR_PRESET_COUNT = 20;

// TODO: har ek preset icon ke liye require() line add karo (1 se
// COMMUNITY_AVATAR_PRESET_COUNT tak). Placeholder abhi 3 diye hain -
// baaki apni actual files ke hisaab se add kar lena.
const REGISTRY: Record<string, any> = {
  '1': require('../../assets/community_avatar/1.svg'),
  '2': require('../../assets/community_avatar/2.svg'),
  '3': require('../../assets/community_avatar/3.svg'),
  // '4': require('../../assets/community_avatar/4.svg'),
  // ... yahan tak COMMUNITY_AVATAR_PRESET_COUNT (20) tak add karo
};

export const PRESET_ICON_IDS = Array.from({ length: COMMUNITY_AVATAR_PRESET_COUNT }, (_, i) => i + 1);

// numeric icon_id -> require()'d asset (or null if that id isn't in REGISTRY yet)
export const presetIconAssetUrl = (iconId: number | string | null | undefined): any => {
  if (iconId === null || iconId === undefined) return null;
  return REGISTRY[String(iconId)] || null;
};

// A community row now carries EITHER icon_id (preset, resolved locally
// via presetIconAssetUrl above) OR icon_url (custom, verified/elite
// upload - already a full storage URL) - never both. Actual rendering
// goes through hooks/useCommunityIcon.ts (which also handles the
// caching for the custom-url case) - components should use
// that hook / <CommunityAvatar>, not call this file directly.