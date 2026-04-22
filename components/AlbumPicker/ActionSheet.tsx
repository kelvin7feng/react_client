import { Fragment, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ActionSheetOption = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  options: ActionSheetOption[];
  cancelText?: string;
  title?: string;
};

export default function ActionSheet({
  visible,
  onClose,
  options,
  cancelText = '取消',
  title,
}: Props) {
  const insets = useSafeAreaInsets();
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 400,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, overlayAnim, slideAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View
            style={[
              styles.overlay,
              {
                opacity: overlayAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.45],
                }),
              },
            ]}
          />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.card,
            {
              paddingBottom: insets.bottom,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {title ? (
            <>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{title}</Text>
              </View>
              <View style={styles.divider} />
            </>
          ) : null}
          {options.map((opt, i) => (
            <Fragment key={`${opt.label}-${i}`}>
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.6}
                onPress={opt.onPress}
              >
                <Text
                  style={[
                    styles.rowText,
                    opt.destructive && styles.rowTextDestructive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
              {i < options.length - 1 ? <View style={styles.divider} /> : null}
            </Fragment>
          ))}
          {/* iOS 风格：最后一个 option 与 "取消" 之间插入一条明显的灰色分隔带 */}
          <View style={styles.cancelGap} />
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.6}
            onPress={onClose}
          >
            <Text style={[styles.rowText, styles.cancelText]}>
              {cancelText}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  titleRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  row: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  rowText: {
    fontSize: 17,
    color: '#333',
  },
  rowTextDestructive: {
    color: '#FF3B30',
  },
  cancelText: {
    fontWeight: '600',
  },
  // "取消" 前的灰色分隔带（iOS ActionSheet 风格）
  cancelGap: {
    height: 3,
    backgroundColor: '#f2f2f2',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e5e5e5',
  },
});
