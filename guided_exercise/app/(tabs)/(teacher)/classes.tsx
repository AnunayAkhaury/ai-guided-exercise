import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { FontAwesome6, Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Header from '@/src/components/ui/Header';
import Typography from '@/src/components/ui/Typography';
import TeacherActiveClassCard from '@/src/components/classes/TeacherActiveClassCard';
import { endIvsSession, listIvsSessions, type IvsSession } from '@/src/api/ivs';
import { useUserStore } from '@/src/store/userStore';

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
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 380 || height < 760;
  const horizontalPadding = isSmallPhone ? 14 : 20;
  const topPadding = isSmallPhone ? 16 : 24;
  const scheduledTopPadding = isSmallPhone ? 26 : 40;
  const [sessions, setSessions] = useState<IvsSession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelingSessionId, setCancelingSessionId] = useState<string | null>(null);
  const role = useUserStore((state) => state.role);

  const loadSessions = useCallback(async () => {
    const data = await listIvsSessions(['live', 'scheduled']);
    setSessions(data);
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadSessions();
    } catch (error: any) {
      Alert.alert('Unable to load classes', error?.message || 'Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [loadSessions]);

  useEffect(() => {
    if (!role) return;
    if (role !== 'instructor') {
      router.replace(role === 'student' ? '/(tabs)/(student)/classes' : '/(tabs)/profile');
      return;
    }
    void refreshSessions();
  }, [refreshSessions, role, router]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadSessions();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadSessions]);

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
      await loadSessions();
    } catch (error: any) {
      Alert.alert('Cancel failed', error?.message || 'Unable to cancel this session.');
    } finally {
      setCancelingSessionId(null);
    }
  };

  return (
    <View className="bg-white flex-grow">
      <Header title="Classes" />

      <View style={{ paddingHorizontal: horizontalPadding, paddingTop: topPadding }} className="flex-1">
        <View className="pb-6 flex flex-row items-center justify-between">
          <View className="flex flex-row items-center gap-2">
            <Typography font="inter-semibold">Live / Ready to Start</Typography>
            <FontAwesome6 name="dumbbell" size={16} color="black" className="-rotate-45" />
          </View>
          <TouchableOpacity
            className="px-3 py-2 rounded-lg bg-[#6155F5]"
            onPress={() => router.push('/(tabs)/(teacher)/schedule')}
          >
            <Typography font="inter-semibold" className="text-white text-sm">
              + Schedule
            </Typography>
          </TouchableOpacity>
        </View>

        <FlatList
          data={topSessions}
          keyExtractor={(item) => item.sessionId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshSessions} tintColor="#6155F5" />}
          ListEmptyComponent={<Typography className="text-[#7a7a7a]">No live or ready classes right now.</Typography>}
          renderItem={({ item }) => {
            const { start, end } = toSessionWindow(item);
            const isLive = item.status === 'live';
            return (
              <TeacherActiveClassCard
                start={start}
                end={end}
                title={item.sessionName}
                desc={`${isLive ? 'Live' : 'Ready'} • Code: ${item.sessionCode}`}
                active={isLive}
                subtitle={`Coach: ${item.coachName || item.instructorUid}`}
                startLabel={isLive ? 'Open Live' : 'Start Meeting'}
                cancelLabel={cancelingSessionId === item.sessionId ? 'Canceling...' : 'Cancel'}
                actionsDisabled={Boolean(cancelingSessionId)}
                onStartPress={() =>
                  router.push({
                    pathname: '/(tabs)/(teacher)/start-meeting',
                    params: {
                      sessionName: item.sessionName,
                      sessionId: item.sessionId,
                      coachName: item.coachName || item.instructorUid
                    }
                  })
                }
                onCancelPress={() => handleCancelScheduled(item.sessionId)}
              />
            );
          }}
        />

        <View style={{ paddingTop: scheduledTopPadding }} className="pb-6 flex flex-row items-center gap-2">
          <Typography font="inter-semibold">Scheduled</Typography>
          <Ionicons name="radio" size={17} color="#6155F5" />
        </View>

        <FlatList
          data={upcomingScheduledSessions}
          keyExtractor={(item) => `scheduled-${item.sessionId}`}
          ListEmptyComponent={<Typography className="text-[#7a7a7a]">No upcoming scheduled sessions.</Typography>}
          renderItem={({ item }) => {
            const { start, end } = toSessionWindow(item);
            return (
              <TeacherActiveClassCard
                start={start}
                end={end}
                title={item.sessionName}
                desc={`Code: ${item.sessionCode}`}
                active={false}
                subtitle={`Coach: ${item.coachName || item.instructorUid}`}
                startLabel="Available 5 min before"
                cancelLabel={cancelingSessionId === item.sessionId ? 'Canceling...' : 'Cancel'}
                actionsDisabled
                onCancelPress={() => handleCancelScheduled(item.sessionId)}
              />
            );
          }}
          ListFooterComponent={<View className="h-8" />}
        />
      </View>
    </View>
  );
}
