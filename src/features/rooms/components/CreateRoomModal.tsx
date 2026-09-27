import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { FadeIn, CardPop } from '../../../shared/components/motion/ScreenTransition';
import { createRoom } from '../services/roomsApi';

interface CreateRoomModalProps {
  show: boolean;
  onClose: () => void;
  onCreated: (room: any) => void;
}

const CreateRoomModal = ({ show, onClose, onCreated }: CreateRoomModalProps) => {
  const __z = useTopZIndex(show);
  const [roomName, setRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useBackButtonHandler(show, onClose);

  const handleCreate = async () => {
    if (!roomName.trim() || creating) return;
    setCreating(true);
    setError('');
    try {
      const res = await createRoom(roomName.trim());
      onCreated(res.data.room);
      setRoomName('');
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Couldn't create room.");
    } finally {
      setCreating(false);
    }
  };

  if (!show) return null;

  return (
    <FadeIn show={show} style={[styles.backdrop, { zIndex: __z }]}>
      <CardPop style={styles.card}>
        <Text style={styles.title}>Create Your Room</Text>

        <TextInput
          autoFocus
          style={styles.input}
          placeholder="Room name (max 20 chars)"
          placeholderTextColor="#6e6e6e"
          value={roomName}
          maxLength={20}
          onChangeText={setRoomName}
          onSubmitEditing={handleCreate}
        />
        <Text style={styles.hint}>Aap sirf ek hi room bana sakte ho, isliye naam soch samajh kar rakhein.</Text>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.row}>
          <Pressable onPress={onClose} style={[styles.btn, styles.btnCancel]}>
            <Text style={styles.btnText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleCreate}
            disabled={creating || !roomName.trim()}
            style={[styles.btn, styles.btnCreate, (creating || !roomName.trim()) && styles.disabled]}
          >
            <Text style={styles.btnText}>{creating ? 'Creating...' : 'Create'}</Text>
          </Pressable>
        </View>
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
    backgroundColor: 'rgba(0,0,0,0.95)',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 384,
    backgroundColor: '#1c1730',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2c2545',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#ffffff', marginBottom: 16 },
  input: {
    width: '100%',
    backgroundColor: '#12101f',
    borderWidth: 1,
    borderColor: '#2c2545',
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    marginBottom: 4,
  },
  hint: { fontSize: 12, color: '#8b7fae', marginBottom: 12 },
  error: { fontSize: 12, color: '#f87171', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btnCancel: { backgroundColor: '#2c2545' },
  btnCreate: { backgroundColor: '#6d5bd0' },
  btnText: { color: '#ffffff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
});

export default memo(CreateRoomModal);