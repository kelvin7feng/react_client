import { Stack } from 'expo-router';
import { LogBox } from 'react-native';

LogBox.ignoreAllLogs(false);

export default function RootLayout() {
  return (
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
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}