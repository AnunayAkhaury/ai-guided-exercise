import { View } from "react-native";
import Typography from "./Typography";

export default function Header({ title }: { title: string }) {
    return (
        <View className="w-full pt-8 pb-3 shadow bg-white flex items-center">
            <Typography font='inter-semibold' className="text-xl">{title}</Typography>
        </View>
    );
}