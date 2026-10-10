import React, { type ReactNode, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

// Chhota "portal": koi bhi component apna overlay (jaise LongPressActionSheet)
// yahan publish kar sakta hai, aur `InlineOverlayHost` use screen ke root par
// render karta hai - RN <Modal> ke bina.
//
// WHY: RN <Modal> Android par apni ALAG window banata hai jo focus le leta hai,
// isliye khula hua keyboard turant band ho jaata hai (aur Modal hatne par wapas
// aata hai). In-tree overlay mein focus nahi badalta -> keyboard khula rehta hai.
type Listener = (items: Array<[string, ReactNode]>) => void;

const nodes = new Map<string, ReactNode>();
let listeners: Listener[] = [];

const emit = () => {
  const snapshot = Array.from(nodes.entries());
  listeners.forEach((l) => l(snapshot));
};

export function publishInlineOverlay(key: string, node: ReactNode | null) {
  if (node === null) {
    if (!nodes.has(key)) return;
    nodes.delete(key);
  } else {
    nodes.set(key, node);
  }
  emit();
}

export function hasInlineOverlayHost() {
  return listeners.length > 0;
}

export const InlineOverlayHost = () => {
  const [items, setItems] = useState<Array<[string, ReactNode]>>(() => Array.from(nodes.entries()));
  useEffect(() => {
    listeners.push(setItems);
    setItems(Array.from(nodes.entries()));
    return () => {
      listeners = listeners.filter((l) => l !== setItems);
    };
  }, []);
  if (items.length === 0) return null;
  return (
    <View style={styles.host} pointerEvents="box-none">
      {items.map(([k, n]) => (
        <React.Fragment key={k}>{n}</React.Fragment>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  host: { ...StyleSheet.absoluteFill, zIndex: 100, elevation: 100 },
});