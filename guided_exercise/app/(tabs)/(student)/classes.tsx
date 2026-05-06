import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Header from '@/src/components/ui/Header';
import TeacherActiveClassCard from '@/src/components/classes/TeacherActiveClassCard';
import Typography from '@/src/components/ui/Typography';
import {
  cacheIvsToken,
  getIvsToken,
  getReusableIvsToken,
  joinIvsSessionByCode,
  sendIvsTelemetry,
  type IvsSession,
  upsertIvsSessionParticipant
} from '@/src/api/ivs';
import { useFirestoreSessions } from '@/src/hooks/use-ivs-firestore';
import { useUserStore } from '@/src/store/userStore';

export default function ClassesScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isSmallPhone = width < 380 || height < 760;
  const horizontalPadding = isSmallPhone ? 14 : 20;
  const topPadding = isSmallPhone ? 16 : 24;
  const upcomingTopPadding = isSmallPhone ? 26 : 40;
  const username = useUserStore((state) => state.username);
  const fullname = useUserStore((state) => state.fullname);
  const uid = useUserStore((state) => state.uid);
  const role = useUserStore((state) => state.role);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const fallbackDisplayName = username?.trim() || fullname?.trim() || 'Student Test';
  const { data: sessions, loading: sessionsLoading, error: sessionsError } = useFirestoreSessions(
    ['live', 'scheduled'],
    role === 'student'
  );

  useEffect(() => {
    if (!role) return;
    if (role !== 'student') {
      router.replace(role === 'instructor' ? '/(tabs)/(teacher)/classes' : '/(tabs)/profile');
      return;
    }
  }, [role, router]);

  useEffect(() => {
    if (sessionsError) {
      console.log('[StudentClasses] Firestore sessions listener error', sessionsError);
    }
  }, [sessionsError]);

  const liveSessions = useMemo(() => sessions.filter((item) => item.status === 'live'), [sessions]);
  const scheduledSessions = useMemo(() => sessions.filter((item) => item.status === 'scheduled'), [sessions]);

  const getSessionWindow = (item: IvsSession) => {
    const start = item.scheduledStartAt ? new Date(item.scheduledStartAt) : new Date(item.createdAt);
    const end = item.scheduledEndAt ? new Date(item.scheduledEndAt) : new Date(start.getTime() + 60 * 60 * 1000);
    return { start, end };
  };

  const isReadyToJoin = (item: IvsSession) => {
    if (!item.scheduledStartAt) return false;
    const start = new Date(item.scheduledStartAt).getTime();
    const earliestJoin = start - 5 * 60 * 1000;
    return Date.now() >= earliestJoin;
  };

  const readyScheduledSessions = useMemo(
    () => scheduledSessions.filter((item) => isReadyToJoin(item)),
    [scheduledSessions]
  );
  const upcomingScheduledSessions = useMemo(
    () => scheduledSessions.filter((item) => !isReadyToJoin(item)),
    [scheduledSessions]
  );
  const topSessions = useMemo(() => [...liveSessions, ...readyScheduledSessions], [liveSessions, readyScheduledSessions]);

  const handleJoinSession = async (sessionCode: string, sessionId: string) => {
    try {
      setJoiningSessionId(sessionId);
      const joinedSession = await joinIvsSessionByCode(sessionCode);
      const displayName = fallbackDisplayName;
      const effectiveUid = uid?.trim();
      if (!effectiveUid) {
        throw new Error('Missing profile uid. Please log out and log in again.');
      }
      const cached = getReusableIvsToken({
        sessionId: joinedSession.sessionId,
        stageArn: joinedSession.stageArn,
        userId: effectiveUid,
        role: 'student'
      });
      if (cached) {
        void sendIvsTelemetry({
          eventName: 'token_reused',
          sessionId: joinedSession.sessionId,
          stageArn: joinedSession.stageArn,
          userId: effectiveUid,
          role: 'student',
          participantId: cached.participantId
        });
      }
      const tokenResult =
        cached ??
        (await getIvsToken({
          stageArn: joinedSession.stageArn,
          userId: effectiveUid,
          userName: displayName,
          publish: true,
          subscribe: true,
          durationMinutes: 60,
          attributes: {
            displayName,
            userId: effectiveUid,
            role: 'student',
            sessionId: joinedSession.sessionId,
            sessionCode: joinedSession.sessionCode
          }
        }));
      cacheIvsToken(
        {
          sessionId: joinedSession.sessionId,
          stageArn: joinedSession.stageArn,
          userId: effectiveUid,
          role: 'student'
        },
        tokenResult
      );
      await upsertIvsSessionParticipant({
        sessionId: joinedSession.sessionId,
        participantId: tokenResult.participantId,
        userId: effectiveUid,
        displayName,
        role: 'student'
      });

      router.push({
        pathname: '/(tabs)/session' as any,
        params: {
          sessionName: joinedSession.sessionName,
          sessionCode: joinedSession.sessionCode,
          sessionId: joinedSession.sessionId,
          stageArn: joinedSession.stageArn,
          participantId: tokenResult.participantId,
          role: 'student',
          userName: displayName,
          token: tokenResult.token
        }
      });
    } catch (error: any) {
      Alert.alert('Join error', error?.message || 'Unable to join session.');
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
                Join live classes and see your upcoming scheduled sessions.
              </Typography>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Typography font="inter-semibold" style={styles.sectionTitle}>Live / Starting Soon</Typography>
            <FontAwesome6 name="dumbbell" size={16} color="black" className="-rotate-45" />
          </View>

          {topSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Typography font="inter" style={styles.emptyText}>
                {sessionsLoading
                  ? 'Loading sessions...'
                  : sessionsError
                    ? 'Unable to load sessions right now.'
                    : 'No live or ready sessions right now.'}
              </Typography>
            </View>
          ) : (
            <View style={styles.cardGrid}>
              {topSessions.map((item) => {
                const { start, end } = getSessionWindow(item);
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
                    startLabel={
                      isLive
                        ? joiningSessionId === item.sessionId
                          ? 'Joining...'
                          : 'Join Meeting'
                        : 'Waiting for Coach'
                    }
                    actionsDisabled={Boolean(joiningSessionId) || !isLive}
                    showSecondaryAction={false}
                    onStartPress={() => {
                      if (isLive) {
                        void handleJoinSession(item.sessionCode, item.sessionId);
                      }
                    }}
                  />
                );
              })}
            </View>
          )}

          <View style={[styles.sectionHeader, { paddingTop: isWeb ? 22 : upcomingTopPadding }]}>
            <Typography font="inter-semibold" style={styles.sectionTitle}>Upcoming Sessions</Typography>
            <Ionicons name="calendar-clear-sharp" size={17} color="#6155F5" />
          </View>

          {upcomingScheduledSessions.length === 0 ? (
            <View style={styles.emptyState}>
              <Typography font="inter" style={styles.emptyText}>
                {sessionsError ? 'Unable to load upcoming sessions right now.' : 'No upcoming sessions.'}
              </Typography>
            </View>
          ) : (
            <View style={styles.cardGrid}>
              {upcomingScheduledSessions.map((item) => {
                const { start, end } = getSessionWindow(item);
                return (
                  <TeacherActiveClassCard
                    key={`scheduled-${item.sessionId}`}
                    start={start}
                    end={end}
                    title={item.sessionName}
                    desc={`Coach: ${item.coachName || item.instructorUid} • Code: ${item.sessionCode}`}
                    active={false}
                    subtitle="Upcoming scheduled class"
                    startLabel="Available 5 min before"
                    actionsDisabled
                    showSecondaryAction={false}
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
