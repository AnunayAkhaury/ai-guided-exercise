import React, { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Header from '@/src/components/ui/Header';
import Typography from '@/src/components/ui/Typography';
import TeacherActiveClassCard from '@/src/components/classes/TeacherActiveClassCard';
import {
  cacheIvsToken,
  endIvsSession,
  getIvsToken,
  getReusableIvsToken,
  sendIvsTelemetry,
  type IvsSession,
  upsertIvsSessionParticipant
} from '@/src/api/ivs';
import { useFirestoreSessions } from '@/src/hooks/use-ivs-firestore';
import { useUserStore } from '@/src/store/userStore';
import { useToast } from '@/src/components/ui/ToastProvider';

function toSessionWindow(session: IvsSession) {
  const start = session.scheduledStartAt ? new Date(session.scheduledStartAt) : new Date(session.createdAt);
  const end = session.scheduledEndAt ? new Date(session.scheduledEndAt) : new Date(start.getTime() + 60 * 60 * 1000);
  return { start, end };
}

function canStartSession(session: IvsSession) {
  if (!session.scheduledStartAt) return false;
  const start = new Date(session.scheduledStartAt).getTime();
  const earliestStart = start - 5 * 60 * 1000;
  return Date.now() >= earliestStart;
}

export default function ClassesScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isSmallPhone = width < 380 || height < 760;
  const horizontalPadding = isSmallPhone ? 14 : 20;
  const topPadding = isSmallPhone ? 16 : 24;
  const scheduledTopPadding = isSmallPhone ? 26 : 40;
  const [cancelingSessionId, setCancelingSessionId] = useState<string | null>(null);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const role = useUserStore((state) => state.role);
  const uid = useUserStore((state) => state.uid);
  const username = useUserStore((state) => state.username);
  const fullname = useUserStore((state) => state.fullname);
  const { data: sessions, loading: sessionsLoading, error: sessionsError } = useFirestoreSessions(
    ['live', 'scheduled'],
    role === 'instructor'
  );

  useEffect(() => {
    if (!role) return;
    if (role !== 'instructor') {
      router.replace(role === 'student' ? '/(tabs)/(student)/classes' : '/(tabs)/profile');
      return;
    }
  }, [role, router]);

  useEffect(() => {
    if (sessionsError) {
      console.log('[TeacherClasses] Firestore sessions listener error', sessionsError);
    }
  }, [sessionsError]);

  const scheduledSessions = useMemo(() => sessions.filter((item) => item.status === 'scheduled'), [sessions]);
  const liveSessions = useMemo(() => sessions.filter((item) => item.status === 'live'), [sessions]);
  const readyToStartSessions = useMemo(
    () => scheduledSessions.filter((item) => canStartSession(item)),
    [scheduledSessions]
  );
  const upcomingScheduledSessions = useMemo(
    () => scheduledSessions.filter((item) => !canStartSession(item)),
    [scheduledSessions]
  );
  const topSessions = useMemo(() => [...liveSessions, ...readyToStartSessions], [liveSessions, readyToStartSessions]);

  const handleCancelScheduled = async (sessionId: string) => {
    try {
      setCancelingSessionId(sessionId);
      await endIvsSession(sessionId);
    } catch (error: any) {
      showToast({ title: 'Cancel failed', message: error?.message || 'Unable to cancel this session.', variant: 'error' });
    } finally {
      setCancelingSessionId(null);
    }
  };

  const handleOpenLiveSession = async (session: IvsSession) => {
    const effectiveUid = uid?.trim();
    const displayName = fullname?.trim() || username?.trim() || 'Instructor';

    if (!effectiveUid) {
      showToast({ title: 'Missing profile', message: 'Missing profile uid. Please log out and log in again.', variant: 'error' });
      return;
    }
    if (joiningSessionId) return;

    try {
      setJoiningSessionId(session.sessionId);
      const cached = getReusableIvsToken({
        sessionId: session.sessionId,
        stageArn: session.stageArn,
        userId: effectiveUid,
        role: 'instructor'
      });

      if (cached) {
        void sendIvsTelemetry({
          eventName: 'token_reused',
          sessionId: session.sessionId,
          stageArn: session.stageArn,
          userId: effectiveUid,
          role: 'instructor',
          participantId: cached.participantId
        });
      }

      const tokenResult =
        cached ??
        (await getIvsToken({
          stageArn: session.stageArn,
          userId: effectiveUid,
          userName: displayName,
          publish: true,
          subscribe: true,
          durationMinutes: 60,
          attributes: {
            displayName,
            userId: effectiveUid,
            role: 'instructor',
            sessionId: session.sessionId,
            sessionCode: session.sessionCode
          }
        }));

      cacheIvsToken(
        {
          sessionId: session.sessionId,
          stageArn: session.stageArn,
          userId: effectiveUid,
          role: 'instructor'
        },
        tokenResult
      );

      await upsertIvsSessionParticipant({
        sessionId: session.sessionId,
        participantId: tokenResult.participantId,
        userId: effectiveUid,
        displayName,
        role: 'instructor'
      });

      router.push({
        pathname: '/(tabs)/session' as any,
        params: {
          sessionName: session.sessionName,
          userName: displayName,
          sessionCode: session.sessionCode,
          sessionId: session.sessionId,
          stageArn: session.stageArn,
          participantId: tokenResult.participantId,
          role: 'instructor',
          token: tokenResult.token
        }
      });
    } catch (error: any) {
      showToast({ title: 'Join failed', message: error?.message || 'Unable to join this live session.', variant: 'error' });
    } finally {
      setJoiningSessionId(null);
    }
  };

  return (
    <View style={styles.page}>
      <Header title="Classes" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: isWeb ? 32 : horizontalPadding,
            paddingTop: isWeb ? 30 : topPadding
          }
        ]}
      >
        <View style={styles.contentShell}>
          <View style={styles.topBar}>
            <View style={styles.headingRow}>
              <Typography font="inter-bold" style={styles.pageTitle}>Classes</Typography>
              <Typography font="inter" style={styles.pageSubtitle}>
                Manage live classes and upcoming scheduled sessions.
              </Typography>
            </View>
            <TouchableOpacity
              style={styles.scheduleButton}
              onPress={() => router.push('/(tabs)/(teacher)/schedule')}
            >
              <Typography font="inter-semibold" style={styles.scheduleButtonText}>
                + Schedule
              </Typography>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <Typography font="inter-semibold" style={styles.sectionTitle}>Live / Ready to Start</Typography>
            <FontAwesome6 name="dumbbell" size={16} color="black" className="-rotate-45" />
          </View>

          {topSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Typography font="inter" style={styles.emptyText}>
              {sessionsLoading
                ? 'Loading classes...'
                : sessionsError
                  ? 'Unable to load classes right now.'
                  : 'No live or ready classes right now.'}
              </Typography>
            </View>
          ) : (
            <View style={styles.cardGrid}>
              {topSessions.map((item) => {
            const { start, end } = toSessionWindow(item);
            const isLive = item.status === 'live';
            return (
              <TeacherActiveClassCard
                key={item.sessionId}
                start={start}
                end={end}
                title={item.sessionName}
                desc={`${isLive ? 'Live' : 'Ready'} • Code: ${item.sessionCode}`}
                active={isLive}
                subtitle={`Coach: ${item.coachName || item.instructorUid}`}
                startLabel={isLive ? (joiningSessionId === item.sessionId ? 'Joining...' : 'Open Live') : 'Start Meeting'}
                cancelLabel={cancelingSessionId === item.sessionId ? 'Canceling...' : 'Cancel'}
                startDisabled={Boolean(cancelingSessionId) || Boolean(joiningSessionId)}
                cancelDisabled={Boolean(cancelingSessionId) || Boolean(joiningSessionId)}
                onStartPress={() => {
                  if (isLive) {
                    void handleOpenLiveSession(item);
                    return;
                  }
                  router.push({
                    pathname: '/(tabs)/(teacher)/start-meeting',
                    params: {
                      sessionName: item.sessionName,
                      sessionId: item.sessionId,
                      coachName: item.coachName || item.instructorUid
                    }
                  });
                }}
                onCancelPress={() => handleCancelScheduled(item.sessionId)}
              />
            );
              })}
            </View>
          )}

          <View style={[styles.sectionHeader, { paddingTop: isWeb ? 22 : scheduledTopPadding }]}>
          <Typography font="inter-semibold" style={styles.sectionTitle}>Scheduled</Typography>
          <Ionicons name="radio" size={17} color="#6155F5" />
          </View>

          {upcomingScheduledSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Typography font="inter" style={styles.emptyText}>
              {sessionsError ? 'Unable to load scheduled classes right now.' : 'No upcoming scheduled sessions.'}
              </Typography>
            </View>
          ) : (
            <View style={styles.cardGrid}>
              {upcomingScheduledSessions.map((item) => {
            const { start, end } = toSessionWindow(item);
            return (
              <TeacherActiveClassCard
                key={`scheduled-${item.sessionId}`}
                start={start}
                end={end}
                title={item.sessionName}
                desc={`Code: ${item.sessionCode}`}
                active={false}
                subtitle={`Coach: ${item.coachName || item.instructorUid}`}
                startLabel="Available 5 min before"
                cancelLabel={cancelingSessionId === item.sessionId ? 'Canceling...' : 'Cancel'}
                startDisabled
                cancelDisabled={Boolean(cancelingSessionId) || Boolean(joiningSessionId)}
                onCancelPress={() => handleCancelScheduled(item.sessionId)}
              />
            );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F7F5FF'
  },
  scrollContent: {
    paddingBottom: 42
  },
  contentShell: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 1120 : undefined,
    alignSelf: 'center'
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 26
  },
  headingRow: {
    flex: 1,
    minWidth: 0
  },
  pageTitle: {
    fontSize: Platform.OS === 'web' ? 32 : 24,
    color: '#17142B'
  },
  pageSubtitle: {
    marginTop: 6,
    fontSize: 15,
    color: '#6B6594'
  },
  scheduleButton: {
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#6155F5',
    paddingHorizontal: 16,
    paddingVertical: 10
  },
  scheduleButtonText: {
    color: '#FFFFFF',
    fontSize: 14
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 14
  },
  sectionTitle: {
    fontSize: 17,
    color: '#18152E'
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    alignItems: 'flex-start'
  },
  emptyState: {
    borderWidth: 1,
    borderColor: '#E1DBF5',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 10
  },
  emptyText: {
    color: '#6F698E'
  }
});
