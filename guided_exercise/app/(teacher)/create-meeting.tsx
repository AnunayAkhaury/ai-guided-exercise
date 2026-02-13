import { Button, StyleSheet, Text, TextInput, View } from "react-native";

export default function CreateMeeting() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>New Meeting</Text>
            <View style={styles.main}>
                <View>
                    <Text>Meeting Title</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Add Title"
                        />
                    </View>
                </View>

                <View>
                    <Text>Time</Text>
                    <View style={{display: 'flex', flexDirection: 'row', gap: 20}}>
                        <View style={styles.smallInputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="Start"
                            />
                        </View>
                        <Text>_</Text>
                        <View style={styles.smallInputContainer}>
                            <TextInput
                                style={styles.input}
                                placeholder="End"
                            />
                        </View>
                    </View>
                </View>

                <View>
                    <Text>Recurrence</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Repeat On"
                        />
                    </View>
                </View>

                <View>
                    <Text>Description</Text>
                    <View style={styles.largeInputContainer}>
                        <TextInput 
                            style={[styles.input, {height: 200, justifyContent: 'flex-start', alignItems: 'flex-start', textAlignVertical: 'top',}]}
                            multiline
                            placeholder="Add Description"
                        />
                    </View>
                </View>

                <View style={{marginTop: 50}}>
                    <Button title="Create Meeting" />
                </View>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white'
  },
  title: {
    fontSize: 25,
    padding: 20,
    color: '#00C8B3',
  },
  main: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EAFBFF',
    borderRadius: 20,
    padding: 20,
    gap: 20,
  },
  inputContainer: {
    width: '70%',
    alignItems: 'flex-start'
  },
  smallInputContainer: {
    width: '40%',
  },
  largeInputContainer: {
    width: '100%',
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 5,
    height: 40,
    width: '100%',
    color: 'black',
    fontSize: 18,
  },
  button: {
    marginTop: 15,
    backgroundColor: '#00C8B3',
    paddingHorizontal: 30,
    paddingVertical: 5,
    borderRadius: 6
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600'
  },
  linkText: {
    textDecorationLine: 'underline',
    color: 'blue'
  }
});
