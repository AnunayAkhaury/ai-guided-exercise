import { Image, TouchableOpacity, View } from "react-native";
import Typography from "../ui/Typography";
import ActiveClassBg from '@/src/assets/images/ActiveClassBg.jpg'; 
import { AntDesign } from "@expo/vector-icons";

export default function TeacherActiveClassCard({
  start,
  end,
  title,
  desc,
  onStartPress,
} : {
  start: Date,
  end: Date,
  title: string,
  desc: string,
  active: boolean,
  onStartPress?: () => void,
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
            <Typography font='istokWeb-bold' className="text-xl self-start">{title}</Typography>
    
            <Typography font='istokWeb' className="w-full text-start">with Instructor John</Typography>
            <View className="w-full flex flex-row justify-start items-center gap-1">
                <AntDesign name="field-time" size={17} color="black" />
                <Typography font='istokWeb' className=" text-wrap text-base">
                    {`${startTime}-${endTime}`}
                </Typography>
            </View>
            <Typography font='istokWeb' className="w-full text-start text-wrap pb-2">{desc}</Typography>
            
            <View className="flex flex-row items-center gap-3">
              <TouchableOpacity onPress={onStartPress}>
                <Typography font='inter-bold' className="text-base px-9 py-2 text-white bg-[#A980FE] rounded-xl">Start Meeting</Typography>
              </TouchableOpacity>
              <TouchableOpacity>
                <Typography font='inter-bold' className="text-sm px-3 py-2 text-white bg-[#FF0000] rounded-xl">Cancel</Typography>
              </TouchableOpacity>
            </View>
        </View>
      </View>
    );
}
