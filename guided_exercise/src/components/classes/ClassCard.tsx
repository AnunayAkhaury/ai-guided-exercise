import { View } from "react-native";
import Typography from "../ui/Typography";

export default function ClassCard({
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
    const month = start.toLocaleString('en-US', { month: 'short' });
    const day = start.getDate();
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
    const formatted = start.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return (
      <View className="w-full flex flex-row justify-center items-center p-5 px-2 rounded-xl shadow bg-white gap-2 mb-3">
        <View className="bg-[#E1D5FF] rounded-md flex flex-col justify-center w-20 h-20 overflow-hidden">
          <Typography font='istokWeb-bold' className="text-[13px] h-6 text-center">8:00 AM</Typography>
          <Typography
            font='istokWeb-bold'
            className="flex-grow bg-[#6B00C8] align-middle text-center text-base text-white"
          >
            {`${month} ${day}`}
          </Typography>
        </View>

        <View className="flex-grow">
            <Typography font='istokWeb-bold' className="text-xl">{title}</Typography>
            <Typography font='istokWeb' className=" text-wrap text-base">
              {`${formatted}  ${startTime} - ${endTime}`}
            </Typography>
            <Typography font='istokWeb' className="text-base">{desc}</Typography>
        </View>
      </View>
    );
}
