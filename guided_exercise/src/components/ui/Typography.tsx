import { ReactNode } from "react";
import { Text } from "react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_700Bold,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';

export default function Typography({ className, children, font='inter' } : {
    className?: string,
    children: ReactNode,
    font?: 'inter' | 'inter-medium' | 'inter-semibold' | 'inter-bold',
}) {
    const [loaded, error] = useFonts({
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
        Inter_700Bold,
    });

    return (
        <Text 
            className={` ${className}`} 
            style={
                font==='inter' ? { fontFamily: 'Inter_400Regular'}
                : font==='inter-medium' ? { fontFamily: 'Inter_500Medium'}
                : font==='inter-semibold' ? { fontFamily: 'Inter_600SemiBold'}
                : { fontFamily: 'Inter_700Bold'}
            }
        >
            {children}
        </Text>
    );
}
