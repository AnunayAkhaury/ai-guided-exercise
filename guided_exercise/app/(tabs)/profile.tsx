import { Button, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import BgImage from '@/src/assets/images/profile-background.png'; 
import ProfileImage from '@/src/assets/images/default-profile.jpg'; 
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useState } from 'react';
import { getZoomToken } from '@/src/api/zoom';


export default function Profile() {
    const [status, setStatus] = useState<string>('');

    const handleTestToken = async () => {
        try {
        setStatus('Requesting token...');
        const token = await getZoomToken({ sessionName: 'test-session', userName: 'teacher' });
        console.log('Zoom token:', token);
        setStatus('Token received. Check console output.');
        } catch (err: any) {
        console.error('Token request failed:', err);
        setStatus(err?.message || 'Token request failed.');
        }
    };
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

                <TextInput style={styles.username} editable={false}>Username</TextInput>

                <TouchableOpacity style={styles.editButton}>
                    <Text style={{fontSize: 18}}>Edit User Details</Text>
                    <MaterialIcons name="edit" size={24} color="black" />
                </TouchableOpacity>

                <Text style={styles.title}>(Development Only)</Text>
                <Button title="Test Zoom Token" onPress={handleTestToken} />
                {!!status && <Text style={styles.status}>{status}</Text>}
                    
                <View style={styles.list}>
                    <View style={styles.listItem}>
                        <MaterialCommunityIcons name="medal" size={24} color="black" />
                        <Text style={styles.listText}>Achievements</Text>
                    </View>
                    <View style={styles.listItem}>
                        <MaterialCommunityIcons name="chart-line" size={24} color="black" />
                        <Text style={styles.listText}>Stats</Text>
                    </View>
                    <View style={styles.listItem}>
                        <MaterialCommunityIcons name="heart-circle" size={24} color="black" />
                        <Text style={styles.listText}>Donate</Text>
                    </View>
                    <View style={styles.listItem}>
                        <Text style={[styles.listText, {color: 'red'}]}>Logout</Text>
                    </View>  
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
        borderRadius: 156
    },
    username: {
        fontSize: 30,
        marginTop: 80,
    },
    editButton: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'lightblue',
        padding: 10,
        paddingTop: 5,
        paddingBottom: 5,
        borderRadius: 5,
        borderColor: 'black',
        borderWidth: 1,
    },
    list: {
        width: '100%',
        display: 'flex',
        paddingTop: 50,
    },
    listItem: {
        borderBottomWidth: 1,
        borderBottomColor: 'lightgrey',
        padding: 30,
        display: 'flex',
        flexDirection: 'row',
        gap: 10,
    },
    listText: {
        fontSize: 20,
    },
    title: {
        fontSize: 18,
        fontWeight: '600'
    },
    status: {
        marginTop: 8
    }
})
