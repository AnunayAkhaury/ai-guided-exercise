import { Alert, Image, TouchableOpacity, View, ActivityIndicator, ScrollView, useWindowDimensions } from "react-native";
import BgImage from '@/src/assets/images/profile-background.png'; 
import ProfileImage from '@/src/assets/images/default-profile.jpg';
import { AntDesign, Entypo, Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useUserStore } from "@/src/store/userStore";
import Typography from "@/src/components/ui/Typography";
import { ReactNode, useState } from "react";
import { logout } from "@/src/api/Firebase/firebase-auth";
import { router } from "expo-router";
import { resolvePreferredDisplayName } from "@/src/utils/display-name";

function Button({ icon, title, onPress }: { icon: ReactNode, title: string, onPress?: () => void }) {
    return (
        <TouchableOpacity className="w-full flex flex-row p-5 justify-between items-center bg-[#F6F5F5]" onPress={onPress}>
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
    const fullname = useUserStore((state) => state.fullname);
    const role = useUserStore((state) => state.role);
    const email = useUserStore((state) => state.email);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const displayName = resolvePreferredDisplayName({
        fullname,
        username,
        fallback: 'User'
    });

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

    const handleComingSoon = (title: string) => {
        Alert.alert(title, 'This page is not wired up yet.');
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
                    {displayName}
                </Typography>
                <Typography font='inter-medium' className="text-[#666] mt-2">
                    {role === 'instructor' ? 'Instructor' : 'Student'}
                </Typography>
                {email ? (
                    <Typography font='inter-medium' className="text-[#888] mt-1 text-sm">
                        {email}
                    </Typography>
                ) : null}

                <Typography font='inter-medium' className="w-full text-start text-base mt-6 mb-3">Personal</Typography>
                <View className="w-full rounded-3xl overflow-hidden">
                    <Button icon={<MaterialIcons name="edit" size={17} color="black" />} title="Edit Profile" onPress={() => router.push('/edit-profile')} />
                    <View className="w-full h-[1px] bg-[#dadada]" />
                    <Button
                        icon={<Ionicons name="ribbon-sharp" size={17} color="black" />}
                        title="Achievements"
                        onPress={() => router.push('/(tabs)/profile/achievements')}
                    />
                    <View className="w-full h-[1px] bg-[#dadada]" />
                    <Button
                        icon={<Ionicons name="notifications-outline" size={17} color="black" />}
                        title="Notifications"
                        onPress={() => handleComingSoon('Notifications')}
                    />
                </View>

                <Typography font='inter-medium' className="w-full text-start text-base mt-6 mb-3">Other</Typography>
                <View className="w-full rounded-3xl overflow-hidden">
                    <Button
                        icon={<MaterialCommunityIcons name="hand-heart-outline" size={17} color="black" />}
                        title="Donate Page"
                        onPress={() => handleComingSoon('Donate Page')}
                    />
                    <View className="w-full h-[1px] bg-[#dadada]" />
                    <Button
                        icon={<AntDesign name="file-text" size={17} color="black" />}
                        title="Terms and Conditions"
                        onPress={() => handleComingSoon('Terms and Conditions')}
                    />
                    <View className="w-full h-[1px] bg-[#dadada]" />
                    <Button
                        icon={<Entypo name="star-outlined" size={18} color="black" />}
                        title="Rate App"
                        onPress={() => handleComingSoon('Rate App')}
                    />
                </View>

                <View className="w-full rounded-3xl overflow-hidden mt-8">
                    <TouchableOpacity className="w-full flex flex-row p-5 justify-between items-center bg-[#F6F5F5]" onPress={handleLogout} disabled={isLoggingOut}>
                        <View className="flex flex-row gap-4 justify-center items-center flex-1 pr-2">
                            <MaterialCommunityIcons name="logout" size={18} color="#FF0000" />
                            {isLoggingOut ? (
                                <ActivityIndicator color="#FF0000" />
                            ) : (
                                <Typography font='inter-medium' className="text-base flex-1 text-[#FF0000]">Logout</Typography>
                            )}
                        </View>
                        {!isLoggingOut ? <AntDesign name="right" size={12} color="#868686" /> : null}
                    </TouchableOpacity>
                </View>

                <View className={isSmallPhone ? "h-8" : "h-10"} />
            </View>
            </ScrollView>
            

        </View>
    );
}
