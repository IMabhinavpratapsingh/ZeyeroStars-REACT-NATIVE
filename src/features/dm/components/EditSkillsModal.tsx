import React, { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import axios from 'axios';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import useSkillsCatalog from '../../../shared/hooks/useSkillsCatalog';
import useOwnedSkills from '../../../shared/hooks/useOwnedSkills';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';

const MAX_ACTIVE_SKILLS = 3;
const EMPTY_IDS: (string | number)[] = [];
const GRID_PADDING = 16;
const GRID_GAP = 12;

type SlotValue = string | number | null;

/**
 * currentActiveIds: player.active_skills (array of skill ids, max 3) - jo abhi save hai
 * onClose: modal band karo
 * onSaved: (activeSkillIds) => ... - save hone ke baad Profile ko naya data dedo
 *
 * Tap se kaam hota hai: owned skill par tap -> pehle khaali slot me chala
 * jaata hai (dobara tap = hata do); active slot par tap -> wo slot khaali.
 *
 * WEB -> RN CHANGES:
 * - `fixed inset-0` -> in-tree absoluteFill overlay + useTopZIndex(true)
 *   (parent full-screen View ho); top par insets.top.
 * - ⚠️ HTML5 drag & drop (onDragStart/onDrop/dataTransfer) RN mein exist hi
 *   nahi karta, isliye hata diya - web ka apna comment bhi bolta tha ki
 *   touch ke liye tap hi fallback hai. AGAR ACTIVE SLOTS KA ORDER
 *   (reorder) matter karta hai to yeh feature yahan nahi hai (web mein slots
 *   ke beech drag karke swap hota tha). Chaho to react-native-gesture-
 *   handler se real drag-drop bana dunga.
 * - localStorage token -> getToken().
 * - `currentActiveIds` effect ab array ki VALUE par chalta hai (reference par
 *   nahi) - warna parent har render par naya array de to user ke edits
 *   reset ho jate.
 */
interface EditSkillsModalProps {
  currentActiveIds?: (string | number)[];
  onClose: () => void;
  onSaved?: (activeSkillIds: (string | number)[]) => void;
}

const EditSkillsModal = ({ currentActiveIds = EMPTY_IDS, onClose, onSaved }: EditSkillsModalProps) => {
  const zIndex = useTopZIndex(true);
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const { skillsById, loading: catalogLoading } = useSkillsCatalog();
  const { ownedSkillIds, loading: ownedLoading } = useOwnedSkills();

  const [activeSlots, setActiveSlots] = useState<SlotValue[]>([null, null, null]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(true, handleClose);

  const currentKey = (currentActiveIds || []).join(',');
  useEffect(() => {
    const initial: SlotValue[] = [null, null, null];
    (currentActiveIds || []).slice(0, MAX_ACTIVE_SKILLS).forEach((id, i) => {
      initial[i] = id;
    });
    setActiveSlots(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  const loading = catalogLoading || ownedLoading;

  const ownedSkills = useMemo(
    () => ownedSkillIds.map((id) => skillsById[id]).filter(Boolean),
    [ownedSkillIds, skillsById]
  );

  const isActive = (skillId: string | number) => activeSlots.includes(skillId);

  const clearSlot = (slotIndex: number) => {
    setErrorMsg('');
    setActiveSlots((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  };

  const handleTapOwned = (skillId: string | number) => {
    if (isActive(skillId)) {
      // Dobara tap - unequip
      setActiveSlots((prev) => prev.map((s) => (s === skillId ? null : s)));
      setErrorMsg('');
      return;
    }
    const emptyIdx = activeSlots.indexOf(null);
    if (emptyIdx === -1) {
      setErrorMsg(`Only ${MAX_ACTIVE_SKILLS} skills can be active at once. Clear a slot first.`);
      return;
    }
    setErrorMsg('');
    setActiveSlots((prev) => {
      const next = [...prev];
      next[emptyIdx] = skillId;
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg('');
    try {
      const token = getToken();
      const skill_ids = activeSlots.filter((id): id is string | number => id !== null);

      const res = await axios.post(
        `${API_BASE}/skills/set-active`,
        { skill_ids },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      onSaved?.(res.data?.active_skills || skill_ids);
      onClose();
    } catch (err: any) {
      console.error('Set active skills error:', err.response?.data || err.message);
      setErrorMsg(err.response?.data?.detail || "Couldn't save, try again.");
    } finally {
      setSaving(false);
    }
  };

  const slotWidth = (screenW - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

  return (
    <View style={[styles.screen, { zIndex, elevation: 20, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.headerBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={16} color="#ffffff" />
          <Text style={styles.headerBtnText}>Close</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Edit Skills</Text>
        <Pressable
          onPress={handleSave}
          disabled={saving || loading}
          style={[styles.saveBtn, (saving || loading) && styles.dim]}
        >
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
        </Pressable>
      </View>

      {!!errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

      {/* Active slots */}
      <View style={styles.slotsSection}>
        <Text style={styles.sectionLabel}>
          Active Skills ({activeSlots.filter((s) => s !== null).length}/{MAX_ACTIVE_SKILLS}) — tap a skill below
        </Text>
        <View style={styles.slotsRow}>
          {activeSlots.map((skillId, i) => {
            const skill = skillId != null ? skillsById[skillId] : null;
            return (
              <Pressable
                key={i}
                onPress={() => skill && clearSlot(i)}
                accessibilityLabel={skill ? 'Tap to remove' : `Empty slot ${i + 1}`}
                style={[
                  styles.slot,
                  { width: slotWidth, height: slotWidth },
                  skill ? styles.slotFilled : styles.slotEmpty,
                ]}
              >
                {skill ? (
                  <>
                    <Ionicons name="flash-outline" size={22} color="#ffffff" />
                    <Text style={styles.slotName} numberOfLines={1}>
                      {skill.name}
                    </Text>
                    <View style={styles.slotX}>
                      <Ionicons name="close" size={12} color="#9a9a9a" />
                    </View>
                  </>
                ) : (
                  <Text style={styles.slotEmptyText}>Empty Slot {i + 1}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Owned skills */}
      <ScrollView style={styles.flex} contentContainerStyle={styles.ownedContent}>
        <Text style={[styles.sectionLabel, { marginBottom: 12 }]}>Owned Skills</Text>
        {loading ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : ownedSkills.length === 0 ? (
          <Text style={styles.emptyText}>You don't have any skills yet. Buy from the shop!</Text>
        ) : (
          <View style={styles.grid}>
            {ownedSkills.map((skill: any) => {
              const active = isActive(skill.skill_id);
              return (
                <Pressable
                  key={skill.skill_id}
                  onPress={() => handleTapOwned(skill.skill_id)}
                  style={[
                    styles.card,
                    { width: slotWidth },
                    active ? styles.cardActive : styles.cardIdle,
                  ]}
                >
                  {active && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={10} color="#0a0a0a" />
                    </View>
                  )}
                  <View style={styles.thumbBox}>
                    <Ionicons name="flash-outline" size={22} color="#ffffff" />
                  </View>
                  <Text style={styles.skillName} numberOfLines={1}>
                    {skill.name}
                  </Text>
                  {!!skill.description && (
                    <Text style={styles.skillDesc} numberOfLines={1}>
                      {skill.description}
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.5 },
  screen: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0a0a0a', // star-900
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#161616', // star-800
  },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtnText: { color: '#ffffff', fontSize: 14 },
  headerTitle: { color: '#ffffff', fontWeight: '700', fontSize: 18 },
  saveBtn: {
    backgroundColor: '#16a34a', // star-success-600
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 999,
  },
  saveText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  errorText: {
    color: '#f87171', // star-danger-400
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  slotsSection: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#161616',
  },
  sectionLabel: { color: '#9a9a9a', fontSize: 12, marginBottom: 8 }, // star-400
  slotsRow: { flexDirection: 'row', gap: GRID_GAP },
  slot: {
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  slotFilled: { borderColor: '#f2a65a', backgroundColor: 'rgba(242,166,90,0.1)' }, // star-primary-500
  slotEmpty: { borderColor: '#262626', backgroundColor: 'rgba(22,22,22,0.5)' },
  slotName: { width: '100%', marginTop: 4, color: '#ffffff', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  slotX: { position: 'absolute', top: 4, right: 4 },
  slotEmptyText: { color: '#3f3f3f', fontSize: 12, textAlign: 'center' }, // star-600
  ownedContent: { padding: GRID_PADDING, paddingBottom: 32 },
  emptyText: { color: '#6e6e6e', textAlign: 'center', marginTop: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  card: {
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 12,
    padding: 8,
    borderWidth: 2,
  },
  cardIdle: { borderColor: '#262626' },
  cardActive: {
    borderColor: '#22c55e', // star-success-500
    shadowColor: '#22c55e',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
    backgroundColor: '#22c55e',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  thumbBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillName: {
    width: '100%',
    marginTop: 6,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  skillDesc: {
    width: '100%',
    marginTop: 2,
    textAlign: 'center',
    color: '#6e6e6e', // star-500
    fontSize: 10,
  },
});

export default memo(EditSkillsModal);