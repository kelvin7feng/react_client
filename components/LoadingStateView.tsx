import React from 'react';
import { StyleSheet, Text, View, ViewStyle, TextStyle } from 'react-native';
import { Colors, FontSize, Spacing } from '../config/styles';
import { BouncingDotsIndicator } from '@/components/BouncingDotsIndicator';

type Props = {
  text?: string;
  size?: number;
  color?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export function LoadingStateView({
  text,
  size = 24,
  color = Colors.textTertiary,
  style,
  textStyle,
}: Props) {
  return (
    <View style={[styles.container, style]}>
      <BouncingDotsIndicator mode="inline" size={size} color={color} />
      {text ? <Text style={[styles.text, textStyle]}>{text}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
});
