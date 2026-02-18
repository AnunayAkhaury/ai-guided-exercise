import { Tabs } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useUserStore } from "@/src/store/userStore";
import { AntDesign, Entypo, FontAwesome5, Ionicons } from "@expo/vector-icons";

export default function TabLayout() {
  const role = useUserStore((state) => state.role);
  const skipAuth = __DEV__ && role == null;

  return (
    <Tabs>
      {/* Student tabs */}
      <Tabs.Screen
        name="(student)/classes"
        options={{
          title: "Classes",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="chalkboard-teacher" color={color} size={size} />
          ),
          href: role === 'student' || skipAuth ? "/(tabs)/(student)/classes" : null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(student)/join-meeting"
        options={{
          title: "Join Meeting",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="screenshot-monitor" color={color} size={size} />
          ),
          href: role === 'student' || skipAuth ? "/(tabs)/(student)/join-meeting" : null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(student)/recordings"
        options={{
          title: "Recordings",
          tabBarIcon: ({ color, size }) => (
            <Entypo name="folder-video" color={color} size={size} />
          ),
          href: role === 'student' || skipAuth ? "/(tabs)/(student)/recordings" : null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(student)/session"
        options={{
          href: null,
          headerShown: false
        }}
      />

      {/* Instructor tabs */}
      <Tabs.Screen
        name="(teacher)/classes"
        options={{
          title: "Classes",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 name="chalkboard-teacher" color={color} size={size} />
          ),
          href: role === 'instructor' || skipAuth ? "/(tabs)/(teacher)/classes" : null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(teacher)/start-meeting"
        options={{
          title: "Start Meeting",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="screenshot-monitor" color={color} size={size} />
          ),
          href: role === 'instructor' || skipAuth ? "/(tabs)/(teacher)/start-meeting" : null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(teacher)/schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color, size }) => (
            <AntDesign name="schedule" color={color} size={size} />
          ),
          href: role === 'instructor' || skipAuth ? "/(tabs)/(teacher)/schedule" : null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(teacher)/students"
        options={{
          title: "Students",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" color={color} size={size} />
          ),
          href: role === 'instructor' || skipAuth ? "/(tabs)/(teacher)/students" : null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(teacher)/session"
        options={{
          title: "Session",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="screenshot-monitor" color={color} size={size} />
          ),
          href: role === 'instructor' || skipAuth ? "/(tabs)/(teacher)/session" : null,
          headerShown: false,
        }}
      />

      {/* Common tabs */}
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" color={color} size={size} />
          ),
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
