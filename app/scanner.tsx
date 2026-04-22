import { useState, useRef, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Linking,
    StatusBar,
    Dimensions,
    Animated as RNAnimated,
    Alert,
    Easing,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { BouncingDotsIndicator } from '@/components/BouncingDotsIndicator';
import { Colors, FontSize, Spacing } from '../config/styles';
import { API_BASE_URL, API_ENDPOINTS } from '../config/api';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCAN_AREA_SIZE = SCREEN_WIDTH * 0.65;
const SCAN_LINE_HEIGHT = 2;

function ScanLineAnimation() {
    const translateY = useRef(new RNAnimated.Value(0)).current;

    useEffect(() => {
        const loop = RNAnimated.loop(
            RNAnimated.sequence([
                RNAnimated.timing(translateY, {
                    toValue: SCAN_AREA_SIZE - SCAN_LINE_HEIGHT,
                    duration: 2200,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                RNAnimated.timing(translateY, {
                    toValue: 0,
                    duration: 2200,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ]),
        );
        loop.start();
        return () => loop.stop();
    }, [translateY]);

    return (
        <RNAnimated.View
            style={[
                styles.scanLine,
                { transform: [{ translateY }] },
            ]}
        />
    );
}

export default function ScannerScreen() {
    const router = useRouter();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const lastScannedRef = useRef<string>('');
    const [toastVisible, setToastVisible] = useState(false);
    const toastOpacity = useRef(new RNAnimated.Value(0)).current;

    const isUrl = scanResult ? /^https?:\/\//i.test(scanResult) : false;

    const handleBarCodeScanned = useCallback(({ data }: { type: string; data: string }) => {
        if (scanned || data === lastScannedRef.current) return;
        lastScannedRef.current = data;
        setScanned(true);
        setScanResult(data);
    }, [scanned]);

    const showToast = useCallback(() => {
        setToastVisible(true);
        toastOpacity.setValue(1);
        RNAnimated.timing(toastOpacity, {
            toValue: 0,
            duration: 500,
            delay: 1200,
            useNativeDriver: true,
        }).start(() => setToastVisible(false));
    }, [toastOpacity]);

    const handleCopy = async () => {
        if (!scanResult) return;
        await Clipboard.setStringAsync(scanResult);
        showToast();
    };

    const [decoding, setDecoding] = useState(false);

    const handlePickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1,
            exif: false,
        });
        if (result.canceled || !result.assets?.[0]) return;

        setDecoding(true);
        try {
            const asset = result.assets[0];
            const mime = asset.mimeType?.startsWith('image/heic') ? 'image/jpeg' : (asset.mimeType || 'image/jpeg');
            const ext = mime === 'image/png' ? '.png' : '.jpg';
            const formData = new FormData();
            formData.append('image', {
                uri: asset.uri,
                type: mime,
                name: (asset.fileName?.replace(/\.heic$/i, ext)) || `qr${ext}`,
            } as any);

            const res = await fetch(`${API_BASE_URL}${API_ENDPOINTS.DECODE_QRCODE}`, {
                method: 'POST',
                body: formData,
            });
            const json = await res.json();

            if (json.code === 0 && json.data?.content) {
                setScanned(true);
                setScanResult(json.data.content);
            } else {
                Alert.alert('提示', json.message || '未识别到二维码');
            }
        } catch {
            Alert.alert('提示', '识别失败，请检查网络后重试');
        } finally {
            setDecoding(false);
        }
    };

    if (!permission) {
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.permissionContainer}>
                <StatusBar barStyle="dark-content" />
                <Ionicons name="camera-outline" size={64} color={Colors.textTertiary} />
                <Text style={styles.permissionTitle}>需要摄像头权限</Text>
                <Text style={styles.permissionDesc}>请授权访问摄像头以扫描二维码</Text>
                <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                    <Text style={styles.permissionBtnText}>授权摄像头</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
                    <Text style={styles.backLinkText}>返回</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (scanResult) {
        return (
            <View style={styles.resultContainer}>
                <StatusBar barStyle="dark-content" />
                <View style={styles.resultTopBar}>
                    <TouchableOpacity style={styles.resultBackBtn} onPress={() => router.back()}>
                        <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.resultTopTitle}>扫描结果</Text>
                    <View style={styles.resultBackBtnPlaceholder} />
                </View>

                <View style={styles.resultContent}>
                    <View style={styles.resultCard}>
                        {isUrl ? (
                            <>
                                <Text style={styles.resultLabel}>识别到链接</Text>
                                <TouchableOpacity onPress={() => Linking.openURL(scanResult)}>
                                    <Text style={styles.resultUrl} numberOfLines={5}>{scanResult}</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <Text style={styles.resultLabel}>识别到文本</Text>
                                <Text style={styles.resultText} selectable>{scanResult}</Text>
                            </>
                        )}
                    </View>

                    <View style={styles.bottomArea}>
                        <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
                            <Ionicons name="copy-outline" size={18} color="#fff" />
                            <Text style={styles.copyBtnText}>复制</Text>
                        </TouchableOpacity>
                        <Text style={styles.disclaimer}>以上内容非官方提供，请谨慎使用</Text>
                    </View>
                </View>

                {toastVisible && (
                    <RNAnimated.View style={[styles.toast, { opacity: toastOpacity }]}>
                        <Ionicons name="checkmark-circle" size={16} color="#fff" />
                        <Text style={styles.toastText}>已复制到剪贴板</Text>
                    </RNAnimated.View>
                )}
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onCameraReady={() => setCameraReady(true)}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={cameraReady && !scanned ? handleBarCodeScanned : undefined}
            />

            <View style={styles.overlay}>
                <View style={styles.overlayTop} />
                <View style={styles.overlayMiddle}>
                    <View style={styles.overlaySide} />
                    <View style={styles.scanArea}>
                        <View style={[styles.corner, styles.cornerTL]} />
                        <View style={[styles.corner, styles.cornerTR]} />
                        <View style={[styles.corner, styles.cornerBL]} />
                        <View style={[styles.corner, styles.cornerBR]} />
                        <ScanLineAnimation />
                    </View>
                    <View style={styles.overlaySide} />
                </View>
                <View style={styles.overlayBottom}>
                    <Text style={styles.hintText}>将二维码放入框内，即可自动扫描</Text>

                    <TouchableOpacity style={styles.albumBtn} onPress={handlePickImage} disabled={decoding}>
                        <View style={styles.albumIconWrapper}>
                            {decoding ? (
                                <BouncingDotsIndicator mode="inline" size={16} color="#fff" />
                            ) : (
                                <Ionicons name="images-outline" size={26} color="#fff" />
                            )}
                        </View>
                        <Text style={styles.albumBtnText}>{decoding ? '识别中...' : '相册'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.topBar}>
                <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
                    <Ionicons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.topTitle}>扫一扫</Text>
                <View style={styles.closeBtnPlaceholder} />
            </View>
        </View>
    );
}

const CORNER_SIZE = 20;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
        paddingHorizontal: 40,
    },
    permissionTitle: {
        fontSize: FontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
        marginTop: 20,
    },
    permissionDesc: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        marginTop: 8,
        textAlign: 'center',
    },
    permissionBtn: {
        marginTop: 30,
        backgroundColor: Colors.primary,
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 22,
    },
    permissionBtnText: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    backLink: {
        marginTop: 16,
    },
    backLinkText: {
        color: Colors.textTertiary,
        fontSize: FontSize.sm,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    overlayTop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    overlayMiddle: {
        flexDirection: 'row',
        height: SCAN_AREA_SIZE,
    },
    overlaySide: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    scanArea: {
        width: SCAN_AREA_SIZE,
        height: SCAN_AREA_SIZE,
        overflow: 'hidden',
    },
    scanLine: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: SCAN_LINE_HEIGHT,
        backgroundColor: '#00ff88',
        shadowColor: '#00ff88',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 6,
    },
    overlayBottom: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center',
        paddingTop: 24,
    },
    hintText: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: FontSize.sm,
    },
    albumBtn: {
        alignItems: 'center',
        marginTop: 40,
    },
    albumIconWrapper: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    albumBtnText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: FontSize.xs,
    },
    corner: {
        position: 'absolute',
        width: CORNER_SIZE,
        height: CORNER_SIZE,
    },
    cornerTL: {
        top: 0, left: 0,
        borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH,
        borderColor: '#fff',
    },
    cornerTR: {
        top: 0, right: 0,
        borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH,
        borderColor: '#fff',
    },
    cornerBL: {
        bottom: 0, left: 0,
        borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH,
        borderColor: '#fff',
    },
    cornerBR: {
        bottom: 0, right: 0,
        borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH,
        borderColor: '#fff',
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 54,
        paddingHorizontal: 16,
        paddingBottom: 12,
    },
    closeBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeBtnPlaceholder: {
        width: 40,
    },
    topTitle: {
        color: '#fff',
        fontSize: FontSize.lg,
        fontWeight: '600',
    },
    resultContainer: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    resultTopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 54,
        paddingHorizontal: 12,
        paddingBottom: 12,
        backgroundColor: Colors.background,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e0e0e0',
    },
    resultBackBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultBackBtnPlaceholder: {
        width: 40,
    },
    resultTopTitle: {
        fontSize: FontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    resultContent: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
        paddingTop: 24,
        alignItems: 'center',
    },
    resultCard: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: Spacing.lg,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    resultLabel: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        marginBottom: 10,
    },
    resultUrl: {
        fontSize: FontSize.md,
        color: '#1a73e8',
        textDecorationLine: 'underline',
        lineHeight: 22,
    },
    resultText: {
        fontSize: FontSize.md,
        color: Colors.textPrimary,
        lineHeight: 22,
    },
    copyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: Colors.primary,
        paddingHorizontal: 40,
        paddingVertical: 12,
        borderRadius: 22,
        width: '100%',
    },
    copyBtnText: {
        color: '#fff',
        fontSize: FontSize.md,
        fontWeight: '600',
    },
    bottomArea: {
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 50,
        width: '100%',
    },
    disclaimer: {
        marginTop: 14,
        fontSize: FontSize.xs,
        color: Colors.textDisabled,
        textAlign: 'center',
    },
    toast: {
        position: 'absolute',
        top: '45%',
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(0,0,0,0.75)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 20,
    },
    toastText: {
        color: '#fff',
        fontSize: FontSize.sm,
    },
});
