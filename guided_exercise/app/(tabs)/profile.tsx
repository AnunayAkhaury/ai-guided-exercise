import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import BgImage from '@/src/assets/images/profile-background.png'; 
import ProfileImage from '@/src/assets/images/default-profile.jpg';
import { AntDesign, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useUserStore } from "@/src/store/userStore";
import Typography from "@/src/components/ui/Typography";
import { ReactNode } from "react";

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
    const fullname = useUserStore((state) => state.fullname);
    const role = useUserStore((state) => state.role);
    
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
                    {fullname ?? 'User'}
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

                <TouchableOpacity className="mt-24">
                    <Typography font='inter-bold' className="text-[#FF0000] text-lg">Logout</Typography>
                </TouchableOpacity>
            </View>
            

        </View>
    );
}
