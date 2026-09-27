import { Ionicons } from '@expo/vector-icons';
import { memo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CardPop, FadeIn } from '../../../shared/components/motion/ScreenTransition';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { searchRadioStations } from '../services/roomsApi';

export interface RadioStation {
  name: string;
  [key: string]: any;
}

interface RoomRadioModalProps {
  show: boolean;
  onClose: () => void;
  onSelectStation: (station: RadioStation) => void;
}

const RoomRadioModal = ({ show, onClose, onSelectStation }: RoomRadioModalProps) => {
  const __z = useTopZIndex(show);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RadioStation[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  useBackButtonHandler(show, onClose);

  const handleSearch = async () => {
    if (!query.trim() || searching) return;
    setSearching(true);
    setError('');
    try {
      const res = await searchRadioStations(query.trim());
      if (res.data.success) {
        setResults(res.data.data || []);
        if ((res.data.data || []).length === 0) setError('No station found, try a different name.');
      } else {
        setError(res.data.message || 'Search failed.');
      }
    } catch (err) {
      setError('Search failed.');
    } finally {
      setSearching(false);
    }
  };

  if (!show) return null;

  return (
    <FadeIn show={show} style={[styles.backdrop, { zIndex: __z }]}>
      <CardPop style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.title}>Select Radio</Text>
          <Pressable onPress={onClose}>
            <Ionicons name="close" size={18} color="#a8a0c0" />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            autoFocus
            style={styles.input}
            placeholder="Search station (e.g. lofi, bbc)"
            placeholderTextColor="#6e6e6e"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
          />
          <Pressable onPress={handleSearch} disabled={searching} style={[styles.goBtn, searching && styles.disabled]}>
            <Text style={styles.goBtnText}>{searching ? '...' : 'Go'}</Text>
          </Pressable>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          style={styles.list}
          data={results}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <Pressable onPress={() => onSelectStation(item)} style={styles.stationRow}>
              <Text style={styles.stationName} numberOfLines={1}>{item.name}</Text>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
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
    maxHeight: '80%',
    backgroundColor: '#1c1730',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2c2545',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    backgroundColor: '#12101f',
    borderWidth: 1,
    borderColor: '#2c2545',
    borderRadius: 8,
    padding: 10,
    color: '#ffffff',
  },
  goBtn: { backgroundColor: '#6d5bd0', paddingHorizontal: 16, justifyContent: 'center', borderRadius: 8 },
  goBtnText: { color: '#ffffff', fontWeight: '700' },
  disabled: { opacity: 0.5 },
  error: { fontSize: 12, color: '#f87171', marginBottom: 8 },
  list: { flexGrow: 0 },
  stationRow: {
    backgroundColor: '#2c2545',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3a3160',
  },
  stationName: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
});

export default memo(RoomRadioModal);