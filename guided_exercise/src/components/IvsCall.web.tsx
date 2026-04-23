import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type IvsCallProps = {
  token?: string;
  publishOnJoin?: boolean;
  onLeave?: () => void | Promise<void>;
  onInfoPress?: () => void;
  onEndSession?: () => void;
  endSessionLabel?: string;
  endSessionDisabled?: boolean;
  onInStageChange?: (inStage: boolean) => void;
  onRequestFreshToken?: () => Promise<{ token: string; participantId?: string } | null>;
  onJoinAttempt?: () => void | Promise<void>;
  onJoinFailed?: (message: string) => void | Promise<void>;
  localParticipantLabel?: string;
  participantNamesById?: Record<string, string>;
  participantRolesById?: Record<string, string>;
  localParticipantRole?: 'student' | 'instructor';
};

export default function IvsCallWeb({
  onLeave,
  onEndSession,
  endSessionLabel = 'End Session',
  endSessionDisabled = false,
  onInStageChange
}: IvsCallProps) {
  useEffect(() => {
    onInStageChange?.(false);
  }, [onInStageChange]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Browser Live Classes Are Next</Text>
        <Text style={styles.subtitle}>
          Step 1 makes the web app boot safely. The full desktop IVS stage runtime will be added in the next step.
        </Text>

        <View style={styles.actions}>
          <Pressable style={styles.secondaryButton} onPress={() => void onLeave?.()}>
            <Text style={styles.secondaryButtonText}>Leave</Text>
          </Pressable>
          {onEndSession ? (
            <Pressable
              style={[styles.primaryButton, endSessionDisabled && styles.disabledButton]}
              onPress={onEndSession}
              disabled={endSessionDisabled}
            >
              <Text style={styles.primaryButtonText}>{endSessionLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2FF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  card: {
    width: '100%',
    maxWidth: 720,
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 32,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D9CCFF',
    gap: 14
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2F2856'
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#5F5994'
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10
  },
  primaryButton: {
    borderRadius: 14,
    backgroundColor: '#6155F5',
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600'
  },
  secondaryButton: {
    borderRadius: 14,
    backgroundColor: '#E5DCFF',
    paddingHorizontal: 18,
    paddingVertical: 12
  },
  secondaryButtonText: {
    color: '#6155F5',
    fontWeight: '600'
  },
  disabledButton: {
    opacity: 0.55
  }
});
