import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// OPTIONAL: gradient (glossy) fill ke liye `@react-native-masked-view/masked-view`.
// Install nahi hai to solid gold fill use hota hai - bundle tootega nahi
// (Metro try/catch ke andar missing module allow karta hai).
let MaskedView: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MaskedView = require('@react-native-masked-view/masked-view').default;
} catch {
  MaskedView = null;
}

/**
 * "ZeyeroStars" - beech ke letters bade, kinaare ke chhote, poore word par
 * embossed / 3D "pop-out" look.
 *
 * WEB -> RN CHANGES:
 * - Web mein stacked `text-shadow` (5 layers) se depth banti thi. RN mein
 *   `textShadow*` sirf EK shadow deta hai, isliye depth ab STACKED TEXT LAYERS
 *   se banti hai (har layer 1px neeche + dark purple), sabse neeche ek soft
 *   drop-shadow, sabse upar gold fill.
 * - `background-clip: text` gradient -> MaskedView + LinearGradient (optional,
 *   upar dekho). Nahi hai to solid #ffd27a.
 * - Har letter ek nested <Text> hai (alag fontSize) - isse baseline apne aap
 *   align rehti hai, alag View/flex hack nahi chahiye.
 * - `className` prop hata diya -> `style` (container ke liye).
 */
interface PopTextProps {
  text: string;
  maxSize?: number;
  minSize?: number;
  style?: StyleProp<ViewStyle>;
}

// [offsetY, color] - web ke emboss stack se (#7c3aed, #6d28d9, #5b21b6)
const DEPTH_LAYERS: [number, string][] = [
  [3, '#5b21b6'],
  [2, '#6d28d9'],
  [1, '#7c3aed'],
];

const PopText = ({ text, maxSize = 42, minSize = 24, style }: PopTextProps) => {
  const sizes = useMemo(() => {
    const letters = text.split('');
    const n = letters.length;
    const mid = (n - 1) / 2;
    return letters.map((ch, i) => {
      const d = mid === 0 ? 0 : Math.abs(i - mid) / mid; // 0 (center) .. 1 (edge)
      return { ch, size: maxSize - (maxSize - minSize) * d };
    });
  }, [text, maxSize, minSize]);

  const lineHeight = Math.round(maxSize * 1.2);

  // Ek "layer" = poora word, har letter alag fontSize ke saath.
  const renderLayer = (color: string | undefined, extra?: object) => (
    <Text
      style={[styles.text, { lineHeight }, color ? { color } : null, extra]}
      allowFontScaling={false}
      selectable={false}
    >
      {sizes.map(({ ch, size }, i) => (
        <Text key={i} style={{ fontSize: size }}>
          {ch}
        </Text>
      ))}
    </Text>
  );

  const softShadow = {
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 10,
  };

  return (
    <View style={[styles.container, { paddingBottom: 6 }, style]} accessibilityLabel={text}>
      {/* Sabse neeche: soft drop shadow + deepest depth layer */}
      <View style={[styles.abs, { top: 4 }]} pointerEvents="none">
        {renderLayer('#4c1d95', softShadow)}
      </View>

      {/* Depth layers (neeche se upar) */}
      {DEPTH_LAYERS.map(([dy, color]) => (
        <View key={dy} style={[styles.abs, { top: dy }]} pointerEvents="none">
          {renderLayer(color)}
        </View>
      ))}

      {/* Top: gold fill (gradient agar MaskedView available ho) */}
      {MaskedView ? (
        <MaskedView maskElement={renderLayer('#000')}>
          <LinearGradient colors={['#fff7e0', '#ffd27a', '#f5a623']} locations={[0, 0.45, 1]}>
            {renderLayer('transparent')}
          </LinearGradient>
        </MaskedView>
      ) : (
        renderLayer('#ffd27a')
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  abs: {
    position: 'absolute',
    left: 0,
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.5,
    includeFontPadding: false,
  },
});

export default memo(PopText);