import React, { memo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import CommunityAvatar from './CommunityAvatar';
import useAvatarImage from '../../avatar/hooks/useAvatarImage';

interface CommunityCardProps {
  community: {
    id: number | string;
    name: string;
    icon_id?: number | string | null;
    icon_url?: string | null;
    owner_id?: number | string;
    owner_avatar_url?: string | null;
    owner_avatar_version?: number;
    owner_username?: string;
    member_count?: number;
    category?: string;
  };
  onPress: () => void;
}

// Amino-jaisa card: pura banner community ki image, top-left par owner
// ki pfp, naam neeche gradient par, footer me members + category strip.
const CommunityCard = ({ community, onPress }: CommunityCardProps) => {
  const ownerAvatarSrc = useAvatarImage(community.owner_id, community.owner_avatar_url, community.owner_avatar_version);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
      <View style={styles.banner}>
        <CommunityAvatar communityId={community.id} iconId={community.icon_id} iconUrl={community.icon_url} size="xl" />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.ownerBadge}>
            {ownerAvatarSrc ? (
              <Image source={{ uri: ownerAvatarSrc }} style={styles.ownerImg} />
            ) : (
              <Text style={styles.ownerInitial}>{(community.owner_username || '?').charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)']}
            style={styles.nameGradient}
          >
            <Text style={styles.nameText} numberOfLines={1}>
              {community.name}
            </Text>
          </LinearGradient>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.footerCell}>
          <View style={styles.membersRow}>
            <Ionicons name="people" size={11} color="#fff" />
            <Text style={styles.footerValue}>{community.member_count ?? 0}</Text>
          </View>
          <Text style={styles.footerLabel}>Members</Text>
        </View>
        <View style={[styles.footerCell, styles.footerDivider]}>
          <Text style={[styles.footerValue, styles.categoryText]} numberOfLines={1}>
            {community.category || 'General'}
          </Text>
          <Text style={styles.footerLabel}>Category</Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#2a2a2a' },
  pressed: { opacity: 0.85 },
  banner: { width: '100%', aspectRatio: 3 / 4, backgroundColor: '#161616' },
  ownerBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f2a65a',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerImg: { width: '100%', height: '100%' },
  ownerInitial: { color: '#fff', fontWeight: '700', fontSize: 12 },
  nameGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 8, paddingTop: 24, paddingBottom: 8 },
  nameText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  footer: { flexDirection: 'row', backgroundColor: '#161616' },
  footerCell: { flex: 1, paddingVertical: 6, alignItems: 'center', minWidth: 0 },
  footerDivider: { borderLeftWidth: 1, borderLeftColor: '#2a2a2a' },
  membersRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerValue: { fontSize: 11, fontWeight: '700', color: '#fff' },
  categoryText: { color: '#f2a65a', paddingHorizontal: 4 },
  footerLabel: { fontSize: 9, color: '#6b6b6b', marginTop: 1 },
});

export default memo(CommunityCard);