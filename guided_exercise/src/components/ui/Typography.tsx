import { ReactNode } from "react";
import { Text, TextProps } from "react-native";

interface TypographyProps extends TextProps {
    font?: 'inter' | 'inter-medium' | 'inter-semibold' | 'inter-bold' | 'istokWeb' | 'istokWeb-bold',
    children: ReactNode,
}

export default function Typography({ font='inter', children, ...props } : TypographyProps) {
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
