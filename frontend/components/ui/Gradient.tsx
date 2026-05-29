import React, { useId } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';

interface GradientProps {
  /** Ordered color stops (2+). */
  colors: string[];
  /** Optional explicit offsets [0..1] matching `colors`; defaults to even spread. */
  locations?: number[];
  /** Direction. Defaults to top→bottom. Pass {x:0,y:0}→{x:1,y:1} for diagonal. */
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  /** Corner radius so the fill clips to a card shape. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

/**
 * A lightweight linear-gradient surface built on react-native-svg (no extra
 * deps). Fills its own bounds; place children on top. Each instance gets a
 * unique gradient id so multiple gradients can coexist on one screen.
 */
export default function Gradient({
  colors,
  locations,
  start = { x: 0, y: 0 },
  end = { x: 0, y: 1 },
  radius = 0,
  style,
  children,
}: GradientProps) {
  const id = `grad-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const stops = colors.map((c, i) => ({
    color: c,
    offset: locations?.[i] ?? i / (colors.length - 1),
  }));

  return (
    <View style={[{ overflow: 'hidden', borderRadius: radius }, style]}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <SvgLinearGradient id={id} x1={start.x} y1={start.y} x2={end.x} y2={end.y}>
            {stops.map((s, i) => (
              <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={1} />
            ))}
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} rx={radius} ry={radius} />
      </Svg>
      {children}
    </View>
  );
}
