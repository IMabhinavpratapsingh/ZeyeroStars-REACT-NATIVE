// DM photos PRIVATE bucket mein hain: server har baar naya signed URL deta hai
// (query string mein signature/expiry badalta rehta hai). Isliye photo ko
// pehchanne / compare / cache karne ke liye URL nahi, uski stable STORAGE KEY
// ("dm-photos/<sender>/<hex>.webp") use karo.
const DM_PHOTO_MARK = 'dm-photos/';

/** Signed URL (ya key) -> stable key. Local file:// URI ya khali value jaisi ki taisi. */
export const photoKeyOf = (u: any): string => {
  const s = typeof u === 'string' ? u : '';
  const i = s.indexOf(DM_PHOTO_MARK);
  return i === -1 ? s : s.slice(i).split('?')[0];
};

/** expo-image cacheKey: sirf remote DM photo ke liye (signed URL badalne par bhi cache hit). */
export const photoCacheKey = (u: any): string | undefined => {
  const s = typeof u === 'string' ? u : '';
  return /^https?:\/\//i.test(s) && s.includes(DM_PHOTO_MARK) ? photoKeyOf(s) : undefined;
};