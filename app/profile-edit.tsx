import { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Animated,
    Alert, Modal, Dimensions, Pressable, NativeSyntheticEvent, NativeScrollEvent,
    KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler, PinchGestureHandlerGestureEvent, PanGestureHandlerGestureEvent, State } from 'react-native-gesture-handler';
import { Image } from 'expo-image';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { updateProfile } from '@/features/profile/api';
import { useBasicInfo } from '@/features/profile/hooks';
import { queryKeys } from '@/shared/query/keys';
import { LoadingStateView } from '@/components/LoadingStateView';
import { AlbumPicker } from '@/components/AlbumPicker';
import { Colors, Spacing, FontSize } from '../config/styles';
import { useAuth } from '../config/auth';
import { COUNTRIES, PROVINCES, CITIES, OCCUPATIONS, SCHOOLS } from '../config/profile-options';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BG_PREVIEW_HEIGHT = Math.round(SCREEN_WIDTH * 0.85);
const LABEL_WIDTH = 72;

const WHEEL_ITEM_H = 44;
const WHEEL_VISIBLE = 5;
const WHEEL_HEIGHT = WHEEL_ITEM_H * WHEEL_VISIBLE;

const THIS_YEAR = new Date().getFullYear();
const YEAR_START = 1950;
const YEARS = Array.from({ length: THIS_YEAR - YEAR_START + 1 }, (_, i) => YEAR_START + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const SCHOOL_YEAR_START = 1976;
const SCHOOL_YEARS = Array.from({ length: THIS_YEAR - SCHOOL_YEAR_START + 1 }, (_, i) => SCHOOL_YEAR_START + i);

function getDaysInMonth(year: number, month: number) {
    return new Date(year, month, 0).getDate();
}
function buildDays(year: number, month: number) {
    return Array.from({ length: getDaysInMonth(year, month) }, (_, i) => i + 1);
}

// ─── 滚轮列（文字标签版）──────────────────────────────────────────────────────
function WheelColumn({ labels, selectedIndex, onIndexChange }: {
    labels: string[];
    selectedIndex: number;
    onIndexChange: (index: number) => void;
}) {
    const ref = useRef<ScrollView>(null);
    const current = useRef(selectedIndex);

    useEffect(() => {
        setTimeout(() => {
            ref.current?.scrollTo({ y: selectedIndex * WHEEL_ITEM_H, animated: false });
            current.current = selectedIndex;
        }, 50);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (current.current !== selectedIndex) {
            current.current = selectedIndex;
            ref.current?.scrollTo({ y: selectedIndex * WHEEL_ITEM_H, animated: true });
        }
    }, [selectedIndex]);

    const handleEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const idx = Math.round(e.nativeEvent.contentOffset.y / WHEEL_ITEM_H);
        const clamped = Math.max(0, Math.min(idx, labels.length - 1));
        current.current = clamped;
        if (clamped !== selectedIndex) onIndexChange(clamped);
    }, [labels.length, selectedIndex, onIndexChange]);

    return (
        <ScrollView
            ref={ref}
            style={{ height: WHEEL_HEIGHT, flex: 1 }}
            showsVerticalScrollIndicator={false}
            snapToInterval={WHEEL_ITEM_H}
            decelerationRate="fast"
            nestedScrollEnabled
            onMomentumScrollEnd={handleEnd}
            contentContainerStyle={{ paddingVertical: WHEEL_ITEM_H * 2 }}
        >
            {labels.map((label, i) => (
                <View key={`${label}-${i}`} style={wheelStyles.item}>
                    <Text style={wheelStyles.itemText} numberOfLines={1}>{label}</Text>
                </View>
            ))}
        </ScrollView>
    );
}

