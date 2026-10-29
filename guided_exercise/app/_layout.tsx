import { Stack } from 'expo-router';
import '../global.css';
import {
  useFonts as useFontsInter,
  Inter_400Regular,
  Inter_700Bold,
  Inter_500Medium,
  Inter_600SemiBold
} from '@expo-google-fonts/inter';
import { useFonts as useFontsIstokWeb, IstokWeb_400Regular, IstokWeb_700Bold } from '@expo-google-fonts/istok-web';
import { ToastProvider } from '@/src/components/ui/ToastProvider';
import { PushNotificationProvider } from '@/src/components/notifications/PushNotificationProvider';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AuthProvider } from '@/src/components/auth-provider';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function SplashScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#F7F5FF',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
      <Text
        style={{
          fontSize: 32,
          fontWeight: '700',
          marginBottom: 16,
          textAlign: 'center',
          paddingHorizontal: 24
        }}>
        Move Together, Heal Together
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const [interLoaded, interError] = useFontsInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold
  });

  const [istokWebLoaded, istokWebError] = useFontsIstokWeb({
    IstokWeb_400Regular,
    IstokWeb_700Bold
  });

  if ((!interLoaded && !interError) || (!istokWebLoaded && !istokWebError)) {
    return <SplashScreen />;
  }

  return (
    <AuthProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <ToastProvider>
            <PushNotificationProvider>
              <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
                <Stack screenOptions={{ headerShown: false }} />
              </SafeAreaView>
            </PushNotificationProvider>
          </ToastProvider>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </AuthProvider>
  );
}
