import { Tabs } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="classes"
        options={{
          title: "Classes",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="screenshot-monitor" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="recordings"
        options={{
          title: "Recordings",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="folder-open" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="instructors"
        options={{
          title: "Instructors",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="people-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
