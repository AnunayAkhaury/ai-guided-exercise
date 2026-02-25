import { ReactNode } from "react";
import { Text, TextProps, View } from "react-native";
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

interface TypographyProps extends TextProps {
    font?: 'inter' | 'inter-medium' | 'inter-semibold' | 'inter-bold' | 'istokWeb' | 'istokWeb-bold',
    children: ReactNode,
}

export default function Typography({ font='inter', children, ...props } : TypographyProps) {
    const [interLoaded, interError] = useFontsInter({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
    });

    const [istokWebLoaded, istokWebError] = useFontsIstokWeb({
        IstokWeb_400Regular,
        IstokWeb_700Bold,
    });

    if ((!interLoaded && !interError) || (!istokWebLoaded && !istokWebError)) {
        return <View />
    }

    return (
        <Text 
            style={
                font==='inter' ? { fontFamily: 'Inter_400Regular'}
                : font==='inter-medium' ? { fontFamily: 'Inter_500Medium'}
                : font==='inter-semibold' ? { fontFamily: 'Inter_600SemiBold'}
                : font==='inter-bold' ? { fontFamily: 'Inter_700Bold'}
                : font==='istokWeb' ? { fontFamily: 'IstokWeb_400Regular'}
                : { fontFamily: 'IstokWeb_700Bold'}
            }
            {...props}
        >
            {children}
        </Text>
    );
}
