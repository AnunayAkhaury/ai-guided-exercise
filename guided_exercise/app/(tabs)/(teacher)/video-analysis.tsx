import { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { processVideo, isAvailable } from 'quickpose-post-processor';
import { Directory, File, Paths } from 'expo-file-system';
import { fetchVideoUrl } from '@/src/api/AWS/aws-s3';
import { useVideoPlayer, VideoView } from 'expo-video';

const QUICKPOSE_SDK_KEY = process.env.QUICKPOSE_API_KEY || '';

type State =
  | { status: 'idle' }
  | { status: 'processing'; progress: number }
  | { status: 'done'; feedbacks: string[] }
  | { status: 'error'; message: string };

export default function VideoAnalysis() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'idle' });
  //   const [outputUri, setOutputUri] = useState<string | null>(null);

  //   const player = useVideoPlayer({
  //     uri: outputUri ?? undefined
  //   });

  // iOS only
  if (Platform.OS !== 'ios') {
    return (
      <View style={styles.container}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.title}>Video Analysis</Text>
        <Text style={styles.notSupported}>Video analysis with QuickPose is only available on iOS devices.</Text>
      </View>
    );
  }

  // Analyse
  const handleAnalyze = useCallback(async () => {
    if (!isAvailable()) {
      setState({
        status: 'error',
        message:
          'QuickPose native module is not available. Run `expo prebuild` to generate the iOS project with the QuickPose SDK linked.'
      });
      return;
    }

    setState({ status: 'processing', progress: 0 });

    try {
      // Ensure bundled asset is copied to the local filesystem

      // Note: Video key's should be uuid keys (unique identifiers)
      const videoKey = '5f27ec3b-bb61-42fc-a0e8-34dcfcf8b2ea';

      const videoUrl = await fetchVideoUrl(videoKey);

      const destination = new Directory(Paths.cache, 'videos');
      await destination.create({ idempotent: true });

      const output = await File.downloadFileAsync(videoUrl, destination);
      //   setOutputUri(output.uri);

      if (!isAvailable()) {
        setState({
          status: 'error',
          message:
            'QuickPose native module is not available. Run `expo prebuild` to generate the iOS project with the QuickPose SDK linked.'
        });
        return;
      }

      const result = await processVideo(output.uri, QUICKPOSE_SDK_KEY, (progress) => {
        setState({ status: 'processing', progress });
      });

      setState({
        status: 'done',
        feedbacks: result.feedbacks.length > 0 ? result.feedbacks : ['No form corrections detected – great work!']
      });

      if (output) {
        output.delete();
      }
    } catch (err: any) {
      setState({ status: 'error', message: err?.message ?? 'Processing failed.' });
    }
  }, []);

  const handleReset = useCallback(() => setState({ status: 'idle' }), []);

  // Render
  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Video Analysis</Text>
      <Text style={styles.subtitle}>
        Process the exercise test video on-device and receive written form feedback from QuickPose.
      </Text>

      {/* Video card */}
      <View style={styles.videoCard}>
        <Text style={styles.videoCardLabel}>Test Video</Text>
        <Text style={styles.videoCardName}>exercise-test.mp4</Text>
      </View>

      {/* {outputUri && <VideoView key={outputUri} player={player} style={{ width: '100%', height: 200 }} />} */}

      {/* Idle: analyse button */}
      {state.status === 'idle' && (
        <Pressable style={styles.button} onPress={handleAnalyze}>
          <Text style={styles.buttonText}>Analyse Exercise</Text>
        </Pressable>
      )}

      {/* Processing */}
      {state.status === 'processing' && (
        <View style={styles.processingBox}>
          <ActivityIndicator size="large" color="#00C8B3" />
          <Text style={styles.progressText}>Analysing… {state.progress}%</Text>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${state.progress}%` }]} />
          </View>
          <Text style={styles.processingNote}>Processing on-device – no data leaves your phone.</Text>
        </View>
      )}

      {/* Results */}
      {state.status === 'done' && (
        <View style={styles.resultsBox}>
          <Text style={styles.resultsTitle}>Form Feedback</Text>
          <Text style={styles.resultsSubtitle}>QuickPose detected the following corrections across your video:</Text>
          {state.feedbacks.map((msg, i) => (
            <View key={i} style={styles.feedbackItem}>
              <Text style={styles.feedbackBullet}>•</Text>
              <Text style={styles.feedbackText}>{msg}</Text>
            </View>
          ))}
          <Pressable style={[styles.button, styles.resetButton]} onPress={handleReset}>
            <Text style={styles.buttonText}>Analyse Again</Text>
          </Pressable>
        </View>
      )}

      {/* Error */}
      {state.status === 'error' && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{state.message}</Text>
          <Pressable style={[styles.button, styles.resetButton]} onPress={handleReset}>
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 40,
    backgroundColor: '#C3F5FF',
    gap: 16
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 16
  },
  backText: {
    fontSize: 14,
    fontWeight: '600'
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center'
  },
  subtitle: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    lineHeight: 20
  },
  notSupported: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginTop: 24
  },
  videoCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    gap: 4
  },
  videoCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase'
  },
  videoCardName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#222'
  },
  button: {
    backgroundColor: '#6155F5',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center'
  },
  resetButton: {
    marginTop: 8,
    backgroundColor: '#00C8B3'
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  processingBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 14
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333'
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden'
  },
  progressBarFill: {
    height: 8,
    backgroundColor: '#00C8B3',
    borderRadius: 4
  },
  processingNote: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center'
  },
  resultsBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    gap: 12
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222'
  },
  resultsSubtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18
  },
  feedbackItem: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  feedbackBullet: {
    fontSize: 16,
    color: '#6155F5',
    lineHeight: 22
  },
  feedbackText: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    lineHeight: 22
  },
  errorBox: {
    backgroundColor: '#FFF0F0',
    borderRadius: 12,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FFCCCC'
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#B00020'
  },
  errorMessage: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20
  }
});
