import { useEffect, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize } from '../config/styles';
import { useAuth, type StoredAccount } from '../config/auth';
import { RemoteImage } from '../components/RemoteImage';
import { API_ENDPOINTS, buildApiUrl } from '../config/api';
import { BouncingDotsIndicator } from '@/components/BouncingDotsIndicator';
import { LoadingStateView } from '@/components/LoadingStateView';

export default function SwitchAccountScreen() {
    const router = useRouter();
    const auth = useAuth();
    const [accounts, setAccounts] = useState<StoredAccount[]>([]);
    const [loading, setLoading] = useState(true);

    const loadAccounts = useCallback(async () => {
        const stored = await auth.getStoredAccounts();
        const enriched = await Promise.all(
            stored.map(async (acc) => {
                if (acc.username && acc.avatar) return acc;
                try {
                    const res = await fetch(buildApiUrl(API_ENDPOINTS.GET_BASIC_INFO, { id: acc.userId }));
                    const result = await res.json();
                    if (result.code === 0 && result.data) {
                        const updated = {
                            ...acc,
                            username: result.data.username || acc.username,
                            avatar: result.data.avatar || acc.avatar,
                        };
                        await auth.saveAccountInfo({ userId: updated.userId, username: updated.username, avatar: updated.avatar });
                        return updated;
                    }
                } catch {}
                return acc;
            }),
        );
        setAccounts(enriched);
        setLoading(false);
    }, [auth]);

    useEffect(() => {
        loadAccounts();
    }, [loadAccounts]);

    const handleSwitch = async (account: StoredAccount) => {
        if (account.userId === auth.userId) return;
        await auth.switchTo(account);
        try { router.dismissAll(); } catch {}
        router.replace('/(tabs)');
    };

    const handleAddAccount = () => {
        router.push('/login');
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={26} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>切换账号</Text>
                <View style={styles.backBtn} />
            </View>

            <View style={styles.body}>
                {loading ? (
                    <LoadingStateView size={28} color={Colors.textTertiary} style={{ marginTop: 60 }} />
                ) : (
                    <>
                        <View style={styles.card}>
                            {accounts.map((account, index) => (
                                <View key={account.userId}>
                                    {index > 0 && <View style={styles.divider} />}
                                    <TouchableOpacity
                                        style={styles.accountRow}
                                        activeOpacity={0.6}
                                        onPress={() => handleSwitch(account)}
                                    >
                                        {account.avatar ? (
                                            <RemoteImage uri={account.avatar} style={styles.avatar} />
                                        ) : (
                                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                                <Ionicons name="person" size={22} color={Colors.textTertiary} />
                                            </View>
                                        )}
                                        <View style={styles.accountInfo}>
                                            <Text style={styles.accountName} numberOfLines={1}>
                                                {account.username || '未知用户'}
                                            </Text>
                                            <Text style={styles.accountId}>ID: {account.userId}</Text>
                                        </View>
                                        {account.userId === auth.userId && (
                                            <Ionicons name="checkmark-circle" size={22} color={Colors.success} />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ))}

                            <View style={styles.divider} />
                            <TouchableOpacity style={styles.addRow} activeOpacity={0.6} onPress={handleAddAccount}>
                                <View style={[styles.avatar, styles.addIcon]}>
                                    <Ionicons name="add" size={24} color={Colors.textPrimary} />
                                </View>
                                <Text style={styles.addText}>添加账号</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.hint}>添加账号后，可在本设备支持账号切换。</Text>
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm + 2,
    },
    backBtn: {
        width: 40,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: FontSize.lg,
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    body: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.xl,
    },
    card: {
        backgroundColor: Colors.backgroundWhite,
        borderRadius: 14,
        overflow: 'hidden',
    },
    accountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md + 2,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
    },
    avatarPlaceholder: {
        backgroundColor: Colors.backgroundGray,
        justifyContent: 'center',
        alignItems: 'center',
    },
    accountInfo: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    accountName: {
        fontSize: FontSize.md,
        fontWeight: '500',
        color: Colors.textPrimary,
    },
    accountId: {
        fontSize: FontSize.xs,
        color: Colors.textTertiary,
        marginTop: 2,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.borderDark,
        marginLeft: Spacing.lg + 44 + Spacing.md,
    },
    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md + 2,
    },
    addIcon: {
        backgroundColor: Colors.backgroundGray,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addText: {
        fontSize: FontSize.md,
        color: Colors.textPrimary,
        fontWeight: '500',
        marginLeft: Spacing.md,
    },
    hint: {
        fontSize: FontSize.sm,
        color: Colors.textTertiary,
        textAlign: 'center',
        marginTop: Spacing.xl,
        lineHeight: 20,
    },
});
