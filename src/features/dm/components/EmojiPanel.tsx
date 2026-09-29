import React, { memo, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Telegram jaisa emoji panel - keyboard ki jagah (usi height me) khulta hai.
 * Pure JS hai, koi extra library nahi. (Android/iOS system emoji keyboard ko app
 * se programmatically kholna possible nahi hai, isliye yeh in-app panel hai.)
 *
 * - onPick(emoji): input me emoji daalo
 * - onBackspace(): input ka pichhla character/emoji hatao
 */
const CATEGORIES: { key: string; icon: string; emojis: string }[] = [
  {
    key: 'smileys',
    icon: '😀',
    emojis:
      '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 🤡 💩 👻 💀 ☠️ 👽 👾 🤖 🎃',
  },
  {
    key: 'people',
    icon: '👋',
    emojis:
      '👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦵 🦶 👂 👃 🧠 👀 👁️ 👅 👄 💋 👶 🧒 👦 👧 🧑 👨 👩 🧔 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🙇 🤦 🤷 👮 🕵️ 💂 🥷 👷 🤴 👸 🦸 🦹 🧙 🧛 🧟 🧞 🧜 🧚 👼 🎅 🤶 🏃 💃 🕺 👯 🧘',
  },
  {
    key: 'nature',
    icon: '🐶',
    emojis:
      '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🐢 🐍 🦎 🐙 🦑 🦀 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🐘 🦏 🐪 🐫 🦒 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🐐 🦌 🐕 🐩 🐈 🐓 🦃 🕊️ 🐇 🐁 🐀 🐿️ 🌵 🎄 🌲 🌳 🌴 🌱 🌿 ☘️ 🍀 🍁 🍂 🍃 🌸 🌼 🌻 🌹 🌷 🌺 ⭐ 🌟 ✨ ⚡ 🔥 🌈 ☀️ ⛅ ☁️ 🌧️ ❄️ 🌙',
  },
  {
    key: 'food',
    icon: '🍔',
    emojis:
      '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥕 🌽 🌶️ 🥔 🍠 🥐 🍞 🥖 🧀 🥚 🍳 🥞 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🍘 🍥 🥠 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 ☕ 🍵 🥤 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🍾',
  },
  {
    key: 'activity',
    icon: '⚽',
    emojis:
      '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🎱 🏓 🏸 🥅 🏒 🏑 🏏 ⛳ 🏹 🎣 🥊 🥋 🎽 ⛸️ 🎿 🏂 🏋️ 🤸 🤼 🤺 🏇 🧗 🏄 🏊 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🎗️ 🎫 🎟️ 🎪 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎲 🎯 🎳 🎮 🎰 🧩 ♟️',
  },
  {
    key: 'travel',
    icon: '🚗',
    emojis:
      '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🚚 🚛 🚜 🛵 🏍️ 🚲 🛴 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🚀 🛸 🚁 ⛵ 🚤 🛥️ 🚢 ⚓ ⛽ 🚧 🚦 🗺️ 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🏕️ 🏠 🏡 🏢 🏥 🏦 🏨 🏪 🏫 🏭',
  },
  {
    key: 'objects',
    icon: '💡',
    emojis:
      '⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💽 💾 💿 📷 📹 🎥 📞 ☎️ 📺 📻 ⏰ ⏳ 🔋 🔌 💡 🔦 🕯️ 💸 💵 💴 💶 💷 💰 💳 💎 ⚖️ 🔧 🔨 ⚒️ 🛠️ ⛏️ 🔩 ⚙️ 🔫 💣 🔪 🗡️ ⚔️ 🛡️ 🚬 ⚰️ 🔮 📿 💈 🔭 🔬 💊 💉 🌡️ 🚽 🚿 🛁 🔑 🗝️ 🚪 🛋️ 🛏️ 🧸 🎁 🎈 🎀 🎊 🎉 ✉️ 📦 📝 📁 📅 📌 📎 ✂️ 🔒 🔓',
  },
  {
    key: 'symbols',
    icon: '❤️',
    emojis:
      '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ ☯️ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ⚛️ ☢️ ☣️ 📴 📳 ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕ 🛑 ⛔ 📛 🚫 💯 💢 ♨️ ❗ ❓ ‼️ ⁉️ ✅ ☑️ ✔️ ➕ ➖ ➗ ✖️ ♾️ 💲 ™️ ©️ ®️ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔺 🔻 🔶 🔷 ♻️ ⚜️ 🔱',
  },
];

const COLUMNS = 8;
const TAB_BAR_H = 44;

interface EmojiPanelProps {
  height: number;
  bottomInset?: number;
  onPick: (emoji: string) => void;
  onBackspace: () => void;
}

const EmojiCell = memo(({ emoji, size, onPick }: { emoji: string; size: number; onPick: (e: string) => void }) => (
  <Pressable onPress={() => onPick(emoji)} style={[styles.cell, { width: size, height: size }]}>
    <Text style={styles.emoji}>{emoji}</Text>
  </Pressable>
));
EmojiCell.displayName = 'EmojiCell';

const EmojiPanel = ({ height, bottomInset = 0, onPick, onBackspace }: EmojiPanelProps) => {
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState(0);
  const cellSize = Math.floor(width / COLUMNS);

  const data = useMemo(() => CATEGORIES[tab].emojis.split(' ').filter(Boolean), [tab]);

  return (
    <View style={[styles.panel, { height }]}>
      <View style={styles.tabBar}>
        {CATEGORIES.map((c, i) => (
          <Pressable key={c.key} onPress={() => setTab(i)} style={[styles.tab, tab === i && styles.tabActive]}>
            <Text style={styles.tabIcon}>{c.icon}</Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        key={tab}
        data={data}
        numColumns={COLUMNS}
        keyExtractor={(e, i) => `${e}-${i}`}
        renderItem={({ item }) => <EmojiCell emoji={item} size={cellSize} onPick={onPick} />}
        contentContainerStyle={{ paddingBottom: bottomInset + 56 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        initialNumToRender={48}
        windowSize={5}
      />

      <Pressable onPress={onBackspace} style={[styles.backspace, { bottom: bottomInset + 10 }]} hitSlop={6}>
        <Ionicons name="backspace-outline" size={22} color="#e5e5e5" />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  panel: { backgroundColor: '#111111', borderTopWidth: 1, borderTopColor: '#1f1f1f' },
  tabBar: { height: TAB_BAR_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 4 },
  tab: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, opacity: 0.55 },
  tabActive: { opacity: 1, backgroundColor: '#262626' },
  tabIcon: { fontSize: 20 },
  cell: { alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 28 },
  backspace: {
    position: 'absolute',
    right: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#262626',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default memo(EmojiPanel);