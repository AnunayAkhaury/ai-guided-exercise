// DELETE FILE ON PRODUCTION
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { View, ActivityIndicator, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import Typography from '@/src/components/ui/Typography';
import Header from '@/src/components/ui/Header';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { getFeedbackFromUserId, type Feedback } from '@/src/api/Firebase/firebase-feedback';
import { useUserStore } from '@/src/store/userStore';
import { EXERCISE_TITLE_MAP } from '@/src/constants/exerciseMap';
import * as Haptics from 'expo-haptics';

type GraphPoint = {
  score: number;
  date: Date;
};

type Timeframe = '6h' | '1d' | '1w' | '1m' | 'all';

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  '6h': '6H',
  '1d': '1D',
  '1w': '1W',
  '1m': '1M',
  all: 'ALL'
};

const CUTOFF_MS: Record<Timeframe, (now: number) => number> = {
  '6h': (now) => now - 6 * 60 * 60 * 1000,
  '1d': (now) => now - 24 * 60 * 60 * 1000,
  '1w': (now) => now - 7 * 24 * 60 * 60 * 1000,
  '1m': (now) => now - 30 * 24 * 60 * 60 * 1000,
  all: () => 0
};

export default function Stats() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('1w');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedPoint, setSelectedPoint] = useState<GraphPoint | null>(null);
  const [lastHaptickedPointId, setLastHaptickedPointId] = useState<string | null>(null);

  const uid = useUserStore((state) => state.uid);

  const exerciseTypes = useMemo(() => {
    if (!Array.isArray(feedbacks)) return [];
    return Array.from(new Set(feedbacks.filter((f) => f?.exercise).map((f) => f.exercise))).sort();
  }, [feedbacks]);

  const points = useMemo<GraphPoint[]>(() => {
    if (!feedbacks.length || !selectedExercise) return [];

    const now = Date.now();
    const cutoff = CUTOFF_MS[selectedTimeframe](now);

    return feedbacks
      .filter((f) => {
        if (!f) return false;
        if (f.exercise !== selectedExercise) return false;

        const timestamp = Number(f.starttime);
        return timestamp >= cutoff;
      })
      .map((f) => ({
        score: Number(f.score),
        date: new Date(Number(f.starttime))
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [feedbacks, selectedExercise, selectedTimeframe]);

  const fetchData = useCallback(async () => {
    if (!uid) return;

    try {
      setLoading(true);
      setError(null);

      const res = await getFeedbackFromUserId(uid);
      const validArray = res || [];

      setFeedbacks(validArray);

      if (validArray.length > 0 && validArray[0]?.exercise) {
        setSelectedExercise(validArray[0].exercise);
      }
    } catch (e) {
      console.error(e);
      setError('Unable to load stats');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setSelectedPoint(null);
    setLastHaptickedPointId(null);
  }, [selectedExercise, selectedTimeframe]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const updateSelectedPoint = (point: GraphPoint) => {
    setSelectedPoint((prev) => {
      if (prev?.score === point.score && prev?.date.getTime() === point.date.getTime()) {
        return prev;
      }
      return point;
    });
    console.log('point update', point.date, point.score);
  };

  useEffect(() => {
    if (!selectedPoint) return;

    const id = `${selectedPoint.date.getTime()}-${selectedPoint.score}`;

    if (lastHaptickedPointId !== id) {
      setLastHaptickedPointId(id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [selectedPoint]);

  const resetSelectedPoint = () => {
    setSelectedPoint(null);
    setLastHaptickedPointId(null);
  };

  const formatDate = (input: number | Date) => {
    const date = input instanceof Date ? input : new Date(input);
    if (isNaN(date.getTime())) return 'Unknown date';

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const avgPoint = useMemo(() => {
    if (!points.length) return null;

    const sum = points.reduce((acc, p) => acc + p.score, 0);

    const firstDate = points[0].date;
    const lastDate = points[points.length - 1].date;

    const sameDay = firstDate.toDateString() === lastDate.toDateString();

    let dateRange = '';

    if (firstDate.getTime() === lastDate.getTime()) {
      dateRange = formatDate(firstDate);
    } else if (sameDay) {
      dateRange = `${firstDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      })} (${firstDate.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      })} – ${lastDate.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      })})`;
    } else {
      dateRange = `${formatDate(firstDate)} – ${formatDate(lastDate)}`;
    }

    return {
      value: sum / points.length,
      dateRange: dateRange
    };
  }, [points]);

  return (
    <ScrollView
      className="flex-1 bg-[#FAF8FF]"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6155F5" />}>
      <Header title="Stats" />

      <View className="px-5 pt-5">
        {/* EXERCISE SELECT */}
        {!loading && exerciseTypes.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
            {exerciseTypes.map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setSelectedExercise(type)}
                className={`mr-2 px-5 py-2 rounded-full border ${
                  selectedExercise === type ? 'bg-[#5B4BFF] border-[#5B4BFF]' : 'bg-white border-[#E3DAFF]'
                }`}>
                <Typography className={selectedExercise === type ? 'text-white' : 'text-[#6B6490]'}>
                  {EXERCISE_TITLE_MAP[type] ?? type}
                </Typography>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* TOP STATS */}
        <View className="mb-4 min-h-[54px] justify-center">
          {selectedPoint ? (
            <View>
              <Typography className="text-[#5B4BFF] text-xl font-bold">Score: {selectedPoint.score}</Typography>
              <Typography className="text-[#8A82B6] text-xs">{formatDate(selectedPoint.date)}</Typography>
            </View>
          ) : avgPoint ? (
            <View>
              <Typography className="text-[#5B4BFF] text-xl font-bold">
                Avg Score: {avgPoint.value.toFixed(1)}
              </Typography>
              <Typography className="text-[#8A82B6] text-xs">{avgPoint.dateRange}</Typography>
            </View>
          ) : null}
        </View>

        {/* CHART */}
        <View className="rounded-2xl border border-[#E3DAFF] bg-[#F6F3FF] p-4">
          {loading ? (
            <View className="items-center py-10">
              <ActivityIndicator color="#5B4BFF" />
              <Typography className="text-[#6B6490] mt-3">Loading stats...</Typography>
            </View>
          ) : error ? (
            <View className="items-center py-8">
              <Typography font="inter-semibold" className="text-[#5B4BFF]">
                Error
              </Typography>
              <Typography className="text-[#6B6490] text-center">{error}</Typography>
            </View>
          ) : points.length < 2 ? (
            <View className="items-center py-8">
              <Typography font="inter-semibold" className="text-[#5B4BFF]">
                {points.length === 0 ? 'No data yet' : 'Keep going!'}
              </Typography>

              <Typography className="text-[#6B6490] mt-2 text-center px-4">
                {points.length === 0
                  ? `You haven't recorded any ${
                      selectedExercise ? (EXERCISE_TITLE_MAP[selectedExercise] ?? selectedExercise) : 'sessions'
                    } in this timeframe.`
                  : `Record one more ${
                      selectedExercise ? (EXERCISE_TITLE_MAP[selectedExercise] ?? selectedExercise) : 'session'
                    } to see your trend.`}
              </Typography>
            </View>
          ) : (
            <View style={{ width: '100%', height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points}>
                  <XAxis dataKey="date" tickFormatter={(value) => formatDate(value)} />
                  <YAxis />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;

                      const data = payload[0].payload;

                      return (
                        <View style={{ backgroundColor: '#fff', padding: 8, borderRadius: 8 }}>
                          <Typography className="text-[#5B4BFF] font-bold">Score: {data.score}</Typography>

                          <Typography className="text-[#8A82B6] text-xs">{formatDate(data.date)}</Typography>
                        </View>
                      );
                    }}
                  />
                  <Line
                    type="linear"
                    dataKey="score"
                    stroke="#5B4BFF"
                    strokeWidth={3}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </View>
          )}
        </View>

        {!loading && (
          <View className="flex-row justify-between mt-5 bg-[#F0ECFF] p-1.5 rounded-xl">
            {(['6h', '1d', '1w', '1m', 'all'] as Timeframe[]).map((t) => (
              <TouchableOpacity key={t} onPress={() => setSelectedTimeframe(t)} className="flex-1 items-center ">
                <Typography className={selectedTimeframe === t ? 'text-[#5B4BFF]' : 'text-[#8A82B6]'}>
                  {TIMEFRAME_LABELS[t]}
                </Typography>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
