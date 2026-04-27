import { Alert, Image, TouchableOpacity, View, ActivityIndicator, ScrollView, useWindowDimensions } from "react-native";
import BgImage from '@/src/assets/images/profile-background.png'; 
import ProfileImage from '@/src/assets/images/default-profile.jpg';
import { AntDesign, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useUserStore } from "@/src/store/userStore";
import Typography from "@/src/components/ui/Typography";
import { ReactNode, useState } from "react";
import { logout } from "@/src/api/Firebase/firebase-auth";
import { router } from "expo-router";

function Button({ icon, title }: { icon: ReactNode, title: string, }) {
    return (
        <TouchableOpacity className="w-full flex flex-row p-5 justify-between items-center bg-[#EDEDED]">
            <View className="flex flex-row gap-4 justify-center items-center flex-1 pr-2">
                {icon}
                <Typography font='inter-medium' numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} className="text-base flex-1">{title}</Typography>
            </View>
            <AntDesign name="right" size={12} color="#868686" />
        </TouchableOpacity>
    );
}

export default function Profile() {
    const { width, height } = useWindowDimensions();
    const isSmallPhone = width < 380 || height < 760;
    const topBannerHeight = isSmallPhone ? 180 : 208;
    const cardTopMargin = isSmallPhone ? 112 : 144;
    const avatarSize = isSmallPhone ? 110 : 126;
    const avatarTopOffset = Math.round(avatarSize * 0.55);
    const horizontalPadding = isSmallPhone ? 20 : 32;

    const username = useUserStore((state) => state.username);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = () => {
        if (isLoggingOut) return;
        Alert.alert('Log out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Log out',
                style: 'destructive',
                onPress: async () => {
                    try {
                        setIsLoggingOut(true);
                        await logout();
                        router.replace('/(onboarding)/login');
                    } catch (err: any) {
                        Alert.alert('Logout failed', err?.message || 'Unable to log out.');
                    } finally {
                        setIsLoggingOut(false);
                    }
                }
            }
        ]);
    };
    
    return (
        <View className="relative flex-1">
            <Image
                source={BgImage}
                resizeMode="cover"
                className="absolute inset-0 w-full"
                style={{ height: topBannerHeight }}
            />
            <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
            <View
                className="relative rounded-3xl w-full flex-grow flex flex-col items-center bg-white"
                style={{ marginTop: cardTopMargin, paddingHorizontal: horizontalPadding }}
            >
                <Image
                    source={ProfileImage}
                    resizeMode="cover"
                    className="absolute rounded-full shadow-lg"
                    style={{
                        width: avatarSize,
                        height: avatarSize,
                        top: -avatarTopOffset
                    }}
                />

                <Typography font='inter-medium' className={isSmallPhone ? "mt-16 text-3xl" : "mt-20 text-4xl"}>
                    {username ?? 'user'}
                </Typography>

                <Typography font='inter-medium' className="w-full text-start text-base mt-6 mb-3">Personal</Typography>
                <View className="w-full rounded-3xl overflow-hidden">
                    <Button icon={<MaterialIcons name="edit" size={17} color="black" />} title="Edit Profile" />
                    <View className="w-full h-[1px] bg-[#dadada]" />
                    <Button icon={<Ionicons name="ribbon-sharp" size={17} color="black" />} title="Achievements" />
                </View>

                <Typography font='inter-medium' className="w-full text-start text-base mt-6 mb-3">Other</Typography>
                <View className="w-full rounded-3xl overflow-hidden">
                    <Button icon={<Ionicons name="heart" size={17} color="black" />} title="Donate Page" />
                </View>

                <TouchableOpacity
                    className={isSmallPhone ? "mt-12 mb-8 min-h-8 justify-center" : "mt-24 mb-10 min-h-8 justify-center"}
                    onPress={handleLogout}
                    disabled={isLoggingOut}
                >
                    {isLoggingOut ? (
                        <ActivityIndicator color="#FF0000" />
                    ) : (
                        <Typography font='inter-bold' className="text-[#FF0000] text-lg">Logout</Typography>
                    )}
                </TouchableOpacity>
            </View>
            </ScrollView>
            

        </View>
    );
}
