import { Tabs, usePathname } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useUserStore } from "@/src/store/userStore";
import { AntDesign, Entypo, Ionicons, Octicons } from "@expo/vector-icons";
import { Alert } from "react-native";
import { useCallStore } from "@/src/store/callStore";
import { useEffect } from "react";

export default function TabLayout() {
  const role = useUserStore((state) => state.role);
  const inCall = useCallStore((state) => state.inCall);
  const setInCall = useCallStore((state) => state.setInCall);
  const pathname = usePathname();
  const skipAuth = __DEV__ && role == null;
  const normalizedPath = (pathname || "").toLowerCase();
  const isSessionRoute =
    normalizedPath.endsWith('/session') ||
    normalizedPath.includes('/(teacher)/session') ||
    normalizedPath.includes('/(student)/session');

  useEffect(() => {
    if (!isSessionRoute && inCall) {
      setInCall(false);
    }
  }, [inCall, isSessionRoute, setInCall]);

  return (
    <Tabs
      screenListeners={{
        tabPress: (event) => {
          if (!inCall && !isSessionRoute) return;
          event.preventDefault();
          Alert.alert(
            "Call in progress",
            "Leave or end the current session before switching tabs."
          );
        },
      }}
      screenOptions={{
        tabBarStyle: {
          display: inCall || isSessionRoute ? "none" : "flex",
          backgroundColor: "#A980FE",
          height: 80,
          paddingTop: 13,
        },
        tabBarLabelStyle: {
          fontSize: 14,
          fontFamily: "Inter_600SemiBold",
        },
        tabBarActiveTintColor: "#6155F5",
        tabBarInactiveTintColor: "#000",
      }}
    >
      {/* Student tabs */}
      <Tabs.Screen
        name="(student)/classes"
        options={{
          title: "Classes",
          tabBarIcon: ({ color, size }) => (
            <AntDesign name="book" color={color} size={size} />
          ),
          href: role === 'student' || skipAuth ? "/(tabs)/(student)/classes" : null,
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
            <AntDesign name="book" color={color} size={size} />
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
          href: null,
          headerShown: false,
        }}
      />

      {/* Common tabs */}
      <Tabs.Screen
        name="video-ui-test"
        options={{
          title: "UI Test",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flask-outline" color={color} size={size} />
          ),
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Octicons name="person" color={color} size={size} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile/achievements"
        options={{
          title: "Achievements",
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
