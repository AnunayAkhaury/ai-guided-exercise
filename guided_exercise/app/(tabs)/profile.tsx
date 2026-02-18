import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import BgImage from '@/src/assets/images/profile-background.png'; 
import ProfileImage from '@/src/assets/images/default-profile.jpg'; 
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { AntDesign, Ionicons } from "@expo/vector-icons";
import { useUserStore } from "@/src/store/userStore";


export default function Profile() {
    const fullname = useUserStore((state) => state.fullname);
    const role = useUserStore((state) => state.role);
    
    return (
        <View>
            <Image
                source={BgImage}
                resizeMode="cover"
                style={styles.bgImage}
            />
            <View style={styles.main}>
                <Image
                    source={ProfileImage}
                    resizeMode="cover"
                    style={styles.profileImage}
                />

                <TextInput style={styles.username} editable={false}>{fullname ?? 'User'}</TextInput>

                <TouchableOpacity style={styles.editButton}>
                    <Text style={{fontSize: 18}}>Edit Details</Text>
                    <MaterialIcons name="edit" size={24} color="black" />
                </TouchableOpacity>
                    
                <View style={styles.list}>
                    {role!=='instructor' && <TouchableOpacity style={styles.listItem}>
                        <Ionicons name="ribbon" size={24} color="black" />
                        <Text style={styles.listText}>Achievements</Text>
                    </TouchableOpacity>}

                    {role!=='instructor' && <TouchableOpacity style={styles.listItem}>
                        <AntDesign name="line-chart" size={24} color="black" />
                        <Text style={styles.listText}>Stats</Text>
                    </TouchableOpacity>}

                    <TouchableOpacity style={styles.listItem}>
                        <MaterialCommunityIcons name="heart-circle" size={24} color="black" />
                        <Text style={styles.listText}>Donate</Text>
                    </TouchableOpacity>

                    <TouchableOpacity>
                        <Text style={[styles.listText, styles.logout]}>Logout</Text>
                    </TouchableOpacity>  
                </View>
            </View>
            

        </View>
    );
}

const styles = StyleSheet.create({
    bgImage: {
        width: '100%',
        height: 200,
        position: 'absolute'
    },
    main: {
        marginTop: 150,
        width: '100%',
        height: '100%',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 20,
    },
    profileImage: {
        position: 'absolute',
        top: -78,
        width: 156,
        height: 156,
        borderRadius: 156,
        borderWidth: 1,
        borderColor: 'white'
    },
    username: {
        fontSize: 30,
        marginTop: 90,
        fontWeight: '500',
    },
    editButton: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#C3F5FF',
        padding: 20,
        paddingTop: 5,
        paddingBottom: 5,
        borderRadius: 8,
    },
    list: {
        width: '100%',
        display: 'flex',
        paddingTop: 50,
        paddingHorizontal: 12,
        gap: 20,
    },
    listItem: {
        width: '100%',
        padding: 20,
        paddingTop: 18,
        paddingBottom: 16,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderRadius: 8,
        backgroundColor: 'white',
        // Soft shadow for modern look
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    listText: {
        fontSize: 20,
    },
    logout: {
        color: 'red',
        alignSelf: 'center',
        marginTop: 30,
    },
})
