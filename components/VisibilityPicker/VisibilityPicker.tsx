import { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing } from '../../config/styles';

export type VisibilityOption = 'public' | 'mutual' | 'private';

export const VISIBILITY_LABELS: Record<VisibilityOption, string> = {
  public: '公开可见',
  mutual: '仅互关好友可见',
  private: '仅自己可见',
};

// 与服务端约定的数字编码，最终以字符串随 FormData 上传
export const VISIBILITY_CODE: Record<VisibilityOption, number> = {
  public: 0,
  mutual: 1,
  private: 2,
};

type Props = {
  visible: boolean;
  value: VisibilityOption;
  allowedCount: number;
  deniedCount: number;
  onClose: () => void;
  onChange: (value: VisibilityOption) => void;
  onOpenAllowed: () => void;
  onOpenDenied: () => void;
  hideTitle?: boolean;
  hideFooter?: boolean;
};

type RadioItemProps = {
  label: string;
  description?: string;
  icon: keyof typeof Ionicons.glyphMap;
  checked: boolean;
  onPress: () => void;
};

function RadioItem({ label, description, icon, checked, onPress }: RadioItemProps) {
  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={onPress}>
      <View style={styles.rowIcon}>
        <Ionicons
          name={icon}
          size={22}
          color={checked ? Colors.primary : Colors.textSecondary}
        />
      </View>
      <View style={styles.rowMain}>
        <Text style={[styles.rowLabel, checked && styles.rowLabelActive]}>{label}</Text>
        {description ? (
          <Text style={styles.rowDescription}>{description}</Text>
        ) : null}
      </View>
      {checked ? (
        <Ionicons name="checkmark" size={22} color={Colors.primary} />
      ) : (
        <View style={styles.rowTrailingPlaceholder} />
      )}
    </TouchableOpacity>
  );
}

type NavItemProps = {
  label: string;
  count: number;
  onPress: () => void;
};

function NavItem({ label, count, onPress }: NavItemProps) {
  return (
    <TouchableOpacity style={styles.navRow} activeOpacity={0.7} onPress={onPress}>
      <Text style={styles.navLabel}>{label}</Text>
      <View style={styles.navTrailing}>
        <Text style={styles.navCount}>
          {count > 0 ? `${count} 人` : '未设置'}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={Colors.textTertiary}
          style={{ marginLeft: 4 }}
        />
      </View>
    </TouchableOpacity>
  );
}

export default function VisibilityPicker({
  visible,
  value,
  allowedCount,
  deniedCount,
  onClose,
  onChange,
  onOpenAllowed,
  onOpenDenied,
  hideTitle,
  hideFooter,
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
          {!hideTitle && (
            <>
              <View style={styles.titleRow}>
                <Text style={styles.title}>谁可以看</Text>
              </View>
              <View style={styles.divider} />
            </>
          )}

          <RadioItem
            icon="lock-open-outline"
            label={VISIBILITY_LABELS.public}
            description="所有人都可以看到这条内容"
            checked={value === 'public'}
            onPress={() => onChange('public')}
          />
          <View style={styles.rowDivider} />
          <RadioItem
            icon="people-outline"
            label={VISIBILITY_LABELS.mutual}
            description="仅你与对方互相关注时可见"
            checked={value === 'mutual'}
            onPress={() => onChange('mutual')}
          />
          <View style={styles.rowDivider} />
          <RadioItem
            icon="lock-closed-outline"
            label={VISIBILITY_LABELS.private}
            description="仅自己可见，相当于私密保存"
            checked={value === 'private'}
            onPress={() => onChange('private')}
          />

          <View style={styles.sectionGap} />

          <NavItem label="只给谁看" count={allowedCount} onPress={onOpenAllowed} />
          <View style={styles.rowDivider} />
          <NavItem label="不给谁看" count={deniedCount} onPress={onOpenDenied} />

          {!hideFooter && (
            <>
              <View style={styles.sectionGap} />
              <TouchableOpacity
                style={[styles.row, styles.cancelRow]}
                activeOpacity={0.6}
                onPress={onClose}
              >
                <Text style={styles.cancelText}>完成</Text>
              </TouchableOpacity>
            </>
          )}
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
    backgroundColor: Colors.black,
  },
  card: {
    backgroundColor: Colors.backgroundWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  titleRow: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderLight,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.lg + 22 + Spacing.md,
    backgroundColor: Colors.borderLight,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  rowIcon: {
    width: 22,
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  rowMain: {
    flex: 1,
  },
  rowLabel: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  rowLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  rowDescription: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  rowTrailingPlaceholder: {
    width: 22,
    height: 22,
  },
  navRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  navLabel: {
    fontSize: FontSize.md,
    color: Colors.textPrimary,
  },
  navTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navCount: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
  sectionGap: {
    height: Spacing.sm,
    backgroundColor: Colors.background,
  },
  cancelRow: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
