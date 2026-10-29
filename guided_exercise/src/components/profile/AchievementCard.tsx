import { Image, View } from "react-native";
import Achievement from '@/src/assets/images/yellow-ribbon.png'
import Typography from "../ui/Typography";

export default function AchievementCard({
  title,
  desc,
} : {
  title: string,
  desc: string,
}) {
    return (
        <View className="flex flex-row w-[400px] max-w-full bg-purple-100 p-4 gap-4 self-center rounded-xl border-2 border-purple-200">
            <Image
                source={Achievement}
                resizeMode="contain"
                style={{ width: 80, height: 80 }}
            />

            <View className="flex flex-col gap-1">
                <Typography font='istokWeb-bold' className="text-2xl">{title}</Typography>
                <View className="w-full h-[2px] bg-yellow-500"/>
                <Typography font='istokWeb'>{desc}</Typography>
            </View>
        </View>
    );
}