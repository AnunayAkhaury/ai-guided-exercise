import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, Alert, useWindowDimensions } from 'react-native';
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
  listIvsSessions,
  sendIvsTelemetry,
  type IvsSession,
  upsertIvsSessionParticipant
} from '@/src/api/ivs';
import { useUserStore } from '@/src/store/userStore';

export default function ClassesScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 380 || height < 760;
  const horizontalPadding = isSmallPhone ? 14 : 20;
  const topPadding = isSmallPhone ? 16 : 24;
  const upcomingTopPadding = isSmallPhone ? 28 : 80;
  const username = useUserStore((state) => state.username);
  const fullname = useUserStore((state) => state.fullname);
  const uid = useUserStore((state) => state.uid);
  const [sessions, setSessions] = useState<IvsSession[]>([]);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const fallbackDisplayName = username?.trim() || fullname?.trim() || 'Student Test';

  const loadSessions = useCallback(async () => {
    try {
      const data = await listIvsSessions(['live', 'scheduled']);
      setSessions(data);
    } catch (error: any) {
      Alert.alert('Session list error', error?.message || 'Unable to load sessions.');
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadSessions();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadSessions]);

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
    <View className="bg-white flex-grow">
      <Header title="Classes" />

      <View style={{ paddingHorizontal: horizontalPadding, paddingTop: topPadding }}>
        <View className="pb-6 flex flex-row items-center gap-2">
          <Typography font="inter-semibold">Live / Starting Soon</Typography>
          <FontAwesome6 name="dumbbell" size={16} color="black" className="-rotate-45" />
        </View>

        <FlatList
          data={topSessions}
          keyExtractor={(item) => item.sessionId}
          ListEmptyComponent={<Typography className="text-[#7a7a7a]">No live or ready sessions right now.</Typography>}
          renderItem={({ item }) => {
            const { start, end } = getSessionWindow(item);
            const isLive = item.status === 'live';
            return (
              <TeacherActiveClassCard
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
          }}
        />

        <View style={{ paddingTop: upcomingTopPadding }} className="pb-6 flex flex-row items-center gap-2">
          <Typography font="inter-semibold">Upcoming Sessions</Typography>
          <Ionicons name="calendar-clear-sharp" size={17} color="black" />
        </View>

        <FlatList
          data={upcomingScheduledSessions}
          keyExtractor={(item) => item.sessionId}
          ListEmptyComponent={<Typography className="text-[#7a7a7a]">No upcoming sessions.</Typography>}
          renderItem={({ item }) => {
            const { start, end } = getSessionWindow(item);
            return (
              <TeacherActiveClassCard
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
          }}
        />
      </View>
    </View>
  );
}
