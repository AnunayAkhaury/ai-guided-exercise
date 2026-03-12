import { Image, TouchableOpacity, View } from "react-native";
import BgImage from '@/src/assets/images/ActiveClassBg.jpg'; 
import ProfileImage from '@/src/assets/images/default-profile.jpg';
import { AntDesign, Entypo, FontAwesome5, Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useUserStore } from "@/src/store/userStore";
import Typography from "@/src/components/ui/Typography";
import { ReactNode } from "react";
import { Href, Link } from "expo-router";

function Button({ icon, title, link, variant='default' }: { icon: ReactNode, title: string, link?: Href, variant?: 'default' | 'destructive' }) {
    return (
        <Link href={link ?? '/profile/profile'} asChild>
            <TouchableOpacity className="w-full flex flex-row p-5 justify-between items-center bg-[#F6F5F5]">
                <View className="flex flex-row gap-5 justify-center items-center">
                    {icon}
                    <Typography font='inter-medium' className={["text-base ", variant==="destructive" && "text-red-500"].join()}>{title}</Typography>
                </View>
                <AntDesign name="right" size={12} color="#868686" />
            </TouchableOpacity>
        </Link>
    );
}

export default function Profile() {
    const username = useUserStore((state) => state.username);
    
    return (
        <View className="relative flex-grow">
            <Image
                source={BgImage}
                resizeMode="cover"
                className="absolute inset-0 w-full h-52"
            />
            <View className="relative rounded-3xl mt-36 w-full flex-grow flex flex-col items-center bg-white px-7">
                <Image
                    source={ProfileImage}
                    resizeMode="cover"
                    className="absolute w-[126px] h-[126px] top-[-69px] rounded-full shadow-lg "
                />

                <Typography font='inter-medium' className="mt-20 text-4xl">
                    {username ?? 'user'}
                </Typography>

                <Typography font='inter-medium' className="w-full text-start text-xs mt-6 mb-3 text-[#737373]">PERSONAL</Typography>
                <View className="w-full rounded-3xl overflow-hidden flex flex-col items-center bg-[#F6F5F5]">
                    <Button icon={<FontAwesome5 name="edit" size={17} color="black" />} title="Edit Profile" />
                    <View className="w-[90%] h-[1px] bg-[#dadada]" />
                    <Button icon={<AntDesign name="trophy" size={17} color="black" />} title="Achievements" link="/(tabs)/profile/achievements" />
                    <View className="w-[90%] h-[1px] bg-[#dadada]" />
                    <Button icon={<AntDesign name="bell" size={17} color="black" />} title="Notifications" />
                </View>

                <Typography font='inter-medium' className="w-full text-start text-xs mt-6 mb-3 text-[#737373]">OTHER</Typography>
                <View className="w-full rounded-3xl overflow-hidden flex flex-col items-center bg-[#F6F5F5]">
                    <Button icon={<MaterialCommunityIcons name="hand-heart-outline" size={17} color="black" />} title="Donate Page" />
                    <View className="w-[90%] h-[1px] bg-[#dadada]" />
                    <Button icon={<AntDesign name="file-text" size={17} color="black" />} title="Terms and Conditions" />
                    <View className="w-[90%] h-[1px] bg-[#dadada]" />
                    <Button icon={<Entypo name="star-outlined" size={18} color="black" />} title="Rate App" />
                </View>

                <View className="w-full rounded-3xl overflow-hidden mt-8">
                    <Button icon={<MaterialCommunityIcons name="logout" size={17} color="red" />} title="Logout" variant="destructive" />
                </View>
            </View>
            

        </View>
    );
}
