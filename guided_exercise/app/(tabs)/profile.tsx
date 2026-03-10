import { Alert, Image, TouchableOpacity, View, ActivityIndicator } from "react-native";
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
            <View className="flex flex-row gap-5 justify-center items-center">
                {icon}
                <Typography font='inter-medium' className="text-base">{title}</Typography>
            </View>
            <AntDesign name="right" size={12} color="#868686" />
        </TouchableOpacity>
    );
}

export default function Profile() {
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
        <View className="relative flex-grow">
            <Image
                source={BgImage}
                resizeMode="cover"
                className="absolute inset-0 w-full h-52"
            />
            <View className="relative rounded-3xl mt-36 w-full flex-grow flex flex-col items-center bg-white px-12">
                <Image
                    source={ProfileImage}
                    resizeMode="cover"
                    className="absolute w-[126px] h-[126px] top-[-69px] rounded-full shadow-lg "
                />

                <Typography font='inter-medium' className="mt-20 text-4xl">
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

                <TouchableOpacity className="mt-24 min-h-8 justify-center" onPress={handleLogout} disabled={isLoggingOut}>
                    {isLoggingOut ? (
                        <ActivityIndicator color="#FF0000" />
                    ) : (
                        <Typography font='inter-bold' className="text-[#FF0000] text-lg">Logout</Typography>
                    )}
                </TouchableOpacity>
            </View>
            

        </View>
    );
}
