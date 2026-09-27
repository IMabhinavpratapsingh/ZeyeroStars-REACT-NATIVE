import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ChessFlow from './ChessFlow';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import { FadeIn } from '../../../shared/components/motion/ScreenTransition';

// Opens when "Chess" is picked from Battle -> game select, on the Home
// screen (different from the room's floating RoomChessPanel: there the
// panel is half/full/hidden like RoomNovelPanel, here it's simply
// full-screen - no drag/minimize needed).
//
// WEB -> RN CHANGE: `motion/react`'s scale+fade -> shared `FadeIn`
// (moti wrapper, see shared/components/motion/ScreenTransition.tsx).
interface ChessFullScreenModalProps {
  show: boolean;
  onClose: () => void;
}

const ChessFullScreenModal = ({ show, onClose }: ChessFullScreenModalProps) => {
  const __z = useTopZIndex(show);
  useBackButtonHandler(show, onClose);

  return (
    <FadeIn show={show} style={[styles.container, { zIndex: __z }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chess</Text>
        <Pressable onPress={onClose} accessibilityLabel="Close" style={styles.closeBtn}>
          <Ionicons name="close" size={18} color="#a8a0c0" />
        </Pressable>
      </View>
      <View style={styles.body}>
        <ChessFlow />
      </View>
    </FadeIn>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#0a0912',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#241f38',
  },
  headerTitle: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
  closeBtn: { padding: 6, borderRadius: 999 },
  body: { flex: 1, minHeight: 0 },
});

export default memo(ChessFullScreenModal);