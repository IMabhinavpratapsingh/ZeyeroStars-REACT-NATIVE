import React, { memo, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../../shared/utils/alertBus';
import { confirmAction } from '../../../shared/utils/confirmBus';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { SlideInRight } from '../../../shared/components/motion/ScreenTransition';
import VerifiedBadge from '../../../shared/components/VerifiedBadge';
import EliteBadge from '../../../shared/components/EliteBadge';
import { listCommunityMembers, promoteToMod, demoteMod, banCommunityMember } from '../services/communitiesApi';

const ROLE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  owner: 'ribbon',
  mod: 'shield-checkmark',
};
const PAGE_SIZE = 30;

type Member = {
  user_id: number | string;
  role: 'owner' | 'mod' | 'member';
  players?: { username?: string; is_verified?: boolean; is_elite?: boolean };
};

interface CommunityMembersModalProps {
  show: boolean;
  onClose: () => void;
  communityId: number | string;
  myRole: 'owner' | 'mod' | 'member' | null;
  onMemberChanged?: () => void;
}

const CommunityMembersModal = ({ show, onClose, communityId, myRole, onMemberChanged }: CommunityMembersModalProps) => {
  const zIndex = useTopZIndex(show);
  useBackButtonHandler(show, onClose);

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [openMenuFor, setOpenMenuFor] = useState<number | string | null>(null);
  const [busyFor, setBusyFor] = useState<number | string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listCommunityMembers(communityId, 0, PAGE_SIZE);
      setMembers(res.data.members || []);
      setOffset((res.data.members || []).length);
      setHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Members load error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (show && communityId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, communityId]);

  const loadMore = async () => {
    if (!hasMore || loading) return;
    try {
      const res = await listCommunityMembers(communityId, offset, PAGE_SIZE);
      const newList = res.data.members || [];
      setMembers((prev) => [...prev, ...newList]);
      setOffset((prev) => prev + newList.length);
      setHasMore(!!res.data.has_more);
    } catch (err: any) {
      console.error('Members load more error:', err.response?.data || err.message);
    }
  };

  const runAction = async (targetUserId: number | string, action: 'promote' | 'demote' | 'ban') => {
    if (action === 'ban') {
      const ok = await confirmAction({
        title: 'Remove this member?',
        message: "They'll be removed from the community and won't be able to rejoin unless invited again.",
        confirmLabel: 'Remove',
      });
      if (!ok) {
        setOpenMenuFor(null);
        return;
      }
    }
    setBusyFor(targetUserId);
    setOpenMenuFor(null);
    try {
      if (action === 'promote') await promoteToMod(communityId, targetUserId);
      if (action === 'demote') await demoteMod(communityId, targetUserId);
      if (action === 'ban') await banCommunityMember(communityId, targetUserId);

      if (action === 'ban') {
        setMembers((prev) => prev.filter((m) => m.user_id !== targetUserId));
      } else {
        setMembers((prev) =>
          prev.map((m) => (m.user_id === targetUserId ? { ...m, role: action === 'promote' ? 'mod' : 'member' } : m))
        );
      }
      onMemberChanged && onMemberChanged();
    } catch (err: any) {
      console.error(`${action} member error:`, err.response?.data || err.message);
      showAlert(err.response?.data?.detail || `Couldn't ${action} that member.`);
    } finally {
      setBusyFor(null);
    }
  };

  const canManage = myRole === 'owner' || myRole === 'mod';

  return (
    <SlideInRight show={show} style={[styles.overlay, { zIndex, elevation: zIndex }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={10}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Members</Text>
      </View>

      {loading ? (
        <View style={styles.listContent}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.skeletonRow} />
          ))}
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(m) => String(m.user_id)}
          contentContainerStyle={styles.listContent}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          renderItem={({ item: m }) => {
            const roleIcon = ROLE_ICON[m.role];
            const player = m.players || {};
            const canPromote = myRole === 'owner' && m.role === 'member';
            const canDemote = myRole === 'owner' && m.role === 'mod';
            const canBan = canManage && m.role !== 'owner' && !(m.role === 'mod' && myRole !== 'owner');
            const showMenuBtn = canManage && m.role !== 'owner' && (canPromote || canDemote || canBan);

            return (
              <View style={styles.row}>
                <View style={styles.rowInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.nameText} numberOfLines={1}>
                      {player.username || 'Unknown'}
                    </Text>
                    {player.is_verified && <VerifiedBadge size="sm" />}
                    {player.is_elite && <EliteBadge size="sm" />}
                    {roleIcon && <Ionicons name={roleIcon} size={13} color="#d4a94e" />}
                  </View>
                  <Text style={styles.roleText}>{m.role}</Text>
                </View>

                {showMenuBtn && (
                  <View>
                    <Pressable
                      onPress={() => setOpenMenuFor(openMenuFor === m.user_id ? null : m.user_id)}
                      disabled={busyFor === m.user_id}
                      hitSlop={8}
                      style={styles.menuBtn}
                    >
                      <Ionicons name="ellipsis-vertical" size={16} color="#9a9a9a" />
                    </Pressable>
                    {openMenuFor === m.user_id && (
                      <View style={styles.menu}>
                        {canPromote && (
                          <Pressable style={styles.menuItem} onPress={() => runAction(m.user_id, 'promote')}>
                            <Text style={styles.menuItemText}>Make mod</Text>
                          </Pressable>
                        )}
                        {canDemote && (
                          <Pressable style={styles.menuItem} onPress={() => runAction(m.user_id, 'demote')}>
                            <Text style={styles.menuItemText}>Remove mod</Text>
                          </Pressable>
                        )}
                        {canBan && (
                          <Pressable style={styles.menuItem} onPress={() => runAction(m.user_id, 'ban')}>
                            <Text style={styles.menuItemDanger}>Remove member</Text>
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SlideInRight>
  );
};

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  headerTitle: { fontWeight: '700', fontSize: 17, color: '#fff' },
  listContent: { padding: 16, gap: 8 },
  skeletonRow: { backgroundColor: '#161616', borderRadius: 12, height: 56, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#161616',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 8,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nameText: { fontWeight: '700', fontSize: 13, color: '#fff', flexShrink: 1 },
  roleText: { color: '#6b6b6b', fontSize: 11, textTransform: 'capitalize' },
  menuBtn: { padding: 4 },
  menu: {
    position: 'absolute',
    right: 0,
    top: 32,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#3a3a3a',
    borderRadius: 10,
    overflow: 'hidden',
    minWidth: 140,
    zIndex: 10,
  },
  menuItem: { paddingHorizontal: 12, paddingVertical: 10 },
  menuItemText: { color: '#fff', fontSize: 13 },
  menuItemDanger: { color: '#f87171', fontSize: 13 },
});

export default memo(CommunityMembersModal);