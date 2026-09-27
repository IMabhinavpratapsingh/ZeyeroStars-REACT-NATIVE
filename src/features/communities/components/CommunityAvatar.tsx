import React, { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useCommunityIcon from '../../../shared/hooks/useCommunityIcon';

const SIZE_PX = { xs: 20, sm: 36, md: 48, lg: 72, xl: 96 } as const;
type AvatarSize = keyof typeof SIZE_PX;

interface CommunityAvatarProps {
  communityId?: number | string;
  iconId?: number | string | null;
  iconUrl?: string | null;
  size?: AvatarSize;
}

const CommunityAvatar = ({ communityId, iconId, iconUrl, size = 'md' }: CommunityAvatarProps) => {
  const px = SIZE_PX[size] || SIZE_PX.md;
  const src = useCommunityIcon(communityId, iconId, iconUrl);

  return (
    <View style={[styles.wrap, { width: px, height: px, borderRadius: px * 0.22 }]}>
      {src ? (
        <Image source={typeof src === 'string' ? { uri: src } : src} style={styles.img} />
      ) : (
        <Ionicons name="people" size={px * 0.5} color="#6b6b6b" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: { width: '100%', height: '100%' },
});

export default memo(CommunityAvatar);