import React, { memo, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE } from '../../../shared/config/config';
import { getToken } from '../../../shared/services/NetworkManager';
import useBackButtonHandler from '../../../shared/hooks/useBackButtonHandler';
import useTopZIndex from '../../../shared/hooks/useTopZIndex';
import useStableCallback from '../../../shared/hooks/useStableCallback';
import { CardPop } from '../../../shared/components/motion/ScreenTransition';

/**
 * mode: "block" | "report" | "report_post" | "report_comment" | "report_message"
 * target: { id, username, label } | null
 *   - id: user id ("block"/"report") ya post/comment/message id (baaki modes)
 *   - username: sirf "block"/"report" ke liye dikhaya jaata hai
 *   - label: content modes ke liye title me kya likhna hai (e.g. "this post")
 *
 * BLOCK: koi reason nahi maangte, bas ek seedha confirm ("Block user?").
 *   POST {API_BASE}/profile/block { target_id }
 * REPORT (user): reason zaroori hai.
 *   POST {API_BASE}/profile/report { target_id, reason }
 * REPORT (post/comment/message): reason zaroori hai, id se report hota hai.
 *   POST {API_BASE}/report/{post|comment|message}/{target.id} { reason }
 *
 * WEB -> RN CHANGES:
 * - `motion/react` -> `CardPop` (shared ScreenTransition, moti-based).
 * - `fixed inset-0` overlay -> in-tree absoluteFill overlay + useTopZIndex.
 * - `<textarea>` -> `<TextInput multiline>`.
 * - localStorage token -> `getToken()` (NetworkManager, in-memory cache).
 * - Android hardware back = close (useBackButtonHandler).
 */
type ReportBlockMode = 'block' | 'report' | 'report_post' | 'report_comment' | 'report_message';

interface ReportBlockTarget {
  id: string | number;
  username?: string;
  label?: string;
}

interface ReportBlockModalProps {
  mode: ReportBlockMode;
  target: ReportBlockTarget | null;
  onClose: () => void;
  onDone?: (mode: ReportBlockMode) => void;
}

const CONTENT_MODES: Record<string, { endpoint: (id: string | number) => string; noun: string }> = {
  report_post: { endpoint: (id) => `report/post/${id}`, noun: 'post' },
  report_comment: { endpoint: (id) => `report/comment/${id}`, noun: 'comment' },
  report_message: { endpoint: (id) => `report/message/${id}`, noun: 'message' },
};

const ReportBlockModal = ({ mode, target, onClose, onDone }: ReportBlockModalProps) => {
  const zIndex = useTopZIndex(target);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleClose = useStableCallback(() => onClose?.());
  useBackButtonHandler(!!target, handleClose);

  useEffect(() => {
    if (target) {
      setReason('');
      setError('');
    }
  }, [target, mode]);

  if (!target) return null;

  const isBlock = mode === 'block';
  const contentMode = CONTENT_MODES[mode];
  const isContentReport = !!contentMode;

  const titleIcon = isBlock ? 'ban-outline' : 'warning-outline';
  const title = isBlock
    ? `Block ${target.username || 'user'}`
    : isContentReport
      ? `Report ${target.label || `this ${contentMode.noun}`}`
      : `Report ${target.username || 'user'}`;
  const actionLabel = isBlock ? 'Block User' : 'Submit Report';
  const confirmColor = isBlock ? '#dc2626' : '#ca8a04'; // star-danger-600 / yellow-600
  const canSubmit = isBlock || !!reason.trim();

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const token = getToken();
      let url: string;
      let body: Record<string, unknown>;
      if (isBlock) {
        url = `${API_BASE}/profile/block`;
        body = { target_id: target.id };
      } else if (isContentReport) {
        url = `${API_BASE}/${contentMode.endpoint(target.id)}`;
        body = { reason: reason.trim() };
      } else {
        url = `${API_BASE}/profile/report`;
        body = { target_id: target.id, reason: reason.trim() };
      }
      await axios.post(url, body, { headers: { Authorization: `Bearer ${token}` } });
      onDone?.(mode);
      onClose();
    } catch (err: any) {
      console.error(`${mode} error:`, err.response?.data || err.message);
      setError(err.response?.data?.detail || "Couldn't submit, try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.overlay, { zIndex, elevation: 20 }]} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />

      <View style={styles.center} pointerEvents="box-none">
        <CardPop style={styles.card}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name={titleIcon as any} size={16} color="#ffffff" />
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={16} color="#9a9a9a" />
            </Pressable>
          </View>

          {isBlock ? (
            <Text style={styles.blockText}>
              Block {target.username || 'this user'}? After blocking, they won't be able to message or trade with you.
            </Text>
          ) : (
            <>
              <Text style={styles.label}>Reason</Text>
              <TextInput
                autoFocus
                multiline
                numberOfLines={4}
                maxLength={500}
                value={reason}
                onChangeText={setReason}
                placeholder="Describe the reason for reporting..."
                placeholderTextColor="#6e6e6e"
                style={styles.textarea}
              />
            </>
          )}

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
            style={[
              styles.submitBtn,
              { backgroundColor: !canSubmit || submitting ? '#262626' : confirmColor },
            ]}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={[styles.submitText, (!canSubmit || submitting) ? styles.submitTextDisabled : null]}>
                {actionLabel}
              </Text>
            )}
          </Pressable>
        </CardPop>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 384,
    backgroundColor: '#161616', // star-800
    borderWidth: 1,
    borderColor: '#262626', // star-700
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    marginRight: 12,
  },
  title: {
    fontWeight: '700',
    fontSize: 15,
    color: '#ffffff',
    flexShrink: 1,
  },
  blockText: {
    fontSize: 14,
    color: '#d4d4d4', // star-300
    marginBottom: 4,
    lineHeight: 20,
  },
  label: {
    fontSize: 12,
    color: '#9a9a9a', // star-400
    marginBottom: 6,
  },
  textarea: {
    width: '100%',
    minHeight: 96,
    backgroundColor: '#0a0a0a', // star-900
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 12,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 11,
    color: '#f87171', // star-danger-400
    marginTop: 8,
  },
  submitBtn: {
    width: '100%',
    marginTop: 16,
    paddingVertical: 11,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  submitTextDisabled: {
    color: '#6e6e6e', // star-500
  },
});

export default memo(ReportBlockModal);