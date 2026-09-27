// Saari avatar SVGs `src/assets/<category>/<items_id>.svg` naming convention
// follow karti hain (jaise assets/back/3.svg, assets/front/7.svg).
//
// IMPORTANT (web -> RN difference): web mein Vite ka `import.meta.glob`
// poore folder ko build-time par khud scan kar leta tha. Metro (RN bundler)
// mein yeh NAHI chalta - Metro ko compile-time par exact file paths pata
// hone chahiye, isliye REGISTRY ab MANUAL hai (roomItemAssets.ts /
// communityAvatarAssets.ts jaisa hi). Naya avatar item add karna ho to:
//   1) SVG file `src/assets/<category>/<items_id>.svg` mein daalo
//   2) neeche REGISTRY ki us category mein ek `require(...)` line add karo
// Baaki koi code nahi badalta.
//
// Har value `require('...svg')` ka result hai. `react-native-svg-transformer`
// setup ke saath yeh ek React COMPONENT hota hai (default export) - use
// aise render karo:
//     const Layer = getAssetUrl('back', 3);
//     {Layer && <Layer width="100%" height="100%" />}
// (naam mein "Url" web se aaya hai - compat ke liye rakha; asal mein yeh
// component/asset hai, string URL nahi.)
//
// AB CHAAR category hain: "back" (avatar_url ki photo ke PICHHE render
// hota hai), "front" (photo ke AAGE), "background" (sabse peeche, back se
// bhi peeche) aur "frame" (sabse aage, front se bhi aage - jaise pfp ke
// around ek decorative frame/border).

export const CATEGORY_FOLDERS = ['back', 'front', 'background', 'frame'] as const;
export type AvatarCategory = (typeof CATEGORY_FOLDERS)[number];

// "back" aur "front" multi-select hain - inme ek saath MAX_MULTI_SELECT
// (5) tak items equip ho sakte hain. Baaki sab category ("background",
// "frame") single-select hain - ek waqt me sirf ek hi item.
export const MULTI_SELECT_CATEGORIES: AvatarCategory[] = ['back', 'front'];
export const MAX_MULTI_SELECT = 5;

// Single source of truth for human-readable category names - customize
// modal ke tabs, shop tabs, aur "equipped items" popup, sab yahi use
// karte hain, taaki naam kabhi mismatch na ho.
export const CATEGORY_LABELS: Record<AvatarCategory, string> = {
  back: 'Back',
  front: 'Front',
  background: 'Background',
  frame: 'Frame',
};

// TODO: apni actual SVG files ke hisaab se har category mein require() lines
// add karo. Jo zip tumne bheji thi usme sirf frame/9,10,11.svg mile the
// (back/background folders khaali the) - isliye sirf wahi real hain,
// baaki placeholders comment mein hain.
const REGISTRY: Record<AvatarCategory, Record<string, any>> = {
  back: {
    // '1': require('../../../assets/back/1.svg'),
  },
  front: {
    // '1': require('../../../assets/front/1.svg'),
  },
  background: {
    // '1': require('../../../assets/background/1.svg'),
  },
  frame: {
    '9': require('../../../assets/frame/9.svg'),
    '10': require('../../../assets/frame/10.svg'),
    '11': require('../../../assets/frame/11.svg'),
  },
};

/** Given a category + items_id, returns the require()'d SVG asset (ya null agar file nahi mili) */
export const getAssetUrl = (category: AvatarCategory | string, itemsId: number | string | null | undefined): any => {
  if (itemsId === null || itemsId === undefined) return null;
  return REGISTRY[category as AvatarCategory]?.[String(itemsId)] || null;
};

// Saari avatar SVGs (base + har layer) EXACT isi viewBox par bane hain
// (Inkscape se) - matlab avatar ko kahin bhi render karo, container ka box
// hamesha isi width:height ratio ka hona chahiye, warna har layer thoda
// alag scale hoti hai aur items base se misaligned dikhte hain.
// AvatarPlane.svg ka viewBox "0 0 350 250" hai (canonical canvas).
//
// RN: `aspectRatio` style ko NUMBER do (350 / 250 = 1.4) - JS mein
// `Number("350 / 250")` NaN deta hai, isliye neeche numeric version hi
// asli source of truth hai. String version sirf web-compat ke liye.
export const AVATAR_ASPECT_RATIO_NUM = 350 / 250;
export const AVATAR_ASPECT_RATIO = '350 / 250';

export default REGISTRY;