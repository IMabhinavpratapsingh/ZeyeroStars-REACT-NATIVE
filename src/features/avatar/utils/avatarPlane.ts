// AvatarPlane.svg (350x250 viewBox) ka RN-friendly, PRE-PROCESSED version.
//
// WEB -> RN CHANGE:
// Web mein AvatarBase.jsx runtime par yeh sab karta tha:
//   1) `fetch(AvatarPlane)` se raw SVG text laata tha,
//   2) DOMParser se parse karke "photoarea" layer hata deta tha,
//   3) baaki shapes ko skin color se recolor karta tha,
//   4) hidden DOM node me attach karke `getBBox()` se photo-area ka
//      rect naapta tha,
//   5) btoa() se data-URI banata tha.
// RN mein na DOM hai, na getBBox(), na btoa - aur react-native-svg-
// transformer se `.svg` require karne par raw text milta hi nahi (component
// milta hai). Isliye yeh saara kaam AB BUILD-TIME par (yahan, haath se) ho
// chuka hai: neeche sirf "frame" layer ka path hai (photoarea layer already
// hata di gayi), aur photoarea ka bbox constants me likha hai.
//
// AGAR AvatarPlane.svg KA ART BADLO (real frame art aane par):
//   - "frame" layer ke shapes yahan AVATAR_PLANE_SHAPES me paste karo
//     (color `fill="{{COLOR}}"` se aata hai, style="fill:..." hata do).
//   - "photoarea" object ka X / Y / W / H Inkscape se dekho (viewBox ke
//     units me - document units mm hain aur viewBox 350x250 hai to numbers
//     seedha wahi hain) aur AVATAR_PHOTO_BOX me update karo.
//   - viewBox badla ho to AVATAR_VIEWBOX_W/H aur avatarAssets.ts ka
//     AVATAR_ASPECT_RATIO_NUM bhi update karo.

export const AVATAR_VIEWBOX_W = 350;
export const AVATAR_VIEWBOX_H = 250;

// "photoarea" layer ka bounding box (viewBox units). Abhi ek circle hai:
// center (175, 170.40602), radius 63.642857.
export const AVATAR_PHOTO_BOX = {
  x: 175 - 63.642857,
  y: 170.40602 - 63.642857,
  width: 63.642857 * 2,
  height: 63.642857 * 2,
} as const;

// Photo <Image> ko parent ke %-position/size par baithane ke liye
// (web ke photoRect.xFrac/yFrac/wFrac/hFrac jaisa hi).
export const AVATAR_PHOTO_RECT = {
  xFrac: AVATAR_PHOTO_BOX.x / AVATAR_VIEWBOX_W,
  yFrac: AVATAR_PHOTO_BOX.y / AVATAR_VIEWBOX_H,
  wFrac: AVATAR_PHOTO_BOX.width / AVATAR_VIEWBOX_W,
  hFrac: AVATAR_PHOTO_BOX.height / AVATAR_VIEWBOX_H,
} as const;

// "frame" layer - abhi placeholder ring (fill-opacity bahut kam, web jaisa
// hi). Web ke recolor step ne fill ko skin color kar diya tha aur
// fill-opacity style me waisi hi chhod di thi - yahan bhi wahi.
const AVATAR_PLANE_SHAPES = `
  <path
    fill="{{COLOR}}"
    fill-opacity="0.0447284"
    d="M 252.37237,170.40602 A 77.372368,77.372368 0 0 1 175,247.77839 77.372368,77.372368 0 0 1 97.627632,170.40602 77.372368,77.372368 0 0 1 175,93.033653 77.372368,77.372368 0 0 1 252.37237,170.40602 Z"
  />
`;

const xmlCache = new Map<string, string>();

/** Given skin color ke saath poora AvatarPlane SVG XML string (react-native-svg ke <SvgXml> ke liye) */
export const buildAvatarPlaneXml = (color: string): string => {
  const cached = xmlCache.get(color);
  if (cached) return cached;
  const xml =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${AVATAR_VIEWBOX_W} ${AVATAR_VIEWBOX_H}">` +
    AVATAR_PLANE_SHAPES.replace(/{{COLOR}}/g, color) +
    `</svg>`;
  xmlCache.set(color, xml);
  return xml;
};