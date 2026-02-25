import { ReactNode } from "react";
import { Text } from "react-native";
import {
  useFonts,
  Inter_400Regular,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

export default function Typography({ className, children, font='inter' } : {
    className?: string,
    children: ReactNode,
    font?: 'inter' | 'inter-bold',
}) {
    const [loaded, error] = useFonts({
        Inter_400Regular,
        Inter_700Bold,
    });

    return (
        <Text 
            className={` ${className}`} 
            style={font==='inter' ? { fontFamily: 'Inter_400Regular'} : { fontFamily: 'Inter_700Bold'}}
        >
            {children}
        </Text>
    );
}