const wheelStyles = StyleSheet.create({
    item: { height: WHEEL_ITEM_H, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    itemText: { fontSize: FontSize.md, color: Colors.textPrimary },
});

// ─── 主页面 ──────────────────────────────────────────────────────────────────
export default function ProfileEditScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const auth = useAuth();
    const qc = useQueryClient();
    const { data: profileData, isLoading: loading } = useBasicInfo(auth.userId);

    const [saving, setSaving] = useState(false);
    const [username, setUsername] = useState('');
    const [signature, setSignature] = useState('');
    const [gender, setGender] = useState(0);
    const [birthday, setBirthday] = useState('');
    const [region, setRegion] = useState('');
    const [occupation, setOccupation] = useState('');
    const [schoolName, setSchoolName] = useState('');
    const [schoolYear, setSchoolYear] = useState(0);
    const [avatarUri, setAvatarUri] = useState('');
    const [newAvatarFile, setNewAvatarFile] = useState<any>(null);
    const [bgImageUri, setBgImageUri] = useState('');
    const [initialized, setInitialized] = useState(false);

    // Modal 开关
    const [avatarPreviewVisible, setAvatarPreviewVisible] = useState(false);
    const [genderModalVisible, setGenderModalVisible] = useState(false);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [datePickerVisible, setDatePickerVisible] = useState(false);
    const [regionModalVisible, setRegionModalVisible] = useState(false);
    const [occupationModalVisible, setOccupationModalVisible] = useState(false);
    const [schoolNameModalVisible, setSchoolNameModalVisible] = useState(false);
    const [schoolYearModalVisible, setSchoolYearModalVisible] = useState(false);
    const [albumPickerVisible, setAlbumPickerVisible] = useState(false);
    const [albumPickerTarget, setAlbumPickerTarget] = useState<'avatar' | 'bg'>('avatar');
    const [avatarCropVisible, setAvatarCropVisible] = useState(false);
    const [avatarCropUri, setAvatarCropUri] = useState('');
    const [bgPreviewVisible, setBgPreviewVisible] = useState(false);
    const [bgCropVisible, setBgCropVisible] = useState(false);
    const [bgCropUri, setBgCropUri] = useState('');

    // 头像裁剪手势
    const cropScale = useRef(new Animated.Value(1)).current;
    const cropBaseScale = useRef(1);
    const cropTransX = useRef(new Animated.Value(0)).current;
    const cropTransY = useRef(new Animated.Value(0)).current;
    const cropOffsetX = useRef(0);
    const cropOffsetY = useRef(0);

    // 背景图裁剪手势
    const bgScale = useRef(new Animated.Value(1)).current;
    const bgBaseScale = useRef(1);
    const bgTransX = useRef(new Animated.Value(0)).current;
    const bgTransY = useRef(new Animated.Value(0)).current;
    const bgOffsetX = useRef(0);
    const bgOffsetY = useRef(0);
    const [bgPinching, setBgPinching] = useState(false);

    // 轻提示
    const [toastText, setToastText] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error'>('success');
    const toastAnim = useRef(new Animated.Value(0)).current;
    const toastTimer = useRef<ReturnType<typeof setTimeout>>();
    const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
        setToastText(text);
        setToastType(type);
        toastAnim.setValue(0);
        Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => {
            Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToastText(''));
        }, 2000);
    }, [toastAnim]);

    // 文本编辑
    const [editField, setEditField] = useState<'username' | 'signature'>('username');
    const [editTempValue, setEditTempValue] = useState('');

    // 日期选择器
    const [pickerYear, setPickerYear] = useState(THIS_YEAR);
    const [pickerMonth, setPickerMonth] = useState(1);
    const [pickerDay, setPickerDay] = useState(1);

    // 地区选择器
    const [regionCountryIdx, setRegionCountryIdx] = useState(0);
    const [regionProvinceIdx, setRegionProvinceIdx] = useState(0);
    const [regionCityIdx, setRegionCityIdx] = useState(0);

    // 职业临时选中
    const [occupationTemp, setOccupationTemp] = useState('');

    // 学校
    const [schoolSearch, setSchoolSearch] = useState('');
    const [schoolTempName, setSchoolTempName] = useState('');

    useEffect(() => {
        if (!profileData || initialized) return;
        setUsername(profileData.username || '');
        setSignature(profileData.signature || '');
        setGender(profileData.gender || 0);
        setBirthday(profileData.birthday || '');
        setRegion(profileData.region || '');
        setOccupation(profileData.occupation || '');
        setSchoolName(profileData.school_name || '');
        setSchoolYear(profileData.school_year || 0);
        setAvatarUri(profileData.avatar || '');
        setBgImageUri(profileData.bg_image || '');
        setInitialized(true);
    }, [profileData, initialized]);

    useEffect(() => {
        const max = getDaysInMonth(pickerYear, pickerMonth);
        if (pickerDay > max) setPickerDay(max);
    }, [pickerYear, pickerMonth, pickerDay]);

    // 地区联动：省份变化时重置城市
    const currentCountry = COUNTRIES[regionCountryIdx] || COUNTRIES[0];
    const provinceList = PROVINCES[currentCountry] || [];
    const currentProvince = provinceList[regionProvinceIdx] || provinceList[0] || '';
    const cityList = CITIES[currentProvince] || [];

    useEffect(() => { setRegionProvinceIdx(0); }, [regionCountryIdx]);
    useEffect(() => { setRegionCityIdx(0); }, [regionProvinceIdx]);

    // ── 文本编辑 ──
    const openEditModal = (field: 'username' | 'signature') => {
        setEditField(field);
        setEditTempValue(field === 'username' ? username : signature);
        setEditModalVisible(true);
    };
    const confirmEdit = () => {
        if (editField === 'username') setUsername(editTempValue);
        else setSignature(editTempValue);
        setEditModalVisible(false);
    };

    // ── 日期选择 ──
    const openDatePicker = () => {
        if (birthday) {
            const [y, m, d] = birthday.split('-').map(Number);
            setPickerYear(y || THIS_YEAR);
            setPickerMonth(m || 1);
            setPickerDay(d || 1);
        } else {
            setPickerYear(THIS_YEAR);
            setPickerMonth(1);
            setPickerDay(1);
        }
        setDatePickerVisible(true);
    };
    const confirmDatePicker = () => {
        setBirthday(`${pickerYear}-${String(pickerMonth).padStart(2, '0')}-${String(pickerDay).padStart(2, '0')}`);
        setDatePickerVisible(false);
    };

    // ── 地区选择 ──
    const openRegionPicker = () => {
        if (region) {
            const parts = region.split(' ');
            const cIdx = Math.max(0, COUNTRIES.indexOf(parts[0] || ''));
            setRegionCountryIdx(cIdx);
            const pList = PROVINCES[COUNTRIES[cIdx]] || [];
            const pIdx = Math.max(0, pList.indexOf(parts[1] || ''));
            setRegionProvinceIdx(pIdx);
            const cList = CITIES[pList[pIdx] || ''] || [];
            setRegionCityIdx(Math.max(0, cList.indexOf(parts[2] || '')));
        } else {
            setRegionCountryIdx(0);
            setRegionProvinceIdx(0);
            setRegionCityIdx(0);
        }
        setRegionModalVisible(true);
    };
    const confirmRegion = () => {
        const c = COUNTRIES[regionCountryIdx];
        const p = provinceList[regionProvinceIdx] || '';
        const city = cityList[Math.min(regionCityIdx, cityList.length - 1)] || '';
        setRegion(`${c} ${p} ${city}`.trim());
        setRegionModalVisible(false);
    };

    // ── 学校选择 ──
    const openSchoolNameModal = () => {
        setSchoolTempName(schoolName);
        setSchoolSearch('');
        setSchoolNameModalVisible(true);
    };
    const openSchoolYearModal = () => {
        setSchoolYearModalVisible(true);
    };
    const filteredSchools = schoolSearch
        ? SCHOOLS.filter(s => s.includes(schoolSearch))
        : SCHOOLS;
    const schoolYearList = SCHOOL_YEARS.slice().reverse();

    // ── 头像 / 背景图 ──
    const openAlbumFor = (target: 'avatar' | 'bg') => {
        setAvatarPreviewVisible(false);
        setAlbumPickerTarget(target);
        setTimeout(() => setAlbumPickerVisible(true), 300);
    };
    const handleAlbumConfirm = (uris: string[]) => {
        if (uris.length === 0) return;
        setAlbumPickerVisible(false);
        if (albumPickerTarget === 'avatar') {
            setAvatarCropUri(uris[0]);
            resetCropGesture();
            setTimeout(() => setAvatarCropVisible(true), 300);
        } else {
            setBgCropUri(uris[0]);
            resetBgGesture();
            setTimeout(() => setBgCropVisible(true), 300);
        }
    };
    const resetCropGesture = () => {
        cropScale.setValue(1);
        cropBaseScale.current = 1;
        cropTransX.setValue(0);
        cropTransY.setValue(0);
        cropOffsetX.current = 0;
        cropOffsetY.current = 0;
    };
    const onCropPinch = (e: PinchGestureHandlerGestureEvent) => {
        if (e.nativeEvent.state === State.ACTIVE) {
            const newScale = Math.max(1, Math.min(cropBaseScale.current * e.nativeEvent.scale, 4));
            cropScale.setValue(newScale);
        }
    };
    const onCropPinchEnd = (e: PinchGestureHandlerGestureEvent) => {
        if (e.nativeEvent.state === State.END) {
            cropBaseScale.current = Math.max(1, Math.min(cropBaseScale.current * e.nativeEvent.scale, 4));
            cropScale.setValue(cropBaseScale.current);
        }
    };
    const onCropPan = (e: PanGestureHandlerGestureEvent) => {
        if (e.nativeEvent.state === State.ACTIVE) {
            cropTransX.setValue(cropOffsetX.current + e.nativeEvent.translationX);
            cropTransY.setValue(cropOffsetY.current + e.nativeEvent.translationY);
        }
    };
    const onCropPanEnd = (e: PanGestureHandlerGestureEvent) => {
        if (e.nativeEvent.state === State.END) {
            cropOffsetX.current += e.nativeEvent.translationX;
            cropOffsetY.current += e.nativeEvent.translationY;
        }
    };
    const confirmAvatarCrop = () => {
        setAvatarUri(avatarCropUri);
        setNewAvatarFile({ uri: avatarCropUri });
        setAvatarCropVisible(false);
        resetCropGesture();
    };

    const resetBgGesture = () => {
        bgScale.setValue(1);
        bgBaseScale.current = 1;
        bgTransX.setValue(0);
        bgTransY.setValue(0);
        bgOffsetX.current = 0;
        bgOffsetY.current = 0;
        setBgPinching(false);
    };
    const onBgPinch = (e: PinchGestureHandlerGestureEvent) => {
        if (e.nativeEvent.state === State.ACTIVE) {
            setBgPinching(true);
            const s = Math.max(1, Math.min(bgBaseScale.current * e.nativeEvent.scale, 4));
            bgScale.setValue(s);
        }
    };
    const onBgPinchEnd = (e: PinchGestureHandlerGestureEvent) => {
        if (e.nativeEvent.state === State.END) {
            bgBaseScale.current = Math.max(1, Math.min(bgBaseScale.current * e.nativeEvent.scale, 4));
            bgScale.setValue(bgBaseScale.current);
            setBgPinching(false);
        }
    };
    const onBgPan = (e: PanGestureHandlerGestureEvent) => {
        if (e.nativeEvent.state === State.ACTIVE) {
            bgTransX.setValue(bgOffsetX.current + e.nativeEvent.translationX);
            bgTransY.setValue(bgOffsetY.current + e.nativeEvent.translationY);
        }
    };
    const onBgPanEnd = (e: PanGestureHandlerGestureEvent) => {
        if (e.nativeEvent.state === State.END) {
            bgOffsetX.current += e.nativeEvent.translationX;
            bgOffsetY.current += e.nativeEvent.translationY;
        }
    };

    // ── 保存 ──
    const handleSave = async () => {
        if (!username.trim()) { Alert.alert('提示', '昵称不能为空'); return; }
        setSaving(true);
        try {
            const result = await updateProfile({
                username, signature, gender, birthday, region, occupation,
                schoolName, schoolYear,
                avatarFile: newAvatarFile ? { uri: newAvatarFile.uri, name: 'avatar.jpg', type: 'image/jpeg' } : null,
                bgImageFile: bgImageUri && bgImageUri.startsWith('file://') ? { uri: bgImageUri, name: 'bg.jpg', type: 'image/jpeg' } : null,
            });
            const newAvatar = result?.avatar || avatarUri;
            setNewAvatarFile(null);
            if (result?.bg_image) Image.prefetch(result.bg_image);
            if (newAvatar) Image.prefetch(newAvatar);
            await auth.saveAccountInfo({ userId: auth.userId!, username: username.trim(), avatar: newAvatar });
            qc.invalidateQueries({ queryKey: queryKeys.basicInfo(auth.userId) });
            qc.invalidateQueries({ queryKey: queryKeys.myHome(auth.userId) });
            showToast('资料已更新');
        } catch (error) {
            showToast(error instanceof Error ? error.message : '保存失败', 'error');
        } finally { setSaving(false); }
    };

    if (loading) {
        return (
            <View style={s.container}>
                <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
                    <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>编辑资料</Text>
                    <View style={s.backBtn} />
                </View>
                <LoadingStateView style={s.loadingCenter} size={24} color={Colors.textTertiary} />
            </View>
        );
    }

    const days = buildDays(pickerYear, pickerMonth);

    return (
        <View style={s.container}>
            <View style={[s.header, { paddingTop: insets.top + Spacing.sm }]}>
                <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                    <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={s.headerTitle}>编辑资料</Text>
                <TouchableOpacity onPress={handleSave} disabled={saving} style={s.saveHeaderBtn}>
                    <Text style={[s.saveHeaderText, saving && { opacity: 0.5 }]}>
                        {saving ? '保存中...' : '保存'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
                {/* 头像 */}
                <TouchableOpacity style={s.avatarWrapper} activeOpacity={0.8} onPress={() => setAvatarPreviewVisible(true)}>
                    <Image source={{ uri: avatarUri || 'https://picsum.photos/200/200' }} style={s.avatar} />
                    <View style={s.cameraIconBadge}>
                        <Ionicons name="camera" size={12} color={Colors.white} />
                    </View>
                </TouchableOpacity>

                {/* 账号区 */}
                <View style={s.section}>
                    <TouchableOpacity style={s.row} onPress={() => openEditModal('username')}>
                        <Text style={s.rowLabel}>名字</Text>
                        <Text style={username ? s.rowValueLeft : s.rowPlaceholder}>{username || '输入昵称'}</Text>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                    <View style={s.rowDivider} />
                    <View style={s.row}>
                        <Text style={s.rowLabel}>ID</Text>
                        <Text style={s.rowValue}>{profileData?.id || ''}</Text>
                    </View>
                    <View style={s.rowDivider} />
                    <TouchableOpacity style={s.row} onPress={() => bgImageUri ? setBgPreviewVisible(true) : openAlbumFor('bg')}>
                        <Text style={s.rowLabel}>背景图</Text>
                        <View style={s.bgThumbArea}>
                            {bgImageUri ? (
                                <Image source={{ uri: bgImageUri }} style={s.bgThumb} cachePolicy="memory-disk" />
                            ) : (
                                <View style={s.bgThumbPlaceholder}>
                                    <Ionicons name="image-outline" size={18} color="#7B68EE" />
                                </View>
                            )}
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                </View>

                {/* 简介 */}
                <View style={s.section}>
                    <TouchableOpacity style={s.row} onPress={() => openEditModal('signature')}>
                        <Text style={s.rowLabel}>签名</Text>
                        <Text style={signature ? s.rowValueLeft : s.rowPlaceholder} numberOfLines={1}>
                            {signature || '写点什么介绍自己'}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                </View>

                {/* 个人信息 */}
                <View style={s.section}>
                    <TouchableOpacity style={s.row} onPress={() => setGenderModalVisible(true)}>
                        <Text style={s.rowLabel}>性别</Text>
                        <Text style={s.rowValueLeft}>{gender === 1 ? '男' : gender === 2 ? '女' : '保密'}</Text>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                    <View style={s.rowDivider} />

                    <TouchableOpacity style={s.row} onPress={openDatePicker}>
                        <Text style={s.rowLabel}>生日</Text>
                        <Text style={birthday ? s.rowValueLeft : s.rowPlaceholder}>{birthday || '选择生日'}</Text>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                    <View style={s.rowDivider} />

                    <TouchableOpacity style={s.row} onPress={openRegionPicker}>
                        <Text style={s.rowLabel}>地区</Text>
                        <Text style={region ? s.rowValueLeft : s.rowPlaceholder} numberOfLines={1}>{region || '选择地区'}</Text>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                    <View style={s.rowDivider} />

                    <TouchableOpacity style={s.row} onPress={() => { setOccupationTemp(occupation); setOccupationModalVisible(true); }}>
                        <Text style={s.rowLabel}>职业</Text>
                        <Text style={occupation ? s.rowValueLeft : s.rowPlaceholder}>{occupation || '选择职业'}</Text>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                    <View style={s.rowDivider} />

                </View>

                {/* 学校区 */}
                <View style={s.section}>
                    <TouchableOpacity style={s.row} onPress={openSchoolNameModal}>
                        <Text style={s.rowLabel}>学校</Text>
                        <Text style={schoolName ? s.rowValueLeft : s.rowPlaceholder} numberOfLines={1}>
                            {schoolName || '选择学校'}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                    <View style={s.rowDivider} />
                    <TouchableOpacity style={s.row} onPress={openSchoolYearModal}>
                        <Text style={s.rowLabel}>入学年份</Text>
                        <Text style={schoolYear ? s.rowValueLeft : s.rowPlaceholder}>
                            {schoolYear ? `${schoolYear}年` : '选择年份'}
                        </Text>
                        <Ionicons name="chevron-forward" size={16} color={Colors.textTertiary} />
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* ════════ 全屏头像预览 ════════ */}
            <Modal visible={avatarPreviewVisible} transparent animationType="fade"
                onRequestClose={() => setAvatarPreviewVisible(false)}>
                <View style={s.previewContainer}>
                    <TouchableOpacity style={[s.previewCloseBtn, { top: insets.top + Spacing.sm }]}
                        onPress={() => setAvatarPreviewVisible(false)}>
                        <Ionicons name="close" size={24} color={Colors.white} />
                    </TouchableOpacity>
                    <Pressable style={s.previewImageArea} onPress={() => setAvatarPreviewVisible(false)}>
                        <Image source={{ uri: avatarUri || 'https://picsum.photos/200/200' }}
                            style={s.previewImage} contentFit="cover" />
                        <View style={s.circleMask} pointerEvents="none" />
                    </Pressable>
                    <View style={[s.previewBottomBar, { paddingBottom: insets.bottom + Spacing.lg }]}>
                        <TouchableOpacity style={s.previewActionBtn} onPress={() => openAlbumFor('avatar')}>
                            <Ionicons name="images-outline" size={22} color={Colors.white} />
                            <Text style={s.previewActionText}>从相册选择</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ════════ 头像裁剪预览（支持缩放拖拽）════════ */}
            <Modal visible={avatarCropVisible} transparent animationType="fade"
                onRequestClose={() => { setAvatarCropVisible(false); resetCropGesture(); }}>
                <GestureHandlerRootView style={s.previewContainer}>
                    <TouchableOpacity style={[s.previewCloseBtn, { top: insets.top + Spacing.sm }]}
                        onPress={() => { setAvatarCropVisible(false); resetCropGesture(); }}>
                        <Ionicons name="close" size={24} color={Colors.white} />
                    </TouchableOpacity>
                    <View style={s.previewImageArea}>
                        <PanGestureHandler onGestureEvent={onCropPan} onHandlerStateChange={onCropPanEnd}
                            minPointers={1} maxPointers={2}>
                            <Animated.View>
                                <PinchGestureHandler onGestureEvent={onCropPinch} onHandlerStateChange={onCropPinchEnd}>
                                    <Animated.View style={{
                                        transform: [
                                            { scale: cropScale },
                                            { translateX: cropTransX },
                                            { translateY: cropTransY },
                                        ],
                                    }}>
                                        <Image source={{ uri: avatarCropUri }}
                                            style={s.previewImage} contentFit="cover" />
                                    </Animated.View>
                                </PinchGestureHandler>
                            </Animated.View>
                        </PanGestureHandler>
                        <View style={s.circleMask} pointerEvents="none" />
                    </View>
                    <View style={[s.previewBottomBar, { paddingBottom: insets.bottom + Spacing.lg }]}>
                        <TouchableOpacity style={s.previewActionBtn}
                            onPress={() => { setAvatarCropVisible(false); resetCropGesture(); }}>
                            <Text style={s.previewActionText}>取消</Text>
                        </TouchableOpacity>
                        <View style={{ width: Spacing.xxl }} />
                        <TouchableOpacity style={[s.previewActionBtn, s.previewConfirmBtn]} onPress={confirmAvatarCrop}>
                            <Ionicons name="checkmark" size={22} color={Colors.white} />
                            <Text style={s.previewActionText}>使用该照片</Text>
                        </TouchableOpacity>
                    </View>
                </GestureHandlerRootView>
            </Modal>

            {/* ════════ 背景图预览（已有背景图时查看）════════ */}
            <Modal visible={bgPreviewVisible} transparent animationType="fade"
                onRequestClose={() => setBgPreviewVisible(false)}>
                <View style={s.previewContainer}>
                    <TouchableOpacity style={[s.previewCloseBtn, { top: insets.top + Spacing.sm }]}
                        onPress={() => setBgPreviewVisible(false)}>
                        <Ionicons name="close" size={24} color={Colors.white} />
                    </TouchableOpacity>
                    <Pressable style={s.previewImageArea} onPress={() => setBgPreviewVisible(false)}>
                        <Image source={{ uri: bgImageUri }} style={s.bgPreviewImage} contentFit="cover" />
                    </Pressable>
                    <View style={[s.previewBottomBar, { paddingBottom: insets.bottom + Spacing.lg }]}>
                        <TouchableOpacity style={s.previewActionBtn} onPress={() => { setBgPreviewVisible(false); openAlbumFor('bg'); }}>
                            <Ionicons name="images-outline" size={22} color={Colors.white} />
                            <Text style={s.previewActionText}>更换背景图</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ════════ 背景图编辑预览（选图后确认）════════ */}
            <Modal visible={bgCropVisible} transparent animationType="fade"
                onRequestClose={() => { setBgCropVisible(false); resetBgGesture(); }}>
                <GestureHandlerRootView style={s.previewContainer}>
                    <TouchableOpacity style={[s.previewCloseBtn, { top: insets.top + Spacing.sm }]}
                        onPress={() => { setBgCropVisible(false); resetBgGesture(); }}>
                        <Ionicons name="close" size={24} color={Colors.white} />
                    </TouchableOpacity>
                    <View style={s.previewImageArea}>
                        <PanGestureHandler onGestureEvent={onBgPan} onHandlerStateChange={onBgPanEnd}
                            minPointers={1} maxPointers={2}>
                            <Animated.View>
                                <PinchGestureHandler onGestureEvent={onBgPinch} onHandlerStateChange={onBgPinchEnd}>
                                    <Animated.View style={{
                                        transform: [
                                            { scale: bgScale },
                                            { translateX: bgTransX },
                                            { translateY: bgTransY },
                                        ],
                                    }}>
                                        <Image source={{ uri: bgCropUri }}
                                            style={s.bgPreviewImage} contentFit="cover" />
                                    </Animated.View>
                                </PinchGestureHandler>
                            </Animated.View>
                        </PanGestureHandler>
                        <View style={s.bgCropFrame} pointerEvents="none">
                            {bgPinching && (
                                <>
                                    <View style={[s.gridLineH, { top: '33.33%' }]} />
                                    <View style={[s.gridLineH, { top: '66.67%' }]} />
                                    <View style={[s.gridLineV, { left: '33.33%' }]} />
                                    <View style={[s.gridLineV, { left: '66.67%' }]} />
                                </>
                            )}
                        </View>
                    </View>
                    <View style={[s.previewBottomBar, { paddingBottom: insets.bottom + Spacing.lg }]}>
                        <TouchableOpacity style={s.previewActionBtn}
                            onPress={() => { setBgCropVisible(false); resetBgGesture(); }}>
                            <Text style={s.previewActionText}>取消</Text>
                        </TouchableOpacity>
                        <View style={{ width: Spacing.xxl }} />
                        <TouchableOpacity style={[s.previewActionBtn, s.previewConfirmBtn]}
                            onPress={() => { setBgImageUri(bgCropUri); setBgCropVisible(false); resetBgGesture(); }}>
                            <Ionicons name="checkmark" size={22} color={Colors.white} />
                            <Text style={s.previewActionText}>使用该图片</Text>
                        </TouchableOpacity>
                    </View>
                </GestureHandlerRootView>
            </Modal>

            {/* ════════ 性别选择 ════════ */}
            <Modal visible={genderModalVisible} transparent animationType="fade"
                onRequestClose={() => setGenderModalVisible(false)}>
                <Pressable style={s.sheetOverlay} onPress={() => setGenderModalVisible(false)}>
                    <Pressable style={[s.sheet, { paddingBottom: insets.bottom + Spacing.lg }]}>
                        {([
                            { value: 1, label: '男', icon: 'male' as const, color: '#4A90D9' },
                            { value: 2, label: '女', icon: 'female' as const, color: '#E84393' },
                            { value: 0, label: '保密', icon: 'help-circle-outline' as const, color: Colors.textSecondary },
                        ] as const).map((g, i) => (
                            <View key={g.value}>
                                {i > 0 && <View style={s.sheetDivider} />}
                                <TouchableOpacity style={s.genderOptionRow}
                                    onPress={() => { setGender(g.value); setGenderModalVisible(false); }}>
                                    <View style={s.genderCenter}>
                                        <Ionicons name={g.icon} size={20} color={g.color} />
                                        <Text style={[s.genderOptionText,
                                            gender === g.value && { color: Colors.primary, fontWeight: '600' }]}>
                                            {g.label}
                                        </Text>
                                    </View>
                                    {gender === g.value && (
                                        <Ionicons name="checkmark" size={20} color={Colors.primary} style={s.genderCheck} />
                                    )}
                                </TouchableOpacity>
                            </View>
                        ))}
                        <View style={s.sheetGap} />
                        <TouchableOpacity style={s.sheetCancel} onPress={() => setGenderModalVisible(false)}>
                            <Text style={s.sheetCancelText}>取消</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ════════ 文本编辑 ════════ */}
            <Modal visible={editModalVisible} transparent animationType="slide"
                onRequestClose={() => setEditModalVisible(false)}>
                <KeyboardAvoidingView style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={[s.editFullScreen, { paddingTop: insets.top }]}>
                        <TouchableOpacity style={s.editCloseBtn} onPress={() => setEditModalVisible(false)}>
                            <Text style={s.editCloseBtnText}>取消</Text>
                        </TouchableOpacity>
                        <Text style={s.editFullTitle}>
                            {editField === 'username' ? '修改昵称' : '修改签名'}
                        </Text>
                        <TextInput
                            style={[s.editFullInput, editField === 'signature' && { height: 120, textAlignVertical: 'top' }]}
                            value={editTempValue}
                            onChangeText={setEditTempValue}
                            placeholder={editField === 'username' ? '输入昵称' : '写点什么介绍自己'}
                            placeholderTextColor={Colors.textTertiary}
                            autoFocus
                            maxLength={editField === 'username' ? 20 : 100}
                            multiline={editField === 'signature'}
                        />
                        <Text style={s.editFullCount}>
                            {editTempValue.length}/{editField === 'username' ? 20 : 100}
                        </Text>
                        <TouchableOpacity
                            style={[s.editFullConfirmBtn,
                                (!editTempValue.trim() || editTempValue.trim() === (editField === 'username' ? username : signature).trim()) && { opacity: 0.5 },
                            ]}
                            onPress={confirmEdit}
                            disabled={!editTempValue.trim() || editTempValue.trim() === (editField === 'username' ? username : signature).trim()}
                        >
                            <Text style={s.editFullConfirmText}>确定</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ════════ 日期选择器 ════════ */}
            <Modal visible={datePickerVisible} transparent animationType="fade"
                onRequestClose={() => setDatePickerVisible(false)}>
                <View style={s.sheetOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setDatePickerVisible(false)} />
                    <View style={[s.wheelSheet, { paddingBottom: insets.bottom }]}>
                        <View style={s.wheelSheetHeader}>
                            <TouchableOpacity onPress={() => setDatePickerVisible(false)}>
                                <Text style={s.wheelSheetCancel}>取消</Text>
                            </TouchableOpacity>
                            <Text style={s.wheelSheetTitle}>选择生日</Text>
                            <View style={{ width: 40 }} />
                        </View>
                        <View style={s.wheelContainer}>
                            <View style={s.wheelHighlight} />
                            <WheelColumn
                                labels={YEARS.map(y => `${y}年`)}
                                selectedIndex={pickerYear - YEAR_START}
                                onIndexChange={i => setPickerYear(YEARS[i])}
                            />
                            <WheelColumn
                                labels={MONTHS.map(m => `${m}月`)}
                                selectedIndex={pickerMonth - 1}
                                onIndexChange={i => setPickerMonth(MONTHS[i])}
                            />
                            <WheelColumn
                                labels={days.map(d => `${d}日`)}
                                selectedIndex={Math.min(pickerDay - 1, days.length - 1)}
                                onIndexChange={i => setPickerDay(days[i])}
                            />
                        </View>
                        <View style={s.editSheetDivider} />
                        <TouchableOpacity style={s.editSheetConfirmBtn} onPress={confirmDatePicker}>
                            <Text style={s.editSheetConfirmText}>确定</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ════════ 地区选择器 ════════ */}
            <Modal visible={regionModalVisible} transparent animationType="fade"
                onRequestClose={() => setRegionModalVisible(false)}>
                <View style={s.sheetOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setRegionModalVisible(false)} />
                    <View style={[s.wheelSheet, { paddingBottom: insets.bottom }]}>
                        <View style={s.wheelSheetHeader}>
                            <TouchableOpacity onPress={() => setRegionModalVisible(false)}>
                                <Text style={s.wheelSheetCancel}>取消</Text>
                            </TouchableOpacity>
                            <Text style={s.wheelSheetTitle}>选择地区</Text>
                            <View style={{ width: 40 }} />
                        </View>
                        <View style={s.wheelContainer}>
                            <View style={s.wheelHighlight} />
                            <WheelColumn
                                labels={COUNTRIES}
                                selectedIndex={regionCountryIdx}
                                onIndexChange={setRegionCountryIdx}
                            />
                            <WheelColumn
                                labels={provinceList}
                                selectedIndex={Math.min(regionProvinceIdx, provinceList.length - 1)}
                                onIndexChange={setRegionProvinceIdx}
                            />
                            <WheelColumn
                                labels={cityList}
                                selectedIndex={Math.min(regionCityIdx, cityList.length - 1)}
                                onIndexChange={setRegionCityIdx}
                            />
                        </View>
                        <View style={s.editSheetDivider} />
                        <TouchableOpacity style={s.editSheetConfirmBtn} onPress={confirmRegion}>
                            <Text style={s.editSheetConfirmText}>确定</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ════════ 职业选择 ════════ */}
            <Modal visible={occupationModalVisible} transparent animationType="fade"
                onRequestClose={() => setOccupationModalVisible(false)}>
                <Pressable style={s.sheetOverlay} onPress={() => setOccupationModalVisible(false)}>
                    <Pressable style={[s.sheet, { paddingBottom: insets.bottom, maxHeight: '60%' }]}>
                        <View style={s.wheelSheetHeader}>
                            <TouchableOpacity onPress={() => setOccupationModalVisible(false)}>
                                <Text style={s.wheelSheetCancel}>取消</Text>
                            </TouchableOpacity>
                            <Text style={s.wheelSheetTitle}>选择职业</Text>
                            <View style={{ width: 40 }} />
                        </View>
                        <ScrollView bounces={false}>
                            {OCCUPATIONS.map((item, i) => (
                                <View key={item}>
                                    {i > 0 && <View style={s.sheetDivider} />}
                                    <TouchableOpacity style={s.genderOptionRow}
                                        onPress={() => setOccupationTemp(item)}>
                                        <View style={s.genderCenter}>
                                            <Text style={[s.genderOptionText, { marginLeft: 0 },
                                                occupationTemp === item && { color: Colors.primary, fontWeight: '600' }]}>
                                                {item}
                                            </Text>
                                        </View>
                                        {occupationTemp === item && (
                                            <Ionicons name="checkmark" size={20} color={Colors.primary} style={s.genderCheck} />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>
                        <View style={s.editSheetDivider} />
                        <TouchableOpacity style={s.editSheetConfirmBtn}
                            onPress={() => { setOccupation(occupationTemp); setOccupationModalVisible(false); }}>
                            <Text style={s.editSheetConfirmText}>确定</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ════════ 学校名称选择 ════════ */}
            <Modal visible={schoolNameModalVisible} transparent animationType="fade"
                onRequestClose={() => setSchoolNameModalVisible(false)}>
                <Pressable style={s.sheetOverlay} onPress={() => setSchoolNameModalVisible(false)}>
                    <Pressable style={[s.sheet, { paddingBottom: insets.bottom, height: '70%' }]}>
                        <View style={s.wheelSheetHeader}>
                            <TouchableOpacity onPress={() => setSchoolNameModalVisible(false)}>
                                <Text style={s.wheelSheetCancel}>取消</Text>
                            </TouchableOpacity>
                            <Text style={s.wheelSheetTitle}>选择学校</Text>
                            <View style={{ width: 40 }} />
                        </View>
                        <View style={s.searchBarWrap}>
                            <Ionicons name="search" size={18} color={Colors.textTertiary} />
                            <TextInput
                                style={s.searchBarInput}
                                value={schoolSearch}
                                onChangeText={setSchoolSearch}
                                placeholder="搜索学校"
                                placeholderTextColor={Colors.textTertiary}
                                autoCorrect={false}
                            />
                            {schoolSearch.length > 0 && (
                                <TouchableOpacity onPress={() => setSchoolSearch('')}>
                                    <Ionicons name="close-circle" size={18} color={Colors.textTertiary} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <ScrollView style={{ flex: 1 }} bounces={false} keyboardShouldPersistTaps="handled">
                            {filteredSchools.map((item, i) => (
                                <View key={item}>
                                    {i > 0 && <View style={s.sheetDivider} />}
                                    <TouchableOpacity style={s.genderOptionRow}
                                        onPress={() => setSchoolTempName(item)}>
                                        <View style={s.genderCenter}>
                                            <Text style={[s.genderOptionText, { marginLeft: 0 },
                                                schoolTempName === item && { color: Colors.primary, fontWeight: '600' }]}>
                                                {item}
                                            </Text>
                                        </View>
                                        {schoolTempName === item && (
                                            <Ionicons name="checkmark" size={20} color={Colors.primary} style={s.genderCheck} />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {filteredSchools.length === 0 && (
                                <View style={s.emptyHint}>
                                    <Text style={s.emptyHintText}>无匹配结果</Text>
                                </View>
                            )}
                        </ScrollView>
                        <View style={s.editSheetDivider} />
                        <TouchableOpacity style={s.editSheetConfirmBtn}
                            onPress={() => { setSchoolName(schoolTempName); setSchoolNameModalVisible(false); }}>
                            <Text style={s.editSheetConfirmText}>确定</Text>
                        </TouchableOpacity>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* ════════ 入学年份选择 ════════ */}
            <Modal visible={schoolYearModalVisible} transparent animationType="fade"
                onRequestClose={() => setSchoolYearModalVisible(false)}>
                <View style={s.sheetOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={() => setSchoolYearModalVisible(false)} />
                    <View style={[s.wheelSheet, { paddingBottom: insets.bottom }]}>
                        <View style={s.wheelSheetHeader}>
                            <TouchableOpacity onPress={() => setSchoolYearModalVisible(false)}>
                                <Text style={s.wheelSheetCancel}>取消</Text>
                            </TouchableOpacity>
                            <Text style={s.wheelSheetTitle}>入学年份</Text>
                            <View style={{ width: 40 }} />
                        </View>
                        <View style={s.wheelContainer}>
                            <View style={s.wheelHighlight} />
                            <WheelColumn
                                labels={schoolYearList.map(y => `${y}年`)}
                                selectedIndex={Math.max(0, schoolYearList.indexOf(schoolYear || THIS_YEAR - 2))}
                                onIndexChange={i => setSchoolYear(schoolYearList[i])}
                            />
                        </View>
                        <View style={s.editSheetDivider} />
                        <TouchableOpacity style={s.editSheetConfirmBtn}
                            onPress={() => setSchoolYearModalVisible(false)}>
                            <Text style={s.editSheetConfirmText}>确定</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ════════ 相册选择器 ════════ */}
            <AlbumPicker
                visible={albumPickerVisible}
                maxCount={1}
                onCancel={() => setAlbumPickerVisible(false)}
                onConfirm={handleAlbumConfirm}
            />

            {/* ════════ 轻提示 Toast ════════ */}
            {toastText ? (
                <Animated.View pointerEvents="none"
                    style={[s.toast, { top: insets.top + 56, opacity: toastAnim,
                        transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
                    }]}>
                    <View style={[s.toastInner, toastType === 'error' && s.toastError]}>
                        <Ionicons name={toastType === 'success' ? 'checkmark-circle' : 'alert-circle'} size={18} color={Colors.white} />
                        <Text style={s.toastText}>{toastText}</Text>
                    </View>
                </Animated.View>
            ) : null}
        </View>
    );
}

// ─── 样式 ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm,
        backgroundColor: Colors.backgroundWhite,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, fontSize: FontSize.lg, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
    saveHeaderBtn: { width: 60, height: 40, justifyContent: 'center', alignItems: 'center' },
    saveHeaderText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
    loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 40 },

    avatarWrapper: { alignSelf: 'center', marginTop: Spacing.xxl, marginBottom: Spacing.xl },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.backgroundGray },
    cameraIconBadge: {
        position: 'absolute', right: 0, bottom: 0, width: 26, height: 26, borderRadius: 13,
        backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: Colors.backgroundWhite,
    },

    section: {
        backgroundColor: Colors.backgroundWhite, borderRadius: 12,
        marginHorizontal: Spacing.lg, marginBottom: Spacing.md, paddingHorizontal: Spacing.lg,
    },

    row: { flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingVertical: Spacing.md },
    rowLabel: { width: LABEL_WIDTH, fontSize: FontSize.md, color: Colors.textPrimary, fontWeight: '500' },
    rowValue: { flex: 1, fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'left' },
    rowValueLeft: { flex: 1, fontSize: FontSize.md, color: Colors.textPrimary, textAlign: 'left' },
    rowPlaceholder: { flex: 1, fontSize: FontSize.md, color: Colors.textTertiary, textAlign: 'left', marginRight: Spacing.xs },
    rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginLeft: LABEL_WIDTH },

    bgThumbArea: { flex: 1, flexDirection: 'row', justifyContent: 'flex-start', marginRight: Spacing.xs },
    bgThumb: { width: 48, height: 28, borderRadius: 4, backgroundColor: Colors.backgroundGray },
    bgThumbPlaceholder: {
        width: 48, height: 28, borderRadius: 4, backgroundColor: Colors.backgroundGray,
        justifyContent: 'center', alignItems: 'center',
    },

    // 全屏头像
    previewContainer: { flex: 1, backgroundColor: Colors.black, justifyContent: 'center' },
    previewCloseBtn: {
        position: 'absolute', left: Spacing.lg, zIndex: 10, width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center',
    },
    previewImageArea: { flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    previewImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH },
    bgPreviewImage: { width: SCREEN_WIDTH, height: BG_PREVIEW_HEIGHT, borderRadius: 4 },
    bgCropFrame: {
        position: 'absolute',
        width: SCREEN_WIDTH - 32,
        height: BG_PREVIEW_HEIGHT - 24,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.7)',
        borderRadius: 4,
    },
    gridLineH: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    gridLineV: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(255,255,255,0.5)',
    },
    circleMask: {
        position: 'absolute',
        width: SCREEN_WIDTH - 48 + SCREEN_WIDTH * 2,
        height: SCREEN_WIDTH - 48 + SCREEN_WIDTH * 2,
        borderRadius: (SCREEN_WIDTH - 48 + SCREEN_WIDTH * 2) / 2,
        borderWidth: SCREEN_WIDTH,
        borderColor: 'rgba(0,0,0,0.55)',
    },
    previewBottomBar: {
        flexDirection: 'row', justifyContent: 'center',
        paddingTop: Spacing.lg, backgroundColor: 'rgba(0,0,0,0.6)',
    },
    previewActionBtn: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.md,
        borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.15)',
    },
    previewActionText: { marginLeft: Spacing.sm, fontSize: FontSize.md, color: Colors.white, fontWeight: '500' },
    previewConfirmBtn: { backgroundColor: Colors.primary },

    // 通用底部弹窗
    sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    sheet: {
        backgroundColor: Colors.backgroundWhite, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: Spacing.sm,
    },
    sheetOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg },
    sheetOptionText: { marginLeft: Spacing.sm, fontSize: FontSize.lg, color: Colors.textPrimary },
    sheetDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginHorizontal: Spacing.xl },
    sheetGap: { height: Spacing.sm, backgroundColor: Colors.background },
    sheetCancel: { alignItems: 'center', paddingVertical: Spacing.lg },
    sheetCancelText: { fontSize: FontSize.lg, color: Colors.textSecondary },

    // 性别选项
    genderOptionRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: Spacing.lg, paddingHorizontal: Spacing.xl,
    },
    genderCenter: { flexDirection: 'row', alignItems: 'center' },
    genderOptionText: { marginLeft: Spacing.sm, fontSize: FontSize.lg, color: Colors.textPrimary },
    genderCheck: { position: 'absolute', right: Spacing.xl },

    // 文本编辑弹窗
    editSheet: { backgroundColor: Colors.backgroundWhite, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    editSheetBody: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg },
    editSheetInput: {
        padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary,
        borderWidth: 1, borderColor: Colors.border, borderRadius: 8, backgroundColor: Colors.backgroundLightGray,
    },
    editSheetCount: { textAlign: 'right', marginTop: Spacing.xs, fontSize: FontSize.xs, color: Colors.textTertiary },
    editSheetDivider: { height: 6, backgroundColor: '#f2f2f2', marginTop: Spacing.lg },
    editSheetConfirmBtn: { alignItems: 'center', paddingVertical: Spacing.lg },
    editSheetConfirmText: { fontSize: FontSize.lg, color: Colors.primary, fontWeight: '600' },

    // 全屏文本编辑
    editFullScreen: {
        flex: 1, backgroundColor: Colors.backgroundWhite, paddingHorizontal: Spacing.xl,
    },
    editCloseBtn: {
        height: 36, justifyContent: 'center',
        marginTop: Spacing.sm,
    },
    editCloseBtnText: {
        fontSize: FontSize.md, color: Colors.textSecondary,
    },
    editFullTitle: {
        fontSize: FontSize.xxl, fontWeight: 'bold', color: Colors.textPrimary,
        marginTop: Spacing.xl, marginBottom: Spacing.xl, textAlign: 'center',
    },
    editFullInput: {
        padding: Spacing.md, fontSize: FontSize.md, color: Colors.textPrimary,
        borderWidth: 1, borderColor: Colors.border, borderRadius: 8,
        backgroundColor: Colors.backgroundLightGray,
    },
    editFullCount: {
        textAlign: 'right', marginTop: Spacing.sm, fontSize: FontSize.xs, color: Colors.textTertiary,
    },
    editFullConfirmBtn: {
        backgroundColor: Colors.primary, borderRadius: 24, paddingVertical: Spacing.md,
        alignItems: 'center', marginTop: Spacing.xl,
    },
    editFullConfirmText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: '600' },

    // 滚轮弹窗（日期 / 地区 / 学校共用）
    wheelSheet: { backgroundColor: Colors.backgroundWhite, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    wheelSheetHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
    },
    wheelSheetTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.textPrimary },
    wheelSheetCancel: { fontSize: FontSize.md, color: Colors.textSecondary },
    wheelSheetConfirm: { fontSize: FontSize.md, color: Colors.primary, fontWeight: '600' },
    wheelContainer: {
        flexDirection: 'row', height: WHEEL_HEIGHT, marginHorizontal: Spacing.lg, overflow: 'hidden',
    },
    wheelHighlight: {
        position: 'absolute', left: 0, right: 0,
        top: WHEEL_ITEM_H * 2, height: WHEEL_ITEM_H,
        backgroundColor: Colors.background, borderRadius: 8,
    },

    // 搜索框
    searchBarWrap: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: Spacing.lg, marginVertical: Spacing.sm,
        paddingHorizontal: Spacing.md, height: 38,
        backgroundColor: Colors.backgroundGray, borderRadius: 19,
    },
    searchBarInput: {
        flex: 1, marginLeft: Spacing.sm, fontSize: FontSize.md, color: Colors.textPrimary, padding: 0,
    },
    emptyHint: { paddingVertical: Spacing.xxl, alignItems: 'center' },
    emptyHintText: { fontSize: FontSize.md, color: Colors.textTertiary },

    // 轻提示
    toast: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 999 },
    toastInner: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 2,
        borderRadius: 20, backgroundColor: 'rgba(52,199,89,0.92)',
    },
    toastError: { backgroundColor: 'rgba(220,53,69,0.92)' },
    toastText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '600', marginLeft: Spacing.xs },
});
