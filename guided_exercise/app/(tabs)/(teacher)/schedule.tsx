import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import Header from "@/src/components/ui/Header";
import Typography from "@/src/components/ui/Typography";


function Dropdown({ title } : { title: string }) {
    return (
        <TouchableOpacity className="flex flex-row items-center rounded-lg border-[1px] border-[#CACCD2] py-2 px-3 gap-1">
            <Typography font="istokWeb" className="text-sm">{title}</Typography>
            <AntDesign name="down" size={12} color="#D9D9D9" />
        </TouchableOpacity>
    );
}

export default function Shedule() {
    return (
        <View className="flex-grow bg-white">
            <Header title="New Meeting" />
            <View className="flex-grow pt-10 px-6">
                <Typography font='inter-semibold' className="self-start pb-1">Title</Typography>
                <TextInput
                    className="w-80 text-base border-[1px] border-[#CACCD2] rounded-lg pl-7"
                    placeholder="Meeting Title"
                    placeholderTextColor="#919191"
                    style={{fontFamily: 'Inter_400Regular'}}
                />
                
                <Typography font='inter-semibold' className="self-start pt-7 pb-1">Timing</Typography>
                <View className="w-full flex flex-col gap-5">
                    <View className="self-start flex flex-row items-center rounded-lg border-[1px] border-[#CACCD2] bg-[#CACCD2] overflow-hidden">
                        <View className="flex items-center pl-3 pr-1">
                            <Ionicons name="calendar-clear-sharp" size={16} color="#9C9C9C" />
                        </View>
                        <TouchableOpacity>
                            <Typography font="istokWeb" className="text-sm py-2 px-3 bg-white">
                                {(new Date()).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </Typography>
                        </TouchableOpacity>
                    </View>

                    <View className="flex flex-row gap-7">
                        <Dropdown
                            title={(new Date()).toLocaleString('en-US', { 
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                            })}
                        />
                        <Dropdown
                            title={(new Date()).toLocaleString('en-US', { 
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true
                            })}
                        />        
                    </View>
                    
                    <View className="self-start">
                        <Dropdown title="No Repeat" />
                    </View>
                </View>

                <Typography font='inter-semibold' className="self-start pt-7 pb-1">More info</Typography>
                <TextInput className="w-96 text-base border-[1px] border-[#CACCD2] rounded-lg pl-7 h-40 align-top" placeholder="Add description" multiline numberOfLines={5} />

                <TouchableOpacity className="mt-20">
                    <Typography font='inter-medium' className="self-center px-10 py-3 bg-[#6155F5] text-white rounded-lg">Create Meeting</Typography>
                </TouchableOpacity>
                <Typography className="self-center text-xs pt-3">Meeting link will be active 10 min before</Typography>
            </View>
            

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#C3F5FF',
    },
    title: {
        marginTop: 80,
        marginBottom: 10,
        fontSize: 24,
        fontWeight: '600',
        marginLeft: 20,
    },
    main: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        paddingTop: 44,
    },
    input: {
        fontSize: 18,
        lineHeight: 20,        
        width: '100%',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 10,
        borderColor: '#CACCD2',
        marginBottom: 20,
    },
    list: {
        width: '100%',
        display: 'flex',
        gap: 20,
    },
    listItem: {
        width: '100%',
        paddingRight: 10,
        paddingTop: 18,
        paddingBottom: 16,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16,
        borderRadius: 8,
        backgroundColor: 'white',
    },
    listText: {
        fontSize: 18,
    },
    dropdownTrigger: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#CACCD2',
        padding: 5,
        borderRadius: 8,
        gap: 5
    },
    timeDropdowns: {
        display: 'flex',
        flexDirection: 'row',
        gap: 20,
        flexWrap: 'wrap'
    },
    submitBttn: {
        marginTop: 54,
        width: '80%',
        backgroundColor: '#00C8B3',
        borderRadius: 10,
        padding: 11,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    },
    bttnText: {
        fontSize: 16,
        color: 'white',
        fontWeight: '500',
    }
})
