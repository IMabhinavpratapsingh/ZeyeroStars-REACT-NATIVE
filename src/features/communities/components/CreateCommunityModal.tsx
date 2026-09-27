import React, { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { FadeIn } from '../../../shared/components/motion/ScreenTransition';
import CommunityIconPicker from './CommunityIconPicker';
import { createCommunity } from '../services/communitiesApi';

interface CreateCommunityModalProps {
  show: boolean;
  onClose: () => void;
  onCreated?: (community: any) => void;
}

const CreateCommunityModal = ({ show, onClose, onCreated }: CreateCommunityModalProps) => {
  const zIndex = useTopZIndex(show);
  useBackButtonHandler(show, onClose);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [iconId, setIconId] = useState<number | string | null>(null);
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setName('');
    setDescription('');
    setCategory('');
    setIconId(null);
    setIconUrl(null);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleIconChange = ({ icon_id, icon_url }: { icon_id: number | string | null; icon_url: string }) => {
    setIconId(icon_id ?? null);
    setIconUrl(icon_url ?? null);
  };

  const handleSubmit = async () => {
    if (name.trim().length < 3 || creating) return;
    setCreating(true);
    setError('');
    try {
      const res = await createCommunity({
        name: name.trim(),
        description: description.trim(),
        category: category.trim(),
        icon_id: iconId,
        icon_url: iconUrl,
      });
      onCreated && onCreated(res.data.community);
      reset();
    } catch (err: any) {
      console.error('Create community error:', err.response?.data || err.message);
      setError(err.response?.data?.detail || "Couldn't create community, try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <FadeIn show={show} style={[styles.overlay, { zIndex, elevation: zIndex }]}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Community</Text>
          <Pressable onPress={handleClose} hitSlop={10}>
            <Ionicons name="close" size={22} color="#9a9a9a" />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Solo Leveling Fans"
            placeholderTextColor="#6b6b6b"
            value={name}
            onChangeText={setName}
            maxLength={50}
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="What's this community about?"
            placeholderTextColor="#6b6b6b"
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            numberOfLines={3}
          />

          <Text style={styles.label}>Category (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. anime, gaming"
            placeholderTextColor="#6b6b6b"
            value={category}
            onChangeText={setCategory}
            maxLength={30}
          />

          <Text style={styles.label}>Icon</Text>
          <CommunityIconPicker iconUrl={iconUrl} onChange={handleIconChange} />

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.footer}>
            <Pressable
              onPress={handleSubmit}
              disabled={creating || name.trim().length < 3}
              style={[styles.submitBtn, (creating || name.trim().length < 3) && styles.disabledBtn]}
            >
              <Text style={styles.submitBtnText}>{creating ? 'Creating...' : 'Create'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </FadeIn>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  label: { fontSize: 11, fontWeight: '700', color: '#9a9a9a', marginBottom: 4 },
  input: {
    width: '100%',
    backgroundColor: '#0a0a0a',
    color: '#fff',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    marginBottom: 12,
  },
  textarea: { height: 80, textAlignVertical: 'top' },
  errorText: { color: '#f87171', fontSize: 11, marginTop: 4 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 },
  submitBtn: { backgroundColor: '#f2a65a', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999 },
  disabledBtn: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontWeight: '700' },
});

export default memo(CreateCommunityModal);