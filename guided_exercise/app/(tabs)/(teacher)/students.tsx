import { Image, ScrollView, TextInput, TouchableOpacity, View, useWindowDimensions } from "react-native";
import DefaultImage from '@/src/assets/images/default-profile.jpg'; 
import { AntDesign, Ionicons } from "@expo/vector-icons";
import Header from "@/src/components/ui/Header";
import Gradient from '@/src/assets/images/RecordingsGradient.jpeg'; 
import Typography from "@/src/components/ui/Typography";


const students = [
    {id: 1, fullname: "Jane", profileImage: null},
    {id: 2, fullname: "Jacob", profileImage: null}
]

export default function Students() {
    const { width, height } = useWindowDimensions();
    const isSmallPhone = width < 380 || height < 760;
    return (
        <View className="flex-grow bg-white">
            <Header title="Students" />

            <ScrollView
                contentContainerStyle={{ paddingHorizontal: isSmallPhone ? 14 : 20, paddingVertical: isSmallPhone ? 14 : 20 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View className="flex flex-row justify-between items-center">
                    <View className="flex flex-row items-center bg-[#E6E6E6] flex-1 h-11 rounded-xl gap-1 pl-3 mr-2">
                        <Ionicons name="search-sharp" size={12} color="black" />
                        <TextInput
                            editable placeholder="Search name..."
                            className="flex-grow text-base"
                            style={{ fontFamily: 'Inter_400Regular' }}
                            placeholderTextColor="#000"
                        />
                    </View>
                    <TouchableOpacity>
                        <View className="relative flex flex-row items-center gap-1 p-2 rounded-xl overflow-hidden">
                            <Image
                                source={Gradient}
                                resizeMode="cover"
                                className="absolute flex-grow inset-0"
                            />
                            <AntDesign name="sort-ascending" size={16} color="black" />
                            <AntDesign name="down" size={14} color="black" />
                        </View>
                    </TouchableOpacity>
                </View>

                <View className="my-2 w-full bg-[#D3D3D3] h-[1px]" />

                <Typography font='inter-semibold' className="text-sm pb-3">{`${students.length} students`}</Typography>

                {students.map((student, idx) => 
                    <View key={student.id}>
                        {idx !== 0 && <View className="my-2 w-full bg-[#EFEFEF] h-[1px]" />}
                        <View className="flex flex-row justify-between items-center py-4">
                            <View className="flex flex-row items-center gap-3">
                                <Image
                                    source={student.profileImage ?? DefaultImage}
                                    resizeMode="cover"
                                    className="w-10 h-10 rounded-full"
                                />
                                <Typography font='inter-medium'>{student.fullname}</Typography>
                            </View>
                            <TouchableOpacity>
                                <Typography font='inter-semibold' className="py-1 px-3 text-[#FF0000] text-sm bg-[#B3B3B3] rounded-md">Remove</Typography>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    )
}
