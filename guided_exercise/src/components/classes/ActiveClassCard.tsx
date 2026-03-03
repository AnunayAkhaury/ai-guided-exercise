import { Image, TouchableOpacity, View } from "react-native";
import Typography from "../ui/Typography";
import ActiveClassBg from '@/src/assets/images/ActiveClassBg.jpg'; 
import { AntDesign, MaterialCommunityIcons } from "@expo/vector-icons";

export default function ActiveClassCard({
  start,
  end,
  title,
  desc,
} : {
  start: Date,
  end: Date,
  title: string,
  desc: string,
  active: boolean,
}) {
    const startTime = start.toLocaleString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    const endTime = end.toLocaleString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    return (
      <View className="relative w-full rounded-xl shadow-md shadow-black bg-white mb-3 overflow-hidden">
        
        <Image
          source={ActiveClassBg}
          resizeMode="cover"
          className="absolute w-full h-full inset-0"
        />

        <View className="w-full p-5 px-5 flex flex-col justify-center items-center">
            <View className="w-full flex flex-row justify-between">
                <Typography font='istokWeb-bold' className="text-xl">{title}</Typography>
                <View className="flex flex-row justify-center items-center bg-[#FF0000] px-2 rounded-xl">
                    <Typography className="text-white text-sm">Live</Typography>
                    <MaterialCommunityIcons name="signal-variant" size={10} color="white" />
                </View>
            </View>
            <Typography font='istokWeb' className="w-full text-start">with Instructor John</Typography>
            <View className="w-full flex flex-row justify-start items-center gap-1">
                <AntDesign name="field-time" size={17} color="black" />
                <Typography font='istokWeb' className=" text-wrap text-base">
                    {`${startTime}-${endTime}`}
                </Typography>
            </View>
            <Typography font='istokWeb' className="w-full text-start text-wrap pb-2">{desc}</Typography>

            <TouchableOpacity>
                <Typography font='inter-bold' className="text-base px-9 py-2 text-white bg-[#A980FE] rounded-xl">Join Meeting</Typography>
            </TouchableOpacity>
        </View>
      </View>
    );
}
