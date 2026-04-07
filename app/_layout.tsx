import { Stack } from 'expo-router';
import { LogBox } from 'react-native';
import { AuthProvider } from '../config/auth';

LogBox.ignoreAllLogs(false);

export default function RootLayout() {
  return (
    <AuthProvider>
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: '#f8f9fa',
        },
        headerTintColor: '#333',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="brand/[brandId]"
        options={{
          title: '品牌车型',
          headerBackTitle: '返回',
        }}
      />
      <Stack.Screen
        name="vehicle/[vehicleId]"
        options={{
          title: '车辆详情',
          headerBackTitle: '返回',
      }} />
      <Stack.Screen
        name="article/[articleId]"
        options={{
          headerShown: false,
      }} />
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen name="profile-edit" options={{ title: '编辑资料', headerBackTitle: '返回' }} />
      <Stack.Screen name="follow-list" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="switch-account" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="chat/[conversationId]" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
    </AuthProvider>
  );
}