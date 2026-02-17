import { File, Directory, Paths } from "expo-file-system";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import { Button, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

/*
<ZoomVideoSdkProvider
  config={{
    domain: "zoom.us",
    enableLog: true,
  }}
>
</ZoomVideoSdkProvider>
*/

export default function Classes() {
  const [permission, requestPermission] = useCameraPermissions();
  const [recording, setRecording] = useState(false);
  const ref = useRef<CameraView>(null);

  if (!permission) {
    return <View />; // default view while permissions load
  }

  // request camera permissions from user
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}> We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }
  
  // record video from camera
  const recordVideo = async () => {
    if (recording) {
      setRecording(false);
      ref.current?.stopRecording();

      return;
    }
    setRecording(true);
    const video = await ref.current?.recordAsync();
    console.log({video});
  };

  // save video to app storage
  async function saveVideo(tempURI: string) {
    try {
      const recordingsDir = new Directory(Paths.document, 'recordings');

      if (!recordingsDir.exists) {
        recordingsDir.create();
      }

      const tempFile = new File(tempURI);
      tempFile.move(recordingsDir);
      console.log("Video permanently saved at: ", tempFile.uri);
      return tempFile.uri;
    } catch (e) {
      console.error("Failed to save video: ", e);
    }
  }

  // render camera view
  // will change record button to a syncronized toggle from livestream in future update
  const renderCamera = () => {
    return (
      <View style={styles.container}>
        <CameraView style={styles.camera} facing={'front'} mirror={true} mode={'video'} mute={true} ref={ref}/>
        <View style={styles.buttonContainer}>
          <Pressable style={styles.button} onPress={recordVideo}>
            {({ pressed }) => (
              <Text style=
                {[
                  recording ? styles.squareRecordButton : styles.circleRecordButton, 
                  { opacity: pressed ? 0.5 : 1 },
                ]}></Text>
            )}
          </Pressable>
            
        </View>
              
      </View>
    );
  };

  return renderCamera();
  

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 64,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    width: '100%',
    paddingHorizontal: 64,
  },
  button: {
    flex: 1,
    alignItems: 'center',
  },
  circleRecordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
  },
  squareRecordButton: {
    width: 48,
    height: 48,
    borderRadius: 5,
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 13,
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
});
