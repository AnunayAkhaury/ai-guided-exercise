import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DefaultImage from '@/src/assets/images/default-profile.jpg'; 
import { AntDesign } from "@expo/vector-icons";

const students = [
    {id: 1, fullname: "Jane", profileImage: null},
    {id: 2, fullname: "Jacob", profileImage: null}
]

export default function Students() {
    return (
        <View style={styles.main}>
            <Text style={styles.title}>Manage Students</Text>

            <TouchableOpacity>
                <View style={styles.dropdownTrigger}>
                    <AntDesign name="sort-ascending" size={24} color="black" />
                    <AntDesign name="down" size={14} color="black" />
                </View>
            </TouchableOpacity>

            <View style={styles.divider} />

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
                        <Text style={styles.deleteBttn}>Remove</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    main: {
        padding: 20,
        paddingTop: 50,
        width: '100%',
        height: '100%',
        backgroundColor: 'white',
    },
    title: {
        fontSize: 24,
        color: '#00C8B3',
    },
    dropdownTrigger: {
        display: 'flex',
        flexDirection: 'row',
        alignSelf: 'flex-end',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#FEF8FF',
        padding: 8,
        borderRadius: 10
    },
    divider: {
        width: '100%',
        borderWidth: 0.5,
        borderColor: 'grey',
        marginVertical: 20,
    },
    container: {
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 13,
        paddingHorizontal: 17,
        backgroundColor: '#EAFBFF',
        borderRadius: 8,
        marginBottom: 20,
        // Soft shadow for modern look
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
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

})
