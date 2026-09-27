import React from 'react';
import { Text } from 'react-native';

// Lightweight "web-novel style" inline formatting. We deliberately do NOT
// store HTML - chapters/synopsis stay plain text in the DB (so whitespace,
// word counts, exports etc. all keep working exactly as before). Instead we
// use a tiny markdown-like marker syntax that the writer's toolbar inserts
// around the selected text, and that the reader screens parse back into
// bold/italic/underline <Text> styles when rendering.
//
// Markers:
//   ***text***  -> bold + italic
//   **text**    -> bold
//   *text*      -> italic
//   __text__    -> underline
//
// Only single-line spans are matched (formatting a whole multi-paragraph
// block isn't a real use case here, and keeping it line-bound avoids
// accidentally swallowing unrelated paragraphs when markers are unbalanced).

export const MARKERS = {
  bold: '**',
  italic: '*',
  underline: '__',
};

export interface ToggleMarkerResult {
  text: string;
  selStart: number;
  selEnd: number;
}

// RN NOTE: toggleMarker itself is pure string logic - no web APIs, works
// as-is. The caller side changes though: web used a <textarea> DOM ref's
// .selectionStart/.selectionEnd; RN's <TextInput> instead uses the
// onSelectionChange prop + a controlled `selection={{start, end}}` prop
// to read/restore cursor position. Wire toggleMarker's returned
// selStart/selEnd into that TextInput's `selection` state after calling
// this function.
//
// Wraps (or un-wraps, if the exact same marker already surrounds the
// selection) the selected substring of `text` with `marker`. Returns the
// new text plus where the selection should land afterwards, so the caller
// can restore focus/selection on the TextInput.
export function toggleMarker(text: string, selStart: number, selEnd: number, marker: string): ToggleMarkerResult {
  const before = text.slice(0, selStart);
  const selected = text.slice(selStart, selEnd);
  const after = text.slice(selEnd);
  const len = marker.length;

  const alreadyWrapped = before.slice(-len) === marker && after.slice(0, len) === marker;

  if (alreadyWrapped) {
    return {
      text: before.slice(0, -len) + selected + after.slice(len),
      selStart: selStart - len,
      selEnd: selEnd - len,
    };
  }

  if (!selected) {
    // Nothing selected - drop a marker pair at the cursor so the user can
    // just start typing the emphasised word.
    const newText = before + marker + marker + after;
    const cursor = selStart + len;
    return { text: newText, selStart: cursor, selEnd: cursor };
  }

  return {
    text: before + marker + selected + marker + after,
    selStart: selStart + len,
    selEnd: selEnd + len,
  };
}

const FORMAT_PATTERN = /(\*\*\*[^\n*]+\*\*\*|\*\*[^\n*]+\*\*|__[^\n_]+__|\*[^\n*]+\*)/g;

// Turns "plain text with **markers**" into an array of React Native <Text>
// nodes (bold/italic/underline styled) plus plain strings for everything
// else. Caller must wrap the returned array in a parent <Text> (RN nests
// <Text> inside <Text> fine) - e.g. <Text>{renderFormattedText(chapter)}</Text>.
// Line-wrapping/newlines are preserved automatically by RN's <Text> (no
// whitespace-pre-wrap needed like on web).
export function renderFormattedText(text: string | null | undefined): React.ReactNode {
  if (!text) return null;
  const parts = String(text).split(FORMAT_PATTERN);
  return parts.map((part, i) => {
    if (!part) return null;
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 7) {
      return (
        <Text key={i} style={{ fontWeight: 'bold', fontStyle: 'italic' }}>
          {part.slice(3, -3)}
        </Text>
      );
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 5) {
      return (
        <Text key={i} style={{ fontWeight: 'bold' }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('__') && part.endsWith('__') && part.length >= 5) {
      return (
        <Text key={i} style={{ textDecorationLine: 'underline' }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 3) {
      return (
        <Text key={i} style={{ fontStyle: 'italic' }}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}