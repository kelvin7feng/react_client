import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AuthContextType = {
    userId: number | null;
    token: string | null;
    isLoggedIn: boolean;
    isLoading: boolean;
    login: (userId: number, token: string) => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
    userId: null,
    token: null,
    isLoggedIn: false,
    isLoading: true,
    login: async () => {},
    logout: async () => {},
});

const STORAGE_KEYS = ['user_token', 'user_id', 'username'] as const;

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

    const login = useCallback(async (newUserId: number, newToken: string) => {
        await AsyncStorage.setItem('user_token', newToken);
        await AsyncStorage.setItem('user_id', String(newUserId));
        setUserId(newUserId);
        setToken(newToken);
    }, []);

    const logout = useCallback(async () => {
        await AsyncStorage.multiRemove([...STORAGE_KEYS]);
        setUserId(null);
        setToken(null);
    }, []);

    return (
        <AuthContext.Provider value={{
            userId,
            token,
            isLoggedIn: !!userId && !!token,
            isLoading,
            login,
            logout,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
