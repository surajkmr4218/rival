import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { colors } from '../../lib/theme';

/**
 * The app's signature canvas: a deep forest-green vertical gradient with a soft
 * neon-green bloom in the top-right corner. Drop it as the first child of a
 * full-bleed container (absolute fill) so every screen shares one backdrop.
 */
export default function ScreenBackground() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sb-base" x1="0" y1="0" x2="0.2" y2="1">
            <Stop offset="0" stopColor="#0b3322" />
            <Stop offset="0.5" stopColor="#072619" />
            <Stop offset="1" stopColor="#05201528" />
          </LinearGradient>
          <RadialGradient id="sb-bloom" cx="0.85" cy="0.08" r="0.7">
            <Stop offset="0" stopColor={colors.accent} stopOpacity="0.10" />
            <Stop offset="0.45" stopColor={colors.accent} stopOpacity="0.03" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="sb-violet" cx="0.05" cy="0.95" r="0.6">
            <Stop offset="0" stopColor={colors.secondary} stopOpacity="0.08" />
            <Stop offset="1" stopColor={colors.secondary} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="#06231a" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#sb-base)" />
        <Circle cx="100%" cy="0" r="55%" fill="url(#sb-bloom)" />
        <Circle cx="0" cy="100%" r="50%" fill="url(#sb-violet)" />
      </Svg>
    </View>
  );
}
