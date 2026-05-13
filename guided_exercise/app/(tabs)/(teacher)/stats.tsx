import { LineGraph } from 'react-native-graph';
import { View, ActivityIndicator, ScrollView, TouchableOpacity } from 'react-native';
import Typography from '@/src/components/ui/Typography';
import Header from '@/src/components/ui/Header';
import { ExerciseFeedback } from '@/src/api/Firebase/firebase-feedback';
import { useEffect, useState, useMemo } from 'react';
import { getFeedbackFromUserId } from '@/src/api/Firebase/firebase-feedback';
import { useUserStore } from '@/src/store/userStore';

type GraphPoint = {
  value: number;
  date: Date;
};

export default function Stats() {
  const [scores, setScores] = useState<ExerciseFeedback[]>([]);
  const [points, setPoints] = useState<GraphPoint[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const uid = useUserStore((state) => state.uid);

  // 1. Fetch data
  useEffect(() => {
    if (!uid) return;
    async function fetchData() {
      try {
        setLoading(true);
        const res = await getFeedbackFromUserId(uid!);
        setScores(res || []);
        // Set initial tab if data exists
        if (res && res.length > 0) {
          setSelectedExercise(res[0].exercise);
        }
      } catch (e) {
        setError('Unable to load stats');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [uid]);

  // 2. Derive unique exercise names for tabs
  const exerciseTypes = useMemo(() => {
    return Array.from(new Set(scores.map((s) => s.exercise))).sort();
  }, [scores]);

  // 3. Format and Filter points based on selected tab
  useEffect(() => {
    if (!scores.length || !selectedExercise) return;

    const formatted = scores
      .filter((s) => s.exercise === selectedExercise)
      .map((s) => {
        const firstRepTimestamp = s.data && s.data.length > 0 ? s.data[0].timestampStart : Date.now();
        return {
          value: Number(s.score),
          date: new Date(firstRepTimestamp)
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    setPoints(formatted);
  }, [scores, selectedExercise]);

  return (
    <View className="flex-1 bg-[#FAF8FF]">
      <Header title="Your Progress" />

      <View className="px-5 pt-5">
        {/* Tabs Section */}
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
                  {type}
                </Typography>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Typography font="inter-semibold" className="text-[#4B3F7A] text-base mb-3">
          {selectedExercise ? `${selectedExercise} Score Trend` : 'Score Trend'}
        </Typography>

        {/* Graph Card */}
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
              <Typography className="text-[#6B6490] mt-2 text-center">
                {points.length === 0
                  ? `You haven't recorded any ${selectedExercise} sessions.`
                  : `Record one more ${selectedExercise} session to see your trend.`}
              </Typography>
            </View>
          ) : (
            <View style={{ width: '100%', height: 220 }}>
              <LineGraph
                points={points}
                animated={true}
                color="#5B4BFF"
                enablePanGesture
                style={{ width: '100%', height: '100%' }}
                range={{ y: { min: 0, max: 10 } }}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
