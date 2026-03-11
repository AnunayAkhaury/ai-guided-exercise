import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, FlatList, Alert } from 'react-native';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import ClassCard from '@/src/components/classes/ClassCard';
import Header from '@/src/components/ui/Header';
import ActiveClassCard from '@/src/components/classes/ActiveClassCard';
import Typography from '@/src/components/ui/Typography';
import {
  getIvsToken,
  joinIvsSessionByCode,
  listIvsSessions,
  type IvsSession,
  upsertIvsSessionParticipant
} from '@/src/api/ivs';
import { useUserStore } from '@/src/store/userStore';

export default function ClassesScreen() {
  const router = useRouter();
  const username = useUserStore((state) => state.username);
  const fullname = useUserStore((state) => state.fullname);
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

  const handleJoinSession = async (sessionCode: string, sessionId: string) => {
    try {
      setJoiningSessionId(sessionId);
      const joinedSession = await joinIvsSessionByCode(sessionCode);
      const displayName = fallbackDisplayName;
      const tokenResult = await getIvsToken({
        stageArn: joinedSession.stageArn,
        userId: displayName,
        userName: displayName,
        publish: true,
        subscribe: true,
        durationMinutes: 60,
        attributes: {
          role: 'student',
          sessionId: joinedSession.sessionId,
          sessionCode: joinedSession.sessionCode
        }
      });
      await upsertIvsSessionParticipant({
        sessionId: joinedSession.sessionId,
        participantId: tokenResult.participantId,
        displayName,
        role: 'student'
      });

      router.push({
        pathname: '/(tabs)/(student)/session',
        params: {
          sessionName: joinedSession.sessionName,
          sessionCode: joinedSession.sessionCode,
          sessionId: joinedSession.sessionId,
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

      <View className="px-5 pt-9">
        <View className="pb-6 flex flex-row items-center gap-2">
          <Typography font="inter-semibold">Active Sessions</Typography>
          <FontAwesome6 name="dumbbell" size={16} color="black" className="-rotate-45" />
        </View>

        <FlatList
          data={liveSessions}
          keyExtractor={(item) => item.sessionId}
          ListEmptyComponent={<Typography className="text-[#7a7a7a]">No live sessions right now.</Typography>}
          renderItem={({ item }) => {
            const { start, end } = getSessionWindow(item);
            return (
              <ActiveClassCard
                start={start}
                end={end}
                title={item.sessionName}
                desc={`Code: ${item.sessionCode}`}
                active
                subtitle={`Coach: ${item.instructorUid}`}
                joinLabel={joiningSessionId === item.sessionId ? 'Joining...' : 'Join Meeting'}
                joinDisabled={Boolean(joiningSessionId)}
                onJoinPress={() => handleJoinSession(item.sessionCode, item.sessionId)}
              />
            );
          }}
        />

        <View className="pt-20 pb-6 flex flex-row items-center gap-2">
          <Typography font="inter-semibold">Upcoming Sessions</Typography>
          <Ionicons name="calendar-clear-sharp" size={17} color="black" />
        </View>

        <FlatList
          data={scheduledSessions}
          keyExtractor={(item) => item.sessionId}
          ListEmptyComponent={<Typography className="text-[#7a7a7a]">No upcoming sessions.</Typography>}
          renderItem={({ item }) => {
            const { start, end } = getSessionWindow(item);
            return (
              <ClassCard
                start={start}
                end={end}
                title={item.sessionName}
                desc={`Code: ${item.sessionCode}`}
                active={false}
              />
            );
          }}
        />
      </View>
    </View>
  );
}
