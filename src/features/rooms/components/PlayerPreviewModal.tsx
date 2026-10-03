import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CurrencyIcon from '../../../shared/components/CurrencyIcon';
import AvatarLayers from '../../avatar/components/AvatarLayers';
import RankBadge from '../../../shared/components/RankBadge';
import VerifiedBadge from '../../../shared/components/VerifiedBadge';
import EliteBadge from '../../../shared/components/EliteBadge';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import { FadeIn, CardPop } from '../../../shared/components/motion/ScreenTransition';
import { FIELD } from '../../../shared/utils/profileFields';
import { getEquippedByCategory } from '../../../shared/utils/profileHelpers';
import { AVATAR_ASPECT_RATIO_NUM } from '../../avatar/utils/avatarAssets';
import useAvatarImage from '../../avatar/hooks/useAvatarImage';

// RoomFloorView.tsx abhi convert nahi hua (khaali hai) - jab wo bane, yeh
// constant wahan se export karke yahan import kar lena. Filhaal source
// (RoomFloorView.jsx) ke exact same values yahin duplicate kiye hain.
export const ROOM_REACTIONS = ['😭', '😂', '💀', '❤️', '🔥'];

/**
 * Room floor par kisi player ke card par LONG PRESS karne se khulne wala
 * chhota "quick preview" popup - avatar, name, rank, bio, reaction emoji,
 * Tip button. Poora profile (posts, block/report, etc.) nahi - uske liye
 * neeche "View Full Profile" button se ProfileViewModal khulta hai.
 */
interface Member {
  user_id: string | number;
  username: string;
  [key: string]: any;
}
interface PreviewData {
  member: Member;
  profile: Record<string, any>;
}
interface PlayerPreviewModalProps {
  preview: PreviewData | null;
  itemsById?: Record<string, any>;
  isSelf?: boolean;
  onClose: () => void;
  onViewFullProfile: (member: Member) => void;
  onTip?: (member: Member) => void;
  onReact?: (member: Member, emoji: string) => void;
}

const PlayerPreviewModal = ({
  preview,
  itemsById = {},
  isSelf = false,
  onClose,
  onViewFullProfile,
  onTip,
  onReact,
}: PlayerPreviewModalProps) => {
  const show = !!preview;
  const __z = useTopZIndex(show);
  useBackButtonHandler(show, onClose);

  const profile = preview?.profile || {};
  const avatarSrc = useAvatarImage(preview?.member?.user_id, profile[FIELD.avatar], profile[FIELD.avatarVersion]);

  if (!preview) return null;

  const { member } = preview;
  const equippedByCategory = getEquippedByCategory(profile[FIELD.equipped], itemsById);
  const rank = profile[FIELD.rank];
  const bio = profile[FIELD.bio];
  const isVerified = !!profile[FIELD.verified];
  const isElite = !!profile[FIELD.elite];

  // Reaction tap karte hi turant bhej ke popup BAND kar dete hain - isse
  // koi ek hi player ko baar-baar (spam) react nahi kar sakta.
  const handleReactTap = (emoji: string) => {
    if (!onReact) return;
    onReact(member, emoji);
    onClose();
  };

  return (
    <FadeIn show={show} style={[styles.backdrop, { zIndex: __z }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <CardPop style={styles.card}>
        <Pressable onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color="#a8a0c0" />
        </Pressable>

        <View style={[styles.avatarBox, { aspectRatio: AVATAR_ASPECT_RATIO_NUM }]}>
          <AvatarLayers equippedByCategory={equippedByCategory} photoUrl={avatarSrc} />
        </View>

        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{member.username}</Text>
          {isVerified && <VerifiedBadge size="sm" />}
          {isElite && <EliteBadge size="sm" />}
        </View>

        {rank != null && (
          <View style={styles.rankRow}>
            <RankBadge rank={rank} size="sm" />
          </View>
        )}

        <Text style={styles.bio}>{bio || 'No bio set yet.'}</Text>

        {!isSelf && (
          <>
            {onReact && (
              <View style={styles.reactionRow}>
                {ROOM_REACTIONS.map((emoji) => (
                  <Pressable key={emoji} onPress={() => handleReactTap(emoji)} style={styles.reactionBtn}>
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {onTip && (
              <Pressable onPress={() => onTip(member)} style={styles.tipBtn}>
                <CurrencyIcon type="zmoney" size={16} />
                <Text style={styles.tipBtnText}>Tip</Text>
              </Pressable>
            )}
          </>
        )}

        <Pressable onPress={() => onViewFullProfile(member)} style={styles.profileBtn}>
          <Text style={styles.profileBtnText}>View Full Profile</Text>
        </Pressable>
      </CardPop>
    </FadeIn>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 16,
  },
  card: {
    position: 'relative',
    backgroundColor: '#1c1730',
    borderWidth: 1,
    borderColor: '#2c2545',
    borderRadius: 16,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    paddingHorizontal: 20,
  },
  closeBtn: { position: 'absolute', top: 12, right: 12 },
  avatarBox: {
    width: 96,
    borderRadius: 16,
    backgroundColor: '#2c2545',
    borderWidth: 2,
    borderColor: '#3a3160',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  name: { fontWeight: '700', fontSize: 18, color: '#ffffff', maxWidth: 200 },
  rankRow: { marginTop: 4 },
  bio: { marginTop: 12, fontSize: 13, color: '#c0b8d8', textAlign: 'center' },
  reactionRow: { marginTop: 16, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  reactionBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(18,16,31,0.7)',
    borderWidth: 1, borderColor: '#3a3160',
    alignItems: 'center', justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 20 },
  tipBtn: {
    marginTop: 12, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#d4a017', borderRadius: 999, paddingVertical: 10,
  },
  tipBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  profileBtn: { marginTop: 12, width: '100%', backgroundColor: '#6d5bd0', borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  profileBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
});

export default memo(PlayerPreviewModal);