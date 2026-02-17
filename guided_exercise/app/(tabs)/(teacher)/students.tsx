import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DefaultImage from '@/src/assets/images/default-profile.jpg'; 

const students = [
    {id: 1, fullname: "Jane", profileImage: null},
    {id: 2, fullname: "Jacob", profileImage: null}
]

export default function Students() {
    return (
        <View>
            {students.map((student) => 
                <View key={student.id} style={styles.container}>
                    <View style={styles.content}>
                        <Image
                            source={student.profileImage ?? DefaultImage}
                            resizeMode="cover"
                            style={styles.profileImage}
                        />
                        <Text style={styles.name}>{student.fullname}</Text>
                    </View>
                    <TouchableOpacity>
                        <Text style={styles.deleteBttn}>Delete</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    main: {
        marginTop: 150,
        width: '100%',
        height: '100%',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 20,
    },
    container: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
    },
    content: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    profileImage: {
        width: 50,
        height: 50,
        borderRadius: 25
    },
    name: {
        fontSize: 20,
    },
    deleteBttn: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'red',
        padding: 10,
        paddingTop: 5,
        paddingBottom: 5,
        borderRadius: 10,
        fontSize: 16,
        color: 'white'
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
