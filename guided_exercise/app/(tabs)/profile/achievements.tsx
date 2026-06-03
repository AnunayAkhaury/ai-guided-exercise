import AchievementCard from "@/src/components/profile/AchievementCard";
import Header from "@/src/components/ui/Header";
import Typography from "@/src/components/ui/Typography";
import useUserAchievements from "@/src/hooks/useUserAchievements";
import { useRouter } from "expo-router";
import { FlatList, ScrollView, View } from "react-native";

export default function AchievementsPage() {
    const { data } = useUserAchievements();
    const router = useRouter();

    return (
    <View className="bg-[#FAF8FF] flex-1">
      <Header title="Achievements" showBack={true} onBack={() => router.replace("/(tabs)/profile")} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-9 px-4">
          <Typography font='inter-semibold' className="pb-5">{data.length} Achievement(s)</Typography>

          <View className="flex flex-row flex-wrap gap-4">
            {data.map((item) => 
              <View key={item.id}>
                <AchievementCard title={item["title"]} desc={item["description"]} />
              </View>
            )}
          </View>
          
        </View>
      </ScrollView>
    </View>
  );
}
