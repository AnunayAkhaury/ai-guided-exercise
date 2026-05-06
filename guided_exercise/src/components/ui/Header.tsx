import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import Typography from "./Typography";

type HeaderProps = {
    title: string;
    showBack?: boolean;
    onBack?: () => void;
    backFallback?: Parameters<ReturnType<typeof useRouter>["replace"]>[0];
};

export default function Header({ title, showBack = false, onBack, backFallback }: HeaderProps) {
    const router = useRouter();
    const handleBack = () => {
        if (onBack) {
            onBack();
            return;
        }
        if (router.canGoBack()) {
            router.back();
            return;
        }
        if (backFallback) {
            router.replace(backFallback);
        }
    };

    return (
        <View className="w-full pt-8 pb-3 shadow bg-white flex items-center" style={styles.header}>
            {showBack ? (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                    onPress={handleBack}
                    style={styles.backButton}
                >
                    <Typography font='inter-semibold' style={styles.backText}>Back</Typography>
                </Pressable>
            ) : null}
            <Typography font='inter-semibold' className="text-xl">{title}</Typography>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        position: 'relative',
        minHeight: 64,
        justifyContent: 'flex-end'
    },
    backButton: {
        position: 'absolute',
        left: 16,
        bottom: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: '#F0ECFF'
    },
    backText: {
        color: '#6155F5',
        fontSize: 14
    }
});
