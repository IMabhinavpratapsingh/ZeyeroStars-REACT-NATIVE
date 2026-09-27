import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SlideInRight } from '../../../shared/components/motion/ScreenTransition';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import type { LegalSection } from '../content/privacyPolicyText';

/**
 * Privacy Policy aur Terms of Service dono ke liye same generic viewer -
 * Login page (footer link) aur Settings (Legal section) dono se yahi
 * modal khulta hai. title/lastUpdated/sections props se content badal
 * jaata hai.
 *
 * WEB -> RN CHANGES:
 * - `lucide-react`'s ArrowLeft -> Ionicons "arrow-back".
 * - `overflow-y-auto` -> ScrollView.
 * - `whitespace-pre-line` (CSS) -> RN Text preserves \n by default, so no
 *   special style needed - the section bodies' blank lines/bullets render
 *   as-is.
 * - `max-w-2xl mx-auto` centered column -> `alignSelf: 'center', width:
 *   '100%', maxWidth: 640` on the ScrollView's content.
 */
interface LegalDocModalProps {
  show: boolean;
  onClose: () => void;
  title: string;
  lastUpdated: string;
  sections?: LegalSection[];
}

const LegalDocModal = ({ show, onClose, title, lastUpdated, sections = [] }: LegalDocModalProps) => {
  const __z = useTopZIndex(show);
  useBackButtonHandler(show, onClose);

  return (
    <SlideInRight show={show} style={[styles.container, { zIndex: __z }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={16} color="#ffffff" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>

        {sections.map((s, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.sectionHeading}>{s.heading}</Text>
            <Text style={styles.sectionBody}>{s.body}</Text>
          </View>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SlideInRight>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#151024',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#241f38',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  headerTitle: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17, color: '#ffffff' },
  headerSpacer: { width: 56 },
  body: { flex: 1 },
  bodyContent: { alignSelf: 'center', width: '100%', maxWidth: 640, padding: 20 },
  lastUpdated: { fontSize: 11, color: '#5f5878', marginBottom: 20 },
  section: { marginBottom: 20 },
  sectionHeading: { fontSize: 13, fontWeight: '700', color: '#a78bfa', marginBottom: 6 },
  sectionBody: { fontSize: 13, color: '#d8d2e8', lineHeight: 20 },
});

export default LegalDocModal;