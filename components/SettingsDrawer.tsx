import { useEffect, useRef } from 'react';
import {
    Text,
    View,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Dimensions,
    Animated,
    Modal,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize } from '../config/styles';
import { useAuth } from '../config/auth';

const DRAWER_WIDTH = Dimensions.get('window').width * 0.75;

const DrawerMenuItem = ({ icon, label, onPress, color }: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    label: string;
    onPress: () => void;
    color?: string;
}) => (
    <TouchableOpacity style={styles.menuItem} activeOpacity={0.6} onPress={onPress}>
        <Ionicons name={icon} size={20} color={color || Colors.textPrimary} />
        <Text style={[styles.menuLabel, color ? { color } : undefined]}>{label}</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
    </TouchableOpacity>
);

export function SettingsDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const overlayAnim = useRef(new Animated.Value(0)).current;
    const insets = useSafeAreaInsets();
    const auth = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
                Animated.timing(overlayAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
            ]).start();
        } else {
            slideAnim.setValue(-DRAWER_WIDTH);
            overlayAnim.setValue(0);
        }
    }, [visible]);

    const handleClose = () => {
        Animated.parallel([
            Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 240, useNativeDriver: true }),
            Animated.timing(overlayAnim, { toValue: 0, duration: 240, useNativeDriver: true }),
        ]).start(() => onClose());
    };

    const handleLogout = () => {
        handleClose();
        setTimeout(() => {
            Alert.alert('退出登录', '确定要退出当前账号吗？', [
                { text: '取消', style: 'cancel' },
                {
                    text: '退出', style: 'destructive',
                    onPress: async () => {
                        await auth.logout();
                        router.dismissAll();
                        router.replace('/(tabs)');
                    },
                },
            ]);
        }, 260);
    };

    const handleSwitchAccount = () => {
        handleClose();
        setTimeout(() => {
            Alert.alert('切换账号', '退出当前账号并重新登录？', [
                { text: '取消', style: 'cancel' },
                {
                    text: '确定',
                    onPress: async () => {
                        await auth.logout();
                        router.dismissAll();
                        router.replace('/login');
                    },
                },
            ]);
        }, 260);
    };

    return (
        <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
            <View style={styles.overlayContainer}>
                <TouchableWithoutFeedback onPress={handleClose}>
                    <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
                </TouchableWithoutFeedback>
                <Animated.View style={[styles.panel, { width: DRAWER_WIDTH, transform: [{ translateX: slideAnim }] }]}>
                    <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
                        <Text style={styles.title}>设置</Text>

                        <View style={styles.section}>
                            <DrawerMenuItem icon="settings-outline" label="通用设置" onPress={handleClose} />
                            <View style={styles.divider} />
                            <DrawerMenuItem icon="notifications-outline" label="通知设置" onPress={handleClose} />
                        </View>

                        <View style={styles.section}>
                            <DrawerMenuItem icon="help-circle-outline" label="帮助与客服" onPress={handleClose} />
                            <View style={styles.divider} />
                            <DrawerMenuItem icon="information-circle-outline" label="关于小电驴" onPress={handleClose} />
                        </View>

                        <View style={{ flex: 1 }} />

                        <View style={[styles.section, { marginBottom: insets.bottom + Spacing.xl }]}>
                            <DrawerMenuItem icon="swap-horizontal-outline" label="切换账号" onPress={handleSwitchAccount} />
                            <View style={styles.divider} />
                            <DrawerMenuItem icon="log-out-outline" label="退出登录" onPress={handleLogout} color={Colors.error} />
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlayContainer: { flex: 1, flexDirection: 'row' },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    panel: {
        height: '100%',
        backgroundColor: Colors.backgroundWhite,
        shadowColor: Colors.shadow,
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 20,
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
    },
    title: {
        fontSize: FontSize.xl + 2,
        fontWeight: 'bold',
        color: Colors.textPrimary,
        marginBottom: Spacing.xl,
    },
    section: {
        backgroundColor: Colors.backgroundGray,
        borderRadius: 12,
        marginBottom: Spacing.md,
        overflow: 'hidden',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.md + 2,
        paddingHorizontal: Spacing.md,
    },
    menuLabel: {
        flex: 1,
        fontSize: FontSize.md,
        color: Colors.textPrimary,
        marginLeft: Spacing.md,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.borderDark,
        marginLeft: Spacing.md + 20 + Spacing.md,
    },
});
