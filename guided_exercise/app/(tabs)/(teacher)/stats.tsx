import { LineGraph } from 'react-native-graph';
import { View, ActivityIndicator } from 'react-native';
import Typography from '@/src/components/ui/Typography';
import Header from '@/src/components/ui/Header';
import { ExerciseFeedback } from '@/src/api/Firebase/firebase-feedback';
import { useEffect, useState } from 'react';
import { getFeedbackFromUserId } from '@/src/api/Firebase/firebase-feedback';
import { useUserStore } from '@/src/store/userStore';

type GraphPoint = {
  value: number;
  date: Date;
};

export default function Stats() {
  const [scores, setScores] = useState<ExerciseFeedback[]>([]);
  const [points, setPoints] = useState<GraphPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const uid = useUserStore((state) => state.uid);

  useEffect(() => {
    if (!uid) return;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const res = await getFeedbackFromUserId(uid!);
        if (!res || res.length === 0) {
          console.log('No scores found');
          setScores([]);
        } else {
          console.log(res);
          setScores(res);
        }
      } catch (e: any) {
        console.error(e);
        setError('Unable to load stats');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [uid]);

  useEffect(() => {
    if (!scores || scores.length === 0) return;

    const formatted: GraphPoint[] = scores
      .map((s) => {
        // 1. Get the timestamp from the first rep in the data array
        // 2. Fallback to current time if for some reason data is empty
        const firstRepTimestamp = s.data && s.data.length > 0 ? s.data[0].timestampStart : Date.now();

        return {
          value: Number(s.score),
          date: new Date(firstRepTimestamp)
        };
      })
      // 3. Crucial: Sort by date so the line draws correctly left-to-right
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    setPoints(formatted);
  }, [scores]);

  useEffect(() => {
    if (!scores || scores.length === 0) return;

    const formatted: GraphPoint[] = scores
      .map((s) => {
        const firstRepTimestamp = s.data && s.data.length > 0 ? s.data[0].timestampStart : Date.now();

        return {
          value: Number(s.score),
          date: new Date(firstRepTimestamp)
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    console.log(formatted);
    setPoints(formatted);
  }, [scores]);

  return (
    <View className="flex-1 bg-[#FAF8FF]">
      <Header title="Your Progress" />

      <View className="px-5 pt-5">
        <Typography font="inter-semibold" className="text-[#4B3F7A] text-base mb-3">
          Score Trend
        </Typography>

        {/* Card */}
        <View className="rounded-2xl border border-[#E3DAFF] bg-[#F6F3FF] p-4 shadow-sm overflow-hidden">
          {loading ? (
            <View className="items-center py-10">
              <ActivityIndicator color="#5B4BFF" />
              <Typography className="text-[#6B6490] mt-3">Loading your stats...</Typography>
            </View>
          ) : error ? (
            <View className="items-center py-8">
              <Typography font="inter-semibold" className="text-[#5B4BFF]">
                Something went wrong
              </Typography>
              <Typography className="text-[#6B6490] mt-2 text-center">{error}</Typography>
            </View>
          ) : points.length < 2 ? (
            <View className="items-center py-8">
              <Typography font="inter-semibold" className="text-[#5B4BFF]">
                {points.length === 0 ? 'No data yet' : 'Collect more data'}
              </Typography>
              <Typography className="text-[#6B6490] mt-2 text-center">
                {points.length === 0
                  ? 'Complete some exercises to see your progress.'
                  : 'You need at least 2 sessions to see a trend line.'}
              </Typography>
            </View>
          ) : (
            <View style={{ width: '100%', height: 220 }}>
              <LineGraph
                points={points}
                animated={true}
                color="#5B4BFF"
                enablePanGesture
                // This ensures the SVG fills the View container
                style={{ width: '100%', height: '100%' }}
                // Optional: Keeps the scale consistent (0-10)
                range={{ y: { min: 0, max: 10 } }}
              />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
