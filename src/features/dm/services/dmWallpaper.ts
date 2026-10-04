import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

/**
 * DM custom wallpaper - SIRF is phone ke AsyncStorage me save hota hai.
 * Backend pe kuch upload/save nahi hota, dusre user ko wallpaper dikhta nahi.
 *
 * Key: dm_wallpaper_v1:<myId>:<partnerId>
 *  -> har chat ka apna wallpaper, aur account badalne par purana wallpaper
 *     dusre account ko nahi dikhta (myId key me hai).
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

const keyFor = (myId: string | number, partnerId: string | number) =>
  `${KEY_PREFIX}:${myId}:${partnerId}`;

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

export async function loadWallpaper(
  myId: string | number | null | undefined,
  partnerId: string | number | null | undefined
): Promise<string | null> {
  if (myId == null || partnerId == null) return null;
  try {
    return await AsyncStorage.getItem(keyFor(myId, partnerId));
  } catch {
    return null;
  }
}

export async function removeWallpaper(myId: string | number, partnerId: string | number) {
  try {
    await AsyncStorage.removeItem(keyFor(myId, partnerId));
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
  myId: string | number,
  partnerId: string | number,
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
    await AsyncStorage.setItem(keyFor(myId, partnerId), dataUri);
    return { ok: true, dataUri };
  } catch (e) {
    console.error('saveCropped wallpaper error:', e);
    return { ok: false, reason: 'error' };
  }
}

/** Chat window ke liye: current wallpaper + pick/crop/remove helpers. */
export default function useDMWallpaper(
  myId: string | number | null | undefined,
  partnerId: string | number | null | undefined
) {
  const [wallpaper, setWallpaper] = useState<string | null>(null);
  const [pending, setPending] = useState<PickedSource | null>(null); // crop screen ka source
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setWallpaper(null);
    setPending(null);
    loadWallpaper(myId, partnerId).then((v) => {
      if (!cancelled) setWallpaper(v);
    });
    return () => {
      cancelled = true;
    };
  }, [myId, partnerId]);

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
      if (!pending || myId == null || partnerId == null) return { ok: false, reason: 'error' };
      setSaving(true);
      const res = await saveCropped(myId, partnerId, pending, region);
      setSaving(false);
      if (res.ok) {
        setWallpaper(res.dataUri);
        setPending(null);
      }
      return res;
    },
    [pending, myId, partnerId]
  );

  const cancelCrop = useCallback(() => setPending(null), []);

  const clear = useCallback(async () => {
    if (myId == null || partnerId == null) return;
    await removeWallpaper(myId, partnerId);
    setWallpaper(null);
  }, [myId, partnerId]);

  return { wallpaper, pending, saving, startPick, confirmCrop, cancelCrop, clear };
}