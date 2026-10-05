import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * DM custom wallpaper - SIRF is phone ke AsyncStorage me save hota hai.
 * Backend pe kuch upload/save nahi hota, dusre user ko wallpaper dikhta nahi.
 *
 * Keys:
 *   dm_wallpaper_v1:<myId>:<partnerId>  -> har DM chat ka apna wallpaper
 *   inbox_wallpaper_v1:<myId>           -> Inbox (Messages list) screen ka wallpaper
 *   feed_wallpaper_v1:<myId>            -> Feed tab ka wallpaper
 *  myId har key me hai, isliye account badalne par purana wallpaper dusre
 *  account ko nahi dikhta.
 *
 * FLOW (WhatsApp jaisa):
 *   1. startPick()   -> gallery se image chuno, EXIF rotation bake + size cap
 *                       karke `pending` me rakho  -> crop screen khulti hai
 *   2. confirmCrop() -> user ne jo hissa chuna (CropRegion) usko crop karo,
 *                       1080px width pe resize+compress, AsyncStorage me save
 *   3. cancelCrop()  -> kuch save nahi hota
 *
 * Image data-URI (base64) ke roop me store hoti hai kyunki picker ka file://
 * uri cache dir me hota hai jo OS kabhi bhi saaf kar sakta hai. Android
 * AsyncStorage me ek row ~2MB se bada read nahi hota, isliye MAX_BYTES guard.
 */

const KEY_PREFIX = 'dm_wallpaper_v1';
const PICK_MAX_WIDTH = 1600; // crop screen ke liye working copy
const OUT_WIDTH = 1080; // final saved wallpaper ki width
const QUALITY = 0.55;
const MAX_BYTES = 1_200_000; // base64 string length cap

const dmKey = (myId: string | number, partnerId: string | number) =>
  `${KEY_PREFIX}:${myId}:${partnerId}`;
const inboxKey = (myId: string | number) => `inbox_wallpaper_v1:${myId}`;
const feedKey = (myId: string | number) => `feed_wallpaper_v1:${myId}`;

export interface PickedSource {
  uri: string;
  width: number;
  height: number;
}

export interface CropRegion {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export type SaveResult =
  | { ok: true; dataUri: string }
  | { ok: false; reason: 'too_large' | 'error' };

async function loadByKey(key: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function removeByKey(key: string) {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Gallery se image chuno. Cancel par null. */
async function pickSource(): Promise<PickedSource | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false, // crop hum khud karte hain (neeche CropModal)
    quality: 1,
  });
  if (picked.canceled || !picked.assets?.[0]?.uri) return null;
  const asset = picked.assets[0];

  // Normalize: EXIF rotation bake + bahut badi image chhoti. Result ki
  // width/height hi "asli" dimensions hain jinpe crop region calculate hota hai.
  const targetW = asset.width ? Math.min(PICK_MAX_WIDTH, asset.width) : PICK_MAX_WIDTH;
  const out = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: targetW } }], {
    compress: 0.9,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  return { uri: out.uri, width: out.width, height: out.height };
}

async function saveCropped(
  key: string,
  source: PickedSource,
  region: CropRegion
): Promise<SaveResult> {
  try {
    const out = await ImageManipulator.manipulateAsync(
      source.uri,
      [{ crop: region }, { resize: { width: OUT_WIDTH } }],
      { compress: QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (!out.base64) return { ok: false, reason: 'error' };
    if (out.base64.length > MAX_BYTES) return { ok: false, reason: 'too_large' };
    const dataUri = `data:image/jpeg;base64,${out.base64}`;
    await AsyncStorage.setItem(key, dataUri);
    return { ok: true, dataUri };
  } catch (e) {
    console.error('saveCropped wallpaper error:', e);
    return { ok: false, reason: 'error' };
  }
}

/**
 * Generic wallpaper hook - `storageKey` null ho to kuch nahi karta.
 * (DM chat aur Inbox dono isi se bane hain.)
 */
export function useWallpaper(storageKey: string | null) {
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [pending, setPending] = useState<PickedSource | null>(null); // crop screen ka source
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setWallpaper(null);
    setPending(null);
    loadByKey(storageKey).then((v) => {
      if (!cancelled) setWallpaper(v);
    });
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  /** Gallery kholo; image mili to `pending` set hota hai (crop modal khulta hai). */
  const startPick = useCallback(async (): Promise<'picked' | 'cancelled' | 'error'> => {
    try {
      const src = await pickSource();
      if (!src) return 'cancelled';
      setPending(src);
      return 'picked';
    } catch (e) {
      console.error('startPick wallpaper error:', e);
      return 'error';
    }
  }, []);

  const confirmCrop = useCallback(
    async (region: CropRegion): Promise<SaveResult> => {
      if (!pending || !storageKey) return { ok: false, reason: 'error' };
      setSaving(true);
      const res = await saveCropped(storageKey, pending, region);
      setSaving(false);
      if (res.ok) {
        setWallpaper(res.dataUri);
        setPending(null);
      }
      return res;
    },
    [pending, storageKey]
  );

  const cancelCrop = useCallback(() => setPending(null), []);

  const clear = useCallback(async () => {
    if (!storageKey) return;
    await removeByKey(storageKey);
    setWallpaper(null);
  }, [storageKey]);

  return { wallpaper, pending, saving, startPick, confirmCrop, cancelCrop, clear };
}

/** DM chat window ke liye (har partner ka alag wallpaper). */
export default function useDMWallpaper(
  myId: string | number | null | undefined,
  partnerId: string | number | null | undefined
) {
  return useWallpaper(myId != null && partnerId != null ? dmKey(myId, partnerId) : null);
}

/** Inbox (Messages list) screen ke liye - ek hi wallpaper. */
export function useInboxWallpaper(myId: string | number | null | undefined) {
  return useWallpaper(myId != null ? inboxKey(myId) : null);
}

/** Feed tab ke liye - ek hi wallpaper. */
export function useFeedWallpaper(myId: string | number | null | undefined) {
  return useWallpaper(myId != null ? feedKey(myId) : null);
}