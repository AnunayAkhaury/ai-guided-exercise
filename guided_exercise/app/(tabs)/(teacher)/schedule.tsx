import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import BgImage from '@/src/assets/images/profile-background.png'; 
import ProfileImage from '@/src/assets/images/default-profile.jpg'; 
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { AntDesign, Entypo, Ionicons } from "@expo/vector-icons";


export default function Shedule() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>New Meeting</Text>
            <View style={styles.main}>
                <TextInput style={styles.input} placeholder="Meeting Title" />
                    
                <View style={styles.list}>
                    <View style={styles.listItem}>
                        <Entypo name="calendar" size={22} color="black" />
                        <TouchableOpacity>
                            <View style={styles.dropdownTrigger}>
                                <Text style={styles.listText}>{
                                    (new Date()).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    })
                                }</Text>
                                <AntDesign name="down" size={18} color="black" />
                            </View> 
                        </TouchableOpacity>
                    </View>

                    <View style={styles.listItem}>
                        <AntDesign name="clock-circle" size={22} color="black" />
                        <View style={styles.timeDropdowns}>
                            <TouchableOpacity>
                                <View style={styles.dropdownTrigger}>
                                    <Text style={styles.listText}>{
                                        (new Date()).toLocaleString('en-US', { 
                                            hour: 'numeric',
                                            minute: '2-digit',
                                            hour12: true
                                        })
                                    }</Text>
                                    <AntDesign name="down" size={18} color="black" />
                                </View> 
                            </TouchableOpacity>
                            <TouchableOpacity>
                                <View style={styles.dropdownTrigger}>
                                    <Text style={styles.listText}>{
                                        (new Date()).toLocaleString('en-US', { 
                                            hour: 'numeric',
                                            minute: '2-digit',
                                            hour12: true
                                        })
                                    }</Text>
                                    <AntDesign name="down" size={18} color="black" />
                                </View> 
                            </TouchableOpacity>
                            <TouchableOpacity>
                                <View style={styles.dropdownTrigger}>
                                    <Text style={styles.listText}>No Repeat</Text>
                                    <AntDesign name="down" size={18} color="black" />
                                </View> 
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.listItem}>
                        <Ionicons name="document-text-outline" size={24} color="black" />
                        <TextInput style={[styles.input, { height: 150, textAlignVertical: 'top', width: null, flexGrow: 1 } ]} placeholder="Add description" multiline numberOfLines={5} />
                    </View> 
                </View>

                <TouchableOpacity style={styles.submitBttn}>
                    <Text style={styles.bttnText}>Create Meeting</Text>
                </TouchableOpacity>
                <Text>This meeting will show up for all students</Text>
            </View>
            

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#ADEBF2',
    },
    title: {
        marginTop: 60,
        marginBottom: 20,
        fontSize: 24,
        fontWeight: '500',
        marginLeft: 10,
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
