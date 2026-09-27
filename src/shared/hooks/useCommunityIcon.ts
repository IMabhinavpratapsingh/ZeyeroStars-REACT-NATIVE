import { useMemo } from 'react';
import { presetIconAssetUrl } from '../utils/communityAvatarAssets';

/**
 * Kisi community ka icon dikhane ke liye resolver (UI palette NAHI hai -
 * woh feature hata di gayi, upload-only rakha hai, dekho
 * features/communities/components/CommunityIconPicker.tsx).
 *
 * Do cases:
 *   - iconId set hai (legacy preset, purani communities ke liye)
 *     -> local bundled asset, seedha resolve.
 *   - iconUrl set hai (custom upload) -> seedha wahi URL, RN ka <Image>
 *     already disk par cache kar leta hai (web jaisi manual
 *     localStorage-backed cache ki zaroorat nahi RN mein).
 */
export default function useCommunityIcon(
  _communityId: number | string | undefined,
  iconId: number | string | null | undefined,
  iconUrl: string | null | undefined
) {
  return useMemo(() => {
    if (iconId !== null && iconId !== undefined) return presetIconAssetUrl(iconId);
    return iconUrl || null;
  }, [iconId, iconUrl]);
}