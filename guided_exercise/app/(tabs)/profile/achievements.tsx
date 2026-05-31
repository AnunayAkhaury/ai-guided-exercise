import AchievementCard from "@/src/components/profile/AchievementCard";
import Header from "@/src/components/ui/Header";
import Typography from "@/src/components/ui/Typography";
import useUserAchievements from "@/src/hooks/useUserAchievements";
import { FlatList, ScrollView, View } from "react-native";

export default function AchievementsPage() {
    const { data } = useUserAchievements();

    return (
    <View className="bg-white flex-1">
      <Header title="Achievements" />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-9">
          <Typography font='inter-semibold' className="pl-4 pb-5">{data.length} Achievement(s)</Typography>

          <FlatList
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <AchievementCard title={item["title"]} desc={item["description"]} />}
          />
        </View>
      </ScrollView>
    </View>
  );
}
