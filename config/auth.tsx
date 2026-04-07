import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type StoredAccount = {
    userId: number;
    token: string;
    username: string;
    avatar: string;
};

type AuthContextType = {
    userId: number | null;
    token: string | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    login: (userId: number, token: string) => Promise<void>;
    logout: () => Promise<void>;
    switchTo: (account: StoredAccount) => Promise<void>;
    getStoredAccounts: () => Promise<StoredAccount[]>;
    saveAccountInfo: (info: Omit<StoredAccount, 'token'>) => Promise<void>;
    removeStoredAccount: (userId: number) => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    userId: null,
    token: null,
    isLoggedIn: false,
    isLoading: true,
    login: async () => {},
    logout: async () => {},
    switchTo: async () => {},
    getStoredAccounts: async () => [],
    saveAccountInfo: async () => {},
    removeStoredAccount: async () => {},
});

const STORAGE_KEYS = ['user_token', 'user_id', 'username'] as const;
const ACCOUNTS_KEY = 'stored_accounts';

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [userId, setUserId] = useState<number | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const [storedToken, storedUserId] = await Promise.all([
                    AsyncStorage.getItem('user_token'),
                    AsyncStorage.getItem('user_id'),
                ]);
                if (storedToken && storedUserId) {
                    setToken(storedToken);
                    setUserId(Number(storedUserId));
                }
            } catch {} finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const getStoredAccounts = useCallback(async (): Promise<StoredAccount[]> => {
        try {
            const raw = await AsyncStorage.getItem(ACCOUNTS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }, []);

    const saveAccountToList = useCallback(async (account: StoredAccount) => {
        const accounts = await getStoredAccounts();
        const idx = accounts.findIndex(a => a.userId === account.userId);
        if (idx >= 0) {
            accounts[idx] = account;
        } else {
            accounts.push(account);
        }
        await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    }, [getStoredAccounts]);

    const login = useCallback(async (newUserId: number, newToken: string) => {
        await AsyncStorage.setItem('user_token', newToken);
        await AsyncStorage.setItem('user_id', String(newUserId));
        setUserId(newUserId);
        setToken(newToken);
        await saveAccountToList({ userId: newUserId, token: newToken, username: '', avatar: '' });
    }, [saveAccountToList]);

    const logout = useCallback(async () => {
        await AsyncStorage.multiRemove([...STORAGE_KEYS]);
        setUserId(null);
        setToken(null);
    }, []);

    const switchTo = useCallback(async (account: StoredAccount) => {
        await AsyncStorage.setItem('user_token', account.token);
        await AsyncStorage.setItem('user_id', String(account.userId));
        setUserId(account.userId);
        setToken(account.token);
    }, []);

    const saveAccountInfo = useCallback(async (info: Omit<StoredAccount, 'token'>) => {
        const accounts = await getStoredAccounts();
        const idx = accounts.findIndex(a => a.userId === info.userId);
        if (idx >= 0) {
            accounts[idx] = { ...accounts[idx], ...info };
            await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
        }
    }, [getStoredAccounts]);

    const removeStoredAccount = useCallback(async (targetUserId: number) => {
        const accounts = await getStoredAccounts();
        const filtered = accounts.filter(a => a.userId !== targetUserId);
        await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(filtered));
    }, [getStoredAccounts]);

    return (
        <AuthContext.Provider value={{
            userId,
            token,
            isLoggedIn: !!userId && !!token,
            isLoading,
            login,
            logout,
            switchTo,
            getStoredAccounts,
            saveAccountInfo,
            removeStoredAccount,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
