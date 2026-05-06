import { Stack } from 'expo-router';
import "../global.css";
import {
  useFonts as useFontsInter,
  Inter_400Regular,
  Inter_700Bold,
  Inter_500Medium,
  Inter_600SemiBold
} from '@expo-google-fonts/inter';
import {
  useFonts as useFontsIstokWeb,
  IstokWeb_400Regular,
  IstokWeb_700Bold
} from '@expo-google-fonts/istok-web';
import { Text } from 'react-native';
import { ToastProvider } from '@/src/components/ui/ToastProvider';

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
    return <Text>Splash Screen</Text>;
  }

  return (
    <ToastProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </ToastProvider>
  );
}
