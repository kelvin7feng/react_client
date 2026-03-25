import { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Image, ScrollView,
    StyleSheet, SafeAreaView, Alert, ActivityIndicator, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { buildApiUrl, API_ENDPOINTS, API_BASE_URL } from '../config/api';
import { Colors, Spacing, FontSize } from '../config/styles';
import { useAuth } from '../config/auth';

export default function ProfileEditScreen() {
    const router = useRouter();
    const auth = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [username, setUsername] = useState('');
    const [signature, setSignature] = useState('');
    const [gender, setGender] = useState(0);
    const [birthday, setBirthday] = useState('');
    const [avatarUri, setAvatarUri] = useState('');
    const [newAvatarFile, setNewAvatarFile] = useState<any>(null);

    useEffect(() => {
        (async () => {
            try {
                const response = await fetch(buildApiUrl(API_ENDPOINTS.GET_BASIC_INFO, { id: auth.userId! }));
                const result = await response.json();
                if (result.code === 0) {
                    const d = result.data;
                    setUsername(d.username || '');
                    setSignature(d.signature || '');
                    setGender(d.gender || 0);
                    setBirthday(d.birthday || '');
                    setAvatarUri(d.avatar || '');
                }
            } catch {} finally { setLoading(false); }
        })();
    }, []);

    const pickAvatar = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) {
            setAvatarUri(result.assets[0].uri);
            setNewAvatarFile(result.assets[0]);
        }
    };

    const handleSave = async () => {
        if (!username.trim()) { Alert.alert('提示', '昵称不能为空'); return; }
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('user_id', String(auth.userId));
            formData.append('username', username.trim());
            formData.append('signature', signature.trim());
            formData.append('gender', String(gender));
            formData.append('birthday', birthday);
            if (newAvatarFile) {
                formData.append('avatar', {
                    uri: newAvatarFile.uri,
                    name: 'avatar.jpg',
                    type: 'image/jpeg',
                } as any);
            }
            const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.UPDATE_USER_INFO}`, {
                method: 'PUT',
                body: formData,
            });
            const result = await response.json();
            if (result.code === 0) {
                Alert.alert('成功', '资料已更新', [{ text: '确定', onPress: () => router.back() }]);
            } else {
                Alert.alert('失败', result.msg || '更新失败');
            }
        } catch {
            Alert.alert('失败', '网络错误');
        } finally { setSaving(false); }
    };

    if (loading) {
        return <SafeAreaView style={s.container}><View style={s.center}><ActivityIndicator /></View></SafeAreaView>;
    }

    return (
        <SafeAreaView style={s.container}>
            <ScrollView style={s.scroll} contentContainerStyle={s.content}>
                <TouchableOpacity style={s.avatarSection} onPress={pickAvatar}>
                    <Image
                        source={{ uri: avatarUri || 'https://picsum.photos/200/200' }}
                        style={s.avatar}
                    />
                    <Text style={s.changeAvatarText}>修改头像</Text>
                </TouchableOpacity>

                <View style={s.field}>
                    <Text style={s.label}>昵称</Text>
                    <TextInput style={s.input} value={username} onChangeText={setUsername}
                        placeholder="输入昵称" placeholderTextColor={Colors.textTertiary} maxLength={20} />
                </View>

                <View style={s.field}>
                    <Text style={s.label}>个性签名</Text>
                    <TextInput style={[s.input, s.textArea]} value={signature} onChangeText={setSignature}
                        placeholder="写点什么介绍自己" placeholderTextColor={Colors.textTertiary}
                        multiline maxLength={100} />
                </View>

                <View style={s.field}>
                    <Text style={s.label}>性别</Text>
                    <View style={s.genderRow}>
                        {[{ value: 1, label: '男', icon: 'male' as const, color: '#4A90D9' },
                          { value: 2, label: '女', icon: 'female' as const, color: '#E84393' },
                          { value: 0, label: '保密', icon: 'help' as const, color: Colors.textSecondary }
                        ].map(g => (
                            <TouchableOpacity key={g.value}
                                style={[s.genderOption, gender === g.value && { borderColor: g.color, backgroundColor: g.color + '15' }]}
                                onPress={() => setGender(g.value)}>
                                <Ionicons name={g.icon} size={16} color={gender === g.value ? g.color : Colors.textSecondary} />
                                <Text style={[s.genderText, gender === g.value && { color: g.color }]}>{g.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={s.field}>
                    <Text style={s.label}>生日</Text>
                    <TextInput style={s.input} value={birthday} onChangeText={setBirthday}
                        placeholder="YYYY-MM-DD" placeholderTextColor={Colors.textTertiary} maxLength={10} />
                </View>

                <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                    <Text style={s.saveBtnText}>{saving ? '保存中...' : '保存'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={s.logoutBtn}
                    onPress={() => {
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
                    }}
                >
                    <Ionicons name="log-out-outline" size={18} color={Colors.error} />
                    <Text style={s.logoutText}>退出登录</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.backgroundWhite },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    content: { padding: Spacing.xl },
    avatarSection: { alignItems: 'center', marginBottom: Spacing.xxl },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.backgroundGray },
    changeAvatarText: { marginTop: Spacing.sm, fontSize: FontSize.sm, color: Colors.primary },
    field: { marginBottom: Spacing.xl },
    label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textPrimary, marginBottom: Spacing.sm },
    input: {
        borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: Spacing.md,
        fontSize: FontSize.md, color: Colors.textPrimary, backgroundColor: Colors.backgroundGray,
    },
    textArea: { height: 80, textAlignVertical: 'top' },
    genderRow: { flexDirection: 'row' },
    genderOption: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
        borderRadius: 20, borderWidth: 1, borderColor: Colors.border, marginRight: Spacing.md,
    },
    genderText: { marginLeft: Spacing.xs, fontSize: FontSize.sm, color: Colors.textSecondary },
    saveBtn: {
        backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: Spacing.md,
        alignItems: 'center', marginTop: Spacing.lg,
    },
    saveBtnText: { color: Colors.white, fontSize: FontSize.lg, fontWeight: '600' },
    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        marginTop: Spacing.xxl + Spacing.xl, paddingVertical: Spacing.md,
        borderRadius: 8, borderWidth: 1, borderColor: Colors.error,
    },
    logoutText: { marginLeft: Spacing.sm, fontSize: FontSize.md, color: Colors.error, fontWeight: '500' },
});
