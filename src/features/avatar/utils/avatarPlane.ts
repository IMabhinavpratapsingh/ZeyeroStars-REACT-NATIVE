// AvatarPlane.svg (400x400 viewBox) ka RN-friendly, PRE-PROCESSED version.
//
// RN mein runtime par raw SVG text parse nahi hota, isliye AvatarPlane.svg ke
// shapes yahan haath se paste kiye gaye hain. SVG badalni ho to:
//   1) AVATAR_VIEWBOX_W/H update karo (+ avatarAssets.ts ka AVATAR_ASPECT_RATIO_NUM)
//   2) AVATAR_PHOTO_CIRCLE (photo wala circle: cx, cy, r) update karo
//   3) AVATAR_BACKDROP_PATH / AVATAR_SILHOUETTE_SHAPES me naye paths paste karo

export const AVATAR_VIEWBOX_W = 400;
export const AVATAR_VIEWBOX_H = 400;

// Photo circle: center (200, 200), radius 93 (SVG ke circle163 se).
export const AVATAR_PHOTO_CIRCLE = { cx: 200, cy: 200, r: 93 } as const;

export const AVATAR_PHOTO_BOX = {
  x: AVATAR_PHOTO_CIRCLE.cx - AVATAR_PHOTO_CIRCLE.r,
  y: AVATAR_PHOTO_CIRCLE.cy - AVATAR_PHOTO_CIRCLE.r,
  width: AVATAR_PHOTO_CIRCLE.r * 2,
  height: AVATAR_PHOTO_CIRCLE.r * 2,
} as const;

// Photo <Image> ko parent ke %-position/size par baithane ke liye.
export const AVATAR_PHOTO_RECT = {
  xFrac: AVATAR_PHOTO_BOX.x / AVATAR_VIEWBOX_W,
  yFrac: AVATAR_PHOTO_BOX.y / AVATAR_VIEWBOX_H,
  wFrac: AVATAR_PHOTO_BOX.width / AVATAR_VIEWBOX_W,
  hFrac: AVATAR_PHOTO_BOX.height / AVATAR_VIEWBOX_H,
} as const;

const AVATAR_BACKDROP_PATH =
  'm 293,200 a 93,93 0 0 1 -93,93 93,93 0 0 1 -93,-93 93,93 0 0 1 93,-93 93,93 0 0 1 93,93 z';

// Head + shoulders silhouette (photo na ho tab dikhta hai), circle se clipped.
const AVATAR_SILHOUETTE_SHAPES = `
  <path fill="#e0e0e0" d="M 237.2,182 A 37.200001,37.200001 0 0 1 200,219.2 37.200001,37.200001 0 0 1 162.8,182 37.200001,37.200001 0 0 1 200,144.8 37.200001,37.200001 0 0 1 237.2,182 Z" />
  <path fill="#e0e0e0" d="m 266.96,288.35001 a 66.959999,57.66 0 0 1 -66.96,57.66 66.959999,57.66 0 0 1 -66.96,-57.66 66.959999,57.66 0 0 1 66.96,-57.66 66.959999,57.66 0 0 1 66.96,57.66 z" />
`;

const xmlCache = new Map<string, string>();

/** AvatarPlane ka SVG XML string. withSilhouette=false => sirf backdrop circle (photo upar aayegi). */
export const buildAvatarPlaneXml = (withSilhouette: boolean): string => {
  const key = withSilhouette ? 's' : 'n';
  const cached = xmlCache.get(key);
  if (cached) return cached;
  const xml =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${AVATAR_VIEWBOX_W} ${AVATAR_VIEWBOX_H}">` +
    `<defs><clipPath id="av3"><path d="${AVATAR_BACKDROP_PATH}" /></clipPath></defs>` +
    `<path d="${AVATAR_BACKDROP_PATH}" fill="#000000" />` +
    (withSilhouette ? `<g clip-path="url(#av3)">${AVATAR_SILHOUETTE_SHAPES}</g>` : '') +
    `</svg>`;
  xmlCache.set(key, xml);
  return xml;
};