import { Image, View } from "react-native";
import AchievementIcon from '@/src/assets/images/AchievementIcon.png'
import Typography from "../ui/Typography";

export default function AchievementCard({
  title,
  desc,
} : {
  title: string,
  desc: string,
}) {
    return (
        <View className="flex flex-row w-full bg-[#C3F5FF] p-4 gap-4">
            <Image
                source={AchievementIcon}
                resizeMode="contain"
                className="h-20 w-20"
            />

            <View className="flex flex-col">
                <Typography font='istokWeb-bold' className="text-2xl">{title}</Typography>
                <Typography font='istokWeb'>{desc}</Typography>
            </View>
        </View>
    );
}