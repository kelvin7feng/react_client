import { useState, useRef, useEffect, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    SafeAreaView, Alert, KeyboardAvoidingView, Platform,
    Modal, Animated, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import { Colors, Spacing, FontSize } from '../config/styles';
import { useAuth } from '../config/auth';

type ViewState = 'main' | 'phone';

export default function LoginScreen() {
    const router = useRouter();
    const auth = useAuth();

    const [view, setView] = useState<ViewState>('main');
    const [agreed, setAgreed] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const modalAnim = useRef(new Animated.Value(0)).current;

    const [mobile, setMobile] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [usePassword, setUsePassword] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [loading, setLoading] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, []);

    const checkAgreement = useCallback(() => {
        if (!agreed) {
            Alert.alert('提示', '请先阅读并同意相关协议');
            return false;
        }
        return true;
    }, [agreed]);

    const startCountdown = () => {
        setCountdown(60);
        timerRef.current = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
                return prev - 1;
            });
        }, 1000);
    };

    const handleSendCode = async () => {
        if (!mobile.trim() || mobile.trim().length < 11) {
            Alert.alert('提示', '请输入正确的手机号');
            return;
        }
        try {
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.SEND_CODE}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mobile: mobile.trim() }),
            });
            const result = await response.json();
            if (result.code === 0) {
                startCountdown();
                if (result.data?.code) {
                    Alert.alert('验证码', `您的验证码是：${result.data.code}`);
                }
            } else {
                Alert.alert('失败', result.msg);
            }
        } catch {
            Alert.alert('失败', '网络错误');
        }
    };

    const handlePhoneLogin = async () => {
        if (!checkAgreement()) return;
        if (!mobile.trim()) { Alert.alert('提示', '请输入手机号'); return; }
        setLoading(true);
        try {
            const body: any = { mobile: mobile.trim() };
            if (usePassword) body.password = password;
            else body.code = code;

            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.LOGIN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const result = await response.json();
            if (result.code === 0) {
                await auth.login(result.data.user_id, result.data.token);
                router.back();
            } else {
                Alert.alert('失败', result.msg);
            }
        } catch {
            Alert.alert('失败', '网络错误');
        } finally { setLoading(false); }
    };

    const openModal = () => {
        setModalVisible(true);
        Animated.spring(modalAnim, {
            toValue: 1, useNativeDriver: true, tension: 65, friction: 11,
        }).start();
    };

    const closeModal = (cb?: () => void) => {
        Animated.timing(modalAnim, {
            toValue: 0, duration: 150, useNativeDriver: true,
        }).start(() => { setModalVisible(false); cb?.(); });
    };

    const handleOneClickLogin = () => {
        if (!checkAgreement()) return;
        Alert.alert('提示', '一键登录需要运营商 SDK 集成，请使用手机号登录', [
            { text: '去登录', onPress: () => setView('phone') },
            { text: '取消', style: 'cancel' },
        ]);
    };

    const handleSocialLogin = (platform: string) => {
        if (!checkAgreement()) return;
        Alert.alert('提示', `${platform}登录功能开发中`);
    };

    const showAgreement = (title: string) => {
        Alert.alert(title, `${title}内容正在完善中，敬请期待。`);
    };

    const AgreementRow = ({ value, onToggle }: { value: boolean; onToggle: () => void }) => (
        <View style={s.agreementRow}>
            <TouchableOpacity onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons
                    name={value ? 'checkbox' : 'square-outline'}
                    size={16}
                    color={value ? Colors.primary : Colors.textTertiary}
                />
            </TouchableOpacity>
            <Text style={s.agreementText}>
                我已阅读并同意
                <Text style={s.agreementLink} onPress={() => showAgreement('用户协议')}>《用户协议》</Text>
                <Text style={s.agreementLink} onPress={() => showAgreement('隐私政策')}>《隐私政策》</Text>
                {'\n'}
                <Text style={s.agreementLink} onPress={() => showAgreement('未成年人个人信息保护规则')}>《未成年人个人信息保护规则》</Text>
            </Text>
        </View>
    );

    // ─── Phone Login View ──────────────────────────────────────────
    if (view === 'phone') {
        return (
            <SafeAreaView style={s.container}>
                <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={s.phoneHeader}>
                        <TouchableOpacity onPress={() => setView('main')} style={s.backBtn}>
                            <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
                        </TouchableOpacity>
                        <Text style={s.phoneHeaderTitle}>手机号登录</Text>
                        <View style={s.backBtn} />
                    </View>

                    <ScrollView style={s.flex} contentContainerStyle={s.phoneContent} keyboardShouldPersistTaps="handled">
                        <Text style={s.phoneSubtitle}>未注册的手机号将自动创建账号</Text>

                        <View style={s.inputGroup}>
                            <View style={s.inputRow}>
                                <Text style={s.inputPrefix}>+86</Text>
                                <View style={s.inputDivider} />
                                <TextInput
                                    style={s.phoneInput}
                                    placeholder="请输入手机号"
                                    placeholderTextColor={Colors.textTertiary}
                                    value={mobile}
                                    onChangeText={setMobile}
                                    keyboardType="phone-pad"
                                    maxLength={11}
                                />
                                {mobile.length > 0 && (
                                    <TouchableOpacity onPress={() => setMobile('')}>
                                        <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            {usePassword ? (
                                <View style={s.inputRow}>
                                    <Ionicons name="lock-closed-outline" size={18} color={Colors.textTertiary} />
                                    <TextInput
                                        style={[s.phoneInput, { marginLeft: Spacing.sm }]}
                                        placeholder="请输入密码"
                                        placeholderTextColor={Colors.textTertiary}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                    />
                                </View>
                            ) : (
                                mobile.length >= 11 && (
                                    <View style={s.inputRow}>
                                        <TextInput
                                            style={s.phoneInput}
                                            placeholder="请输入验证码"
                                            placeholderTextColor={Colors.textTertiary}
                                            value={code}
                                            onChangeText={setCode}
                                            keyboardType="number-pad"
                                            maxLength={6}
                                        />
                                        <TouchableOpacity
                                            style={[s.codeBtn, countdown > 0 && s.codeBtnDisabled]}
                                            onPress={handleSendCode}
                                            disabled={countdown > 0}
                                        >
                                            <Text style={[s.codeBtnText, countdown > 0 && s.codeBtnTextDisabled]}>
                                                {countdown > 0 ? `${countdown}s` : '获取验证码'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )
                            )}

                        </View>

                        <TouchableOpacity onPress={() => setUsePassword(!usePassword)}>
                            <Text style={s.toggleMode}>
                                {usePassword ? '使用验证码登录' : '使用密码登录'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[s.loginBtn, loading && { opacity: 0.6 }]}
                            onPress={handlePhoneLogin}
                            disabled={loading}
                        >
                            <Text style={s.loginBtnText}>
                                {loading ? '处理中...' : '登录'}
                            </Text>
                        </TouchableOpacity>

                        <View style={{ marginTop: Spacing.xxl }}>
                            <AgreementRow value={agreed} onToggle={() => setAgreed(!agreed)} />
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        );
    }

    // ─── Main Login View ───────────────────────────────────────────
    return (
        <SafeAreaView style={s.container}>
            <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
                <Ionicons name="close" size={26} color={Colors.textPrimary} />
            </TouchableOpacity>

            <View style={s.mainContent}>
                {/* Logo */}
                <View style={s.logoSection}>
                    <View style={s.logoBox}>
                        <Ionicons name="bicycle" size={40} color={Colors.white} />
                    </View>
                    <Text style={s.logoText}>小电驴</Text>
                </View>

                {/* 一键登录区域 */}
                <View style={s.quickLoginSection}>
                    <Text style={s.quickLoginHint}>本机号码一键登录</Text>
                    <TouchableOpacity style={s.primaryBtn} onPress={handleOneClickLogin} activeOpacity={0.8}>
                        <Text style={s.primaryBtnText}>一键登录</Text>
                    </TouchableOpacity>
                </View>

                {/* 第三方登录 */}
                <View style={s.socialSection}>
                    <View style={s.socialBtns}>
                        <TouchableOpacity
                            style={s.socialBtn}
                            onPress={() => handleSocialLogin('微信')}
                        >
                            <View style={[s.socialIconCircle, { backgroundColor: '#07C160' }]}>
                                <Ionicons name="logo-wechat" size={24} color="#fff" />
                            </View>
                            <Text style={s.socialLabel}>微信登录</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={s.socialBtn}
                            onPress={() => handleSocialLogin('QQ')}
                        >
                            <View style={[s.socialIconCircle, { backgroundColor: '#12B7F5' }]}>
                                <FontAwesome name="qq" size={22} color="#fff" />
                            </View>
                            <Text style={s.socialLabel}>QQ登录</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 其他登录方式 */}
                <TouchableOpacity onPress={openModal} style={s.otherMethodsBtn}>
                    <Text style={s.otherMethodsText}>其他登录方式</Text>
                    <Ionicons name="chevron-forward" size={14} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* 底部协议 */}
            <View style={s.bottomAgreement}>
                <AgreementRow value={agreed} onToggle={() => setAgreed(!agreed)} />
            </View>

            {/* 其他登录方式 Modal */}
            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => closeModal()}>
                <View style={s.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => closeModal()} />
                    <Animated.View style={[
                        s.modalSheet,
                        { transform: [{ translateY: modalAnim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] },
                    ]}>
                        <View style={s.modalHandle} />
                        <Text style={s.modalTitle}>选择登录方式</Text>

                        <TouchableOpacity
                            style={s.modalOption}
                            onPress={() => closeModal(() => setView('phone'))}
                        >
                            <View style={[s.modalOptionIcon, { backgroundColor: Colors.primary }]}>
                                <Ionicons name="phone-portrait-outline" size={20} color="#fff" />
                            </View>
                            <Text style={s.modalOptionText}>手机号登录</Text>
                            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={s.modalOption}
                            onPress={() => closeModal(() => handleSocialLogin('QQ'))}
                        >
                            <View style={[s.modalOptionIcon, { backgroundColor: '#12B7F5' }]}>
                                <FontAwesome name="qq" size={18} color="#fff" />
                            </View>
                            <Text style={s.modalOptionText}>QQ登录</Text>
                            <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                        </TouchableOpacity>

                        {Platform.OS === 'ios' && (
                            <TouchableOpacity
                                style={s.modalOption}
                                onPress={() => closeModal(() => handleSocialLogin('Apple'))}
                            >
                                <View style={[s.modalOptionIcon, { backgroundColor: '#000' }]}>
                                    <Ionicons name="logo-apple" size={20} color="#fff" />
                                </View>
                                <Text style={s.modalOptionText}>Apple 账号登录</Text>
                                <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
                            </TouchableOpacity>
                        )}

                        <View style={s.modalAgreement}>
                            <AgreementRow value={agreed} onToggle={() => setAgreed(!agreed)} />
                        </View>

                        <TouchableOpacity style={s.modalCancelBtn} onPress={() => closeModal()}>
                            <Text style={s.modalCancelText}>取消</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundWhite },
    flex: { flex: 1 },

    // Close button
    closeBtn: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 16, left: 16, zIndex: 10, padding: 4 },

    // Main content
    mainContent: { flex: 1, paddingHorizontal: 32, justifyContent: 'center' },

    // Logo
    logoSection: { alignItems: 'center', marginBottom: 48 },
    logoBox: {
        width: 72, height: 72, borderRadius: 20, backgroundColor: Colors.primary,
        justifyContent: 'center', alignItems: 'center', marginBottom: 12,
    },
    logoText: { fontSize: 28, fontWeight: 'bold', color: Colors.textPrimary, letterSpacing: 4 },

    // Quick login
    quickLoginSection: { alignItems: 'center', marginBottom: 36 },
    quickLoginHint: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16 },
    primaryBtn: {
        width: '100%', backgroundColor: Colors.primary, borderRadius: 24,
        paddingVertical: 14, alignItems: 'center',
    },
    primaryBtnText: { color: Colors.white, fontSize: 17, fontWeight: '600' },

    // Social login
    socialSection: { marginBottom: 28 },
    socialBtns: { flexDirection: 'row', justifyContent: 'center' },
    socialBtn: { alignItems: 'center', marginHorizontal: 24 },
    socialIconCircle: {
        width: 48, height: 48, borderRadius: 24,
        justifyContent: 'center', alignItems: 'center', marginBottom: 6,
    },
    socialLabel: { fontSize: 11, color: Colors.textSecondary },

    // Other methods
    otherMethodsBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8 },
    otherMethodsText: { fontSize: 13, color: Colors.textSecondary, marginRight: 2 },

    // Bottom agreement
    bottomAgreement: { paddingHorizontal: 32, paddingBottom: Platform.OS === 'ios' ? 28 : 16 },

    // Agreement
    agreementRow: { flexDirection: 'row', alignItems: 'flex-start' },
    agreementText: { flex: 1, fontSize: 11, color: Colors.textTertiary, lineHeight: 18, marginLeft: 6 },
    agreementLink: { color: '#4A90D9' },

    // ─── Phone Login View ────────────────────────────────
    phoneHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm + 2,
    },
    backBtn: { width: 40, alignItems: 'center' },
    phoneHeaderTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary },
    phoneContent: { paddingHorizontal: 28, paddingTop: 20 },
    phoneSubtitle: { fontSize: 13, color: Colors.textSecondary, marginBottom: 28 },

    inputGroup: { marginBottom: 12 },
    inputRow: {
        flexDirection: 'row', alignItems: 'center',
        borderBottomWidth: 1, borderBottomColor: Colors.border,
        paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    },
    inputPrefix: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary, width: 40 },
    inputDivider: { width: 1, height: 16, backgroundColor: Colors.border, marginHorizontal: 10 },
    phoneInput: { flex: 1, fontSize: 16, color: Colors.textPrimary, padding: 0 },

    codeBtn: {
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 4,
        borderWidth: 1, borderColor: Colors.primary,
    },
    codeBtnDisabled: { borderColor: Colors.border },
    codeBtnText: { fontSize: 13, color: Colors.primary },
    codeBtnTextDisabled: { color: Colors.textTertiary },

    toggleMode: { fontSize: 13, color: Colors.primary, marginTop: 4, marginBottom: 24 },

    loginBtn: {
        backgroundColor: Colors.primary, borderRadius: 24,
        paddingVertical: 14, alignItems: 'center',
    },
    loginBtnText: { color: Colors.white, fontSize: 17, fontWeight: '600' },

    // ─── Modal ───────────────────────────────────────────
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: {
        backgroundColor: Colors.backgroundWhite,
        borderTopLeftRadius: 16, borderTopRightRadius: 16,
        paddingTop: Spacing.sm, paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    },
    modalHandle: {
        width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.borderDark,
        alignSelf: 'center', marginBottom: Spacing.md,
    },
    modalTitle: {
        fontSize: 16, fontWeight: '600', color: Colors.textPrimary,
        textAlign: 'center', marginBottom: 20,
    },
    modalOption: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 24, paddingVertical: 14,
    },
    modalOptionIcon: {
        width: 40, height: 40, borderRadius: 20,
        justifyContent: 'center', alignItems: 'center', marginRight: 14,
    },
    modalOptionText: { flex: 1, fontSize: 15, color: Colors.textPrimary },
    modalAgreement: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
    modalCancelBtn: {
        marginHorizontal: 24, marginTop: 8, paddingVertical: 12,
        borderRadius: 8, backgroundColor: Colors.backgroundGray, alignItems: 'center',
    },
    modalCancelText: { fontSize: 15, color: Colors.textPrimary },
});
