import { useEffect, useState } from "react";
import { Tabs, usePathname, useSegments } from "expo-router";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useUserStore } from "@/src/store/userStore";
import { AntDesign, Entypo, Ionicons, Octicons } from "@expo/vector-icons";
import { Alert, Platform, useWindowDimensions } from "react-native";
import { useCallStore } from "@/src/store/callStore";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabLayout() {
  const role = useUserStore((state) => state.role);
  const inCall = useCallStore((state) => state.inCall);
  const pathname = usePathname();
  const segments = useSegments();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const normalizedPath = (pathname || "").toLowerCase();
  const isSessionRoute = normalizedPath.endsWith('/session');
  const isWeb = Platform.OS === 'web';
  const isCompactPhone = width < 390 || height < 760;
  const routeSegments = segments as string[];
  const routeRole = routeSegments.includes('(teacher)')
    ? 'instructor'
    : routeSegments.includes('(student)')
      ? 'student'
      : null;
  const [devRoleOverride, setDevRoleOverride] = useState<'student' | 'instructor' | null>(
    routeRole ?? (__DEV__ ? 'instructor' : null)
  );

  useEffect(() => {
    if (role === 'student' || role === 'instructor') {
      setDevRoleOverride(role);
      return;
    }

    if (routeRole === 'student' || routeRole === 'instructor') {
      setDevRoleOverride(routeRole);
    }
  }, [role, routeRole]);

  const effectiveRole = role ?? (__DEV__ ? devRoleOverride : null);
  const showStudentTabs = effectiveRole === 'student';
  const showInstructorTabs = effectiveRole === 'instructor';
  const tabBarTopPadding = isWeb ? 8 : (isCompactPhone ? 8 : 10);
  const tabBarBottomPadding = isWeb ? 12 : Math.max(insets.bottom, isCompactPhone ? 8 : 10);
  const tabBarHeight = (isWeb ? 70 : (isCompactPhone ? 54 : 60)) + tabBarBottomPadding;
  const tabBarLabelFontSize = isWeb ? 12 : (isCompactPhone ? 11 : 12);
  const recordingsTitle = isCompactPhone ? "Videos" : "Recordings";
  const startMeetingTitle = isCompactPhone ? "Start" : "Start";

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
          borderTopWidth: 0,
          elevation: 0,
          height: tabBarHeight,
          paddingTop: tabBarTopPadding,
          paddingBottom: tabBarBottomPadding,
          paddingHorizontal: isWeb ? 8 : (isCompactPhone ? 4 : 8),
        },
        tabBarLabelStyle: {
          fontSize: tabBarLabelFontSize,
          fontFamily: "Inter_600SemiBold",
          textAlign: 'center',
        },
        tabBarItemStyle: {
          flex: 1,
          minWidth: 0,
          paddingVertical: isWeb ? 0 : (isCompactPhone ? 1 : 2),
        },
        tabBarIconStyle: {
          marginBottom: isWeb ? 2 : (isCompactPhone ? 1 : 3),
        },
        tabBarLabelPosition: 'below-icon',
        tabBarHideOnKeyboard: true,
        tabBarAllowFontScaling: false,
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "#000000",
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
          href: showStudentTabs ? "/(tabs)/(student)/classes" : null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(student)/recordings"
        options={{
          title: recordingsTitle,
          tabBarIcon: ({ color, size }) => (
            <Entypo name="folder-video" color={color} size={size} />
          ),
          href: showStudentTabs ? "/(tabs)/(student)/recordings" : null,
          headerShown: false,
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
          href: showInstructorTabs ? "/(tabs)/(teacher)/classes" : null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(teacher)/recordings"
        options={{
          title: recordingsTitle,
          tabBarIcon: ({ color, size }) => (
            <Entypo name="folder-video" color={color} size={size} />
          ),
          href: showInstructorTabs ? "/(tabs)/(teacher)/recordings" : null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(teacher)/start-meeting"
        options={{
          title: startMeetingTitle,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="screenshot-monitor" color={color} size={size} />
          ),
          href: showInstructorTabs ? "/(tabs)/(teacher)/start-meeting" : null,
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
          // Keep schedule reachable from the Classes screen CTA instead of overcrowding bottom navigation.
          href: null,
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
          href: showInstructorTabs ? "/(tabs)/(teacher)/students" : null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="session"
        options={{
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="(student)/session"
        options={{
          href: null,
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
