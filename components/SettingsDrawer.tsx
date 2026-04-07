import { useEffect, useRef, useState } from 'react';
import {
    Text,
    View,
    StyleSheet,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Dimensions,
    Animated,
    Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize } from '../config/styles';
import { useAuth } from '../config/auth';
import { API_ENDPOINTS, buildApiUrl } from '../config/api';

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
    const confirmSlideAnim = useRef(new Animated.Value(300)).current;
    const confirmOverlayAnim = useRef(new Animated.Value(0)).current;
    const insets = useSafeAreaInsets();
    const auth = useAuth();
    const router = useRouter();
    const [showConfirm, setShowConfirm] = useState(false);
    const [username, setUsername] = useState('');

    useEffect(() => {
        if (visible && auth.userId) {
            fetch(buildApiUrl(API_ENDPOINTS.GET_BASIC_INFO, { id: auth.userId }))
                .then(res => res.json())
                .then(result => {
                    if (result.code === 0 && result.data?.username) {
                        setUsername(result.data.username);
                    }
                })
                .catch(() => {});
        }
    }, [visible, auth.userId]);

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

    const openConfirm = () => {
        handleClose();
        setTimeout(() => {
            setShowConfirm(true);
            Animated.parallel([
                Animated.timing(confirmSlideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
                Animated.timing(confirmOverlayAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            ]).start();
        }, 260);
    };

    const closeConfirm = (callback?: () => void) => {
        Animated.parallel([
            Animated.timing(confirmSlideAnim, { toValue: 300, duration: 250, useNativeDriver: true }),
            Animated.timing(confirmOverlayAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start(() => {
            setShowConfirm(false);
            callback?.();
        });
    };

    const handleSwitchAccount = () => {
        handleClose();
        setTimeout(() => router.push('/switch-account'), 260);
    };

    const handleLogout = () => {
        closeConfirm(async () => {
            await auth.logout();
            try { router.dismissAll(); } catch {}
            router.replace('/(tabs)');
        });
    };

    return (
        <>
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
                                <DrawerMenuItem icon="log-out-outline" label="退出登录" onPress={openConfirm} />
                            </View>
                        </View>
                    </Animated.View>
                </View>
            </Modal>

            <Modal visible={showConfirm} transparent animationType="none" statusBarTranslucent onRequestClose={() => closeConfirm()}>
                <View style={styles.confirmContainer}>
                    <TouchableWithoutFeedback onPress={() => closeConfirm()}>
                        <Animated.View style={[styles.overlay, { opacity: confirmOverlayAnim }]} />
                    </TouchableWithoutFeedback>
                    <Animated.View style={[styles.confirmPanel, { paddingBottom: insets.bottom + Spacing.xl, transform: [{ translateY: confirmSlideAnim }] }]}>
                        <View style={styles.confirmHandle} />
                        <Text style={styles.confirmTitle}>
                            确认退出该账号 @{username || '未知用户'} 吗？
                        </Text>
                        <View style={styles.confirmButtons}>
                            <TouchableOpacity
                                style={[styles.confirmBtn, styles.confirmBtnSwitch]}
                                activeOpacity={0.6}
                                onPress={() => closeConfirm(() => router.push('/switch-account'))}
                            >
                                <Text style={styles.confirmBtnSwitchText}>切换账号</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.confirmBtn, styles.confirmBtnLogout]}
                                activeOpacity={0.6}
                                onPress={handleLogout}
                            >
                                <Text style={styles.confirmBtnLogoutText}>退出登录</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </>
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
    confirmContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    confirmPanel: {
        backgroundColor: Colors.backgroundWhite,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.md,
    },
    confirmHandle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.borderDark,
        alignSelf: 'center',
        marginBottom: Spacing.xl,
    },
    confirmTitle: {
        fontSize: FontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
        textAlign: 'center',
        marginBottom: Spacing.xxl,
    },
    confirmButtons: {
        gap: Spacing.sm,
    },
    confirmBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md + 2,
        borderRadius: 12,
    },
    confirmBtnSwitch: {
        backgroundColor: Colors.backgroundGray,
    },
    confirmBtnSwitchText: {
        fontSize: FontSize.md,
        fontWeight: '500',
        color: Colors.textPrimary,
    },
    confirmBtnLogout: {
        backgroundColor: Colors.backgroundGray,
    },
    confirmBtnLogoutText: {
        fontSize: FontSize.md,
        fontWeight: '500',
        color: Colors.error,
    },
});
