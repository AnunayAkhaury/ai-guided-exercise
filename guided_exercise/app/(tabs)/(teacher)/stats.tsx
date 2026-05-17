import { LineGraph } from 'react-native-graph';
import { View, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import Typography from '@/src/components/ui/Typography';
import Header from '@/src/components/ui/Header';
import { useEffect, useState, useMemo } from 'react';
import { getFeedbackFromUserId, type Feedback } from '@/src/api/Firebase/firebase-feedback';
import { useUserStore } from '@/src/store/userStore';
import { EXERCISE_TITLE_MAP } from '@/src/constants/exerciseMap';
import * as FeedbackApi from '@/src/api/Firebase/firebase-feedback';
import * as Haptics from 'expo-haptics';

type GraphPoint = {
  value: number;
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

  const [selectedPoint, setSelectedPoint] = useState<GraphPoint | null>(null);
  const [lastHaptickedPointId, setLastHaptickedPointId] = useState<string | null>(null);

  const uid = useUserStore((state) => state.uid);

  const exerciseTypes = useMemo(() => {
    if (!Array.isArray(feedbacks)) return [];

    return Array.from(new Set(feedbacks.filter((f) => f?.exercise).map((f) => f.exercise))).sort();
  }, [feedbacks]);

  const points = useMemo<GraphPoint[]>(() => {
    if (!feedbacks.length || !selectedExercise) return [];

    try {
      const now = Date.now();
      const cutoff = CUTOFF_MS[selectedTimeframe](now);

      const cleaned = feedbacks
        .filter((f) => {
          if (!f) return false;
          if (f.exercise !== selectedExercise) return false;

          const timestamp = Number(f.starttime);
          const score = Number(f.score);

          if (!Number.isFinite(timestamp)) return false;
          if (!Number.isFinite(score)) return false;
          if (timestamp < cutoff) return false;

          return true;
        })
        .map((f) => ({
          value: Number(f.score),
          date: new Date(Number(f.starttime))
        }))
        .filter((p) => p && Number.isFinite(p.value) && p.date instanceof Date && !isNaN(p.date.getTime()))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      // Remove duplicate timestamps
      return cleaned.filter(
        (point, index, self) => index === self.findIndex((p) => p.date.getTime() === point.date.getTime())
      );
    } catch (e) {
      console.error('Failed to process feedback data:', e);
      return [];
    }
  }, [feedbacks, selectedExercise, selectedTimeframe]);

  useEffect(() => {
    if (!uid) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const res = await getFeedbackFromUserId(uid!);
        const validArray = res || [];

        setFeedbacks(validArray);

        if (validArray.length > 0 && validArray[0]?.exercise) {
          setSelectedExercise(validArray[0].exercise);
        }
      } catch (e) {
        console.error('Failed to fetch stats:', e);
        setError('Unable to load stats');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [uid]);

  useEffect(() => {
    setSelectedPoint(null);
    setLastHaptickedPointId(null);
  }, [selectedExercise, selectedTimeframe]);

  const handleGestureStart = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.warn('Haptics unavailable on gesture start:', e);
    }
  };

  const updateSelectedPoint = async (point?: GraphPoint | null) => {
    if (!point) return;

    if (!(point.date instanceof Date) || isNaN(point.date.getTime()) || !Number.isFinite(point.value)) {
      return;
    }

    try {
      setSelectedPoint(point);

      const pointId = `${point.date.getTime()}-${point.value}`;

      if (lastHaptickedPointId !== pointId) {
        setLastHaptickedPointId(pointId);

        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {
      console.warn('Haptics unavailable on point selection:', e);
    }
  };

  const resetSelectedPoint = async () => {
    try {
      setSelectedPoint(null);
      setLastHaptickedPointId(null);

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.warn('Haptics unavailable on gesture end:', e);
    }
  };

  const formatDate = (date: Date) => {
    try {
      if (!(date instanceof Date) || isNaN(date.getTime())) {
        return 'Unknown date';
      }

      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.warn('Failed to format date:', e);
      return 'Unknown date';
    }
  };

  return (
    <View className="flex-1 bg-[#FAF8FF]">
      <Header title="Your Progress" />

      <View className="px-5 pt-5">
        {!loading && exerciseTypes.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-6">
            {exerciseTypes.map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setSelectedExercise(type)}
                className={`mr-2 px-5 py-2 rounded-full border ${
                  selectedExercise === type ? 'bg-[#5B4BFF] border-[#5B4BFF]' : 'bg-white border-[#E3DAFF]'
                }`}>
                <Typography
                  className={selectedExercise === type ? 'text-white' : 'text-[#6B6490]'}
                  font={selectedExercise === type ? 'inter-semibold' : 'inter-medium'}>
                  {EXERCISE_TITLE_MAP[type] ?? type}
                </Typography>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View className="mb-4 min-h-[54px] justify-center">
          {selectedPoint ? (
            <View>
              <Typography font="inter-bold" className="text-[#5B4BFF] text-xl">
                Score: {selectedPoint.value}
              </Typography>

              <Typography font="inter-medium" className="text-[#8A82B6] text-xs mt-0.5">
                {formatDate(selectedPoint.date)}
              </Typography>
            </View>
          ) : (
            <View>
              <Typography font="inter-semibold" className="text-[#4B3F7A] text-base">
                {selectedExercise
                  ? `${EXERCISE_TITLE_MAP[selectedExercise] ?? selectedExercise} Score Trend`
                  : 'Unknown Score Trend'}
              </Typography>

              {points.length >= 2 && (
                <Typography font="inter-semibold" className="text-[#8A82B6] text-xs mt-0.5">
                  Hold and drag your finger across the chart to view score and date.
                </Typography>
              )}
            </View>
          )}
        </View>

        <View className="rounded-2xl border border-[#E3DAFF] bg-[#F6F3FF] p-4 shadow-sm overflow-hidden">
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
              <LineGraph
                points={points}
                animated={points.length > 1}
                color="#5B4BFF"
                enablePanGesture={points.length > 1}
                panGestureDelay={0}
                style={{ width: '100%', height: '100%' }}
                onGestureStart={handleGestureStart}
                onPointSelected={(p) => {
                  if (!p) return;
                  updateSelectedPoint(p);
                }}
                onGestureEnd={resetSelectedPoint}
              />
            </View>
          )}
        </View>

        {!loading && (
          <View className="flex-row justify-between items-center mt-5 bg-[#F0ECFF] p-1.5 rounded-xl border border-[#E3DAFF]">
            {(['6h', '1d', '1w', '1m', 'all'] as Timeframe[]).map((timeframe) => {
              const isActive = selectedTimeframe === timeframe;

              return (
                <TouchableOpacity
                  key={timeframe}
                  className="flex-1 items-center py-1.5"
                  onPress={() => setSelectedTimeframe(timeframe)}>
                  <Typography
                    font={isActive ? 'inter-semibold' : 'inter-medium'}
                    className={isActive ? 'text-[#5B4BFF]' : 'text-[#8A82B6]'}>
                    {TIMEFRAME_LABELS[timeframe]}
                  </Typography>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}
