// BLUFF COURT - original card identity for the hidden-info bluffing
// mini-game. Cards are not real playing cards (no King/Queen/Ace) - har
// card ek "Sigil" hai, 6 original mystical-element marks. Round ke start
// mein system ek Sigil "call" karta hai - hum use "EMBER CALL" jaisa naam
// dete hain.
//
// WEB -> RN CHANGE: lucide-react icons (Flame/Droplet/Leaf/Snowflake/
// Moon/Sun) -> Ionicons equivalents (flame/water/leaf/snow/moon/sunny),
// same icon family used across the rest of this RN codebase.

export type SigilId = 'ember' | 'tide' | 'bloom' | 'frost' | 'shadow' | 'dawn';

export interface Sigil {
  id: SigilId;
  name: string;
  icon: string; // Ionicons name
  color: string;
}

export const SIGILS: Sigil[] = [
  { id: 'ember', name: 'Ember', icon: 'flame', color: '#f2724a' },
  { id: 'tide', name: 'Tide', icon: 'water', color: '#4aa8f2' },
  { id: 'bloom', name: 'Bloom', icon: 'leaf', color: '#5bc26a' },
  { id: 'frost', name: 'Frost', icon: 'snow', color: '#9fd8f0' },
  { id: 'shadow', name: 'Shadow', icon: 'moon', color: '#a78bfa' },
  { id: 'dawn', name: 'Dawn', icon: 'sunny', color: '#facc15' },
];

export const sigilById = (id: string | null | undefined): Sigil | undefined =>
  SIGILS.find((s) => s.id === id);

// Default settings - inn sabko later server/room-settings se override kiya
// ja sakta hai. Yeh sirf frontend fallback defaults hain.
export const DEFAULT_SETTINGS = {
  handSize: 5,
  doomMax: 6,
  maxPlayCount: 3,
  copiesPerSigil: 8,
};

export const DOOM_LABEL = 'Trigger Shot';
export const CALL_LABEL = 'CALL';
export const ACCUSE_LABEL = 'ACCUSE';
export const ACCEPT_LABEL = 'Let it ride';