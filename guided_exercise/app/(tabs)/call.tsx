import { useRef, useState, useEffect } from "react";
import { EmitterSubscription, Text, View, StyleSheet, Button, TouchableOpacity } from "react-native";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EventType, VideoAspect, ZoomVideoSdkProvider, ZoomVideoSdkUser, ZoomView, useZoom } from "@zoom/react-native-videosdk"; 


export default function VideoCallScreen() {

  const zoom = useZoom();
  const [isInSession, setIsInSession] = useState(false);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {

      // add instructor to session
      const sessionJoinListener = zoom.addListener(EventType.onSessionJoin, async () => {
          const mySelf = await zoom.session.getMySelf();
          setUsers([mySelf]);
          setIsInSession(true);
      });

      // add students to session as they join
      const userJoinListener = zoom.addListener(EventType.onUserJoin, (data) => {
          setUsers((prev) => [...prev, ...data.remoteUsers]);
      });

      return () => {
        sessionJoinListener.remove();
        userJoinListener.remove();
      };
  }, [zoom]);

  const joinCall = async () => {
    try {
      await zoom.joinSession({ 
        sessionName: 'Daily Workout',
        userName: 'Your_display_name',
        token: 'Server_generated_token',
        audioOptions: { connect: true, mute: false},
        videoOptions: { localVideoOn: true },
        sessionIdleTimeoutMins: 3
      });
    } catch (e) {
      console.error('Join failed', e);
    }
  };

  return (
    <View style={styles.container}>
        {isInSession ? (
          <Button title="Join Meeting" onPress={joinCall} />
        ) : (
          <View style={styles.videoGrid}>
            {users.map((user) => (
              <ZoomView 
                key={user.userId}
                style={styles.videoView}
                userId={user.userId}
                fullScreen={users.length === 1}
              />
            ))}
          </View>
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  videoGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  videoView: { width: '100%', height: '100%' },
});