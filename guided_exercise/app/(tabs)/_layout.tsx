import { useEffect, useState } from 'react';
import { Tabs, usePathname, useSegments } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useUserStore } from '@/src/store/userStore';
import { AntDesign, Entypo, Ionicons, Octicons } from '@expo/vector-icons';
import { Alert, Platform, Text, useWindowDimensions, View } from 'react-native';
import { useCallStore } from '@/src/store/callStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import HomeImage from '@/src/assets/images/home.svg'; 

function TabIcon({
  icon,
  focused,
  color,
  title,
}: {
  icon: React.ReactNode;
  focused: boolean;
  color: string;
  title: string;
}) {
  return (
    <View style={{ alignItems: 'center' }}>
      {icon}

      <Text
        numberOfLines={1}
        style={{
          fontSize: 12,
          color,
          marginTop: 2,
          width: 100,
          alignSelf: 'center',
          textAlign: 'center'
        }}
      >
        {title}
      </Text>

      {focused && (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: '#8B5CF6',
            marginTop: 4,
          }}
        />
      )}
    </View>
  );
}

export default function TabLayout() {
  const role = useUserStore((state) => state.role);
  const authInitialized = useUserStore((state) => state.authInitialized);
  const inCall = useCallStore((state) => state.inCall);
  const pathname = usePathname();
  const segments = useSegments();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const normalizedPath = (pathname || '').toLowerCase();
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

  const effectiveRole = authInitialized ? role ?? (__DEV__ ? devRoleOverride : null) : null;
  const showStudentTabs = effectiveRole === 'student';
  const showInstructorTabs = effectiveRole === 'instructor';
  const tabBarTopPadding = isWeb ? 10 : isCompactPhone ? 8 : 10;
  const tabBarBottomPadding = isWeb ? 5 : Math.max(insets.bottom, isCompactPhone ? 8 : 10);
  const tabBarHeight = (isWeb ? 70 : isCompactPhone ? 54 : 60) + tabBarBottomPadding;
  const tabBarLabelFontSize = isWeb ? 12 : isCompactPhone ? 11 : 12;
  const recordingsTitle = isCompactPhone ? 'Videos' : 'Recordings';
  const startMeetingTitle = isCompactPhone ? 'Start' : 'Start';

  return (
    <Tabs
      screenListeners={{
        tabPress: (event) => {
          if (!inCall && !isSessionRoute) return;
          event.preventDefault();
          Alert.alert('Call in progress', 'Leave or end the current session before switching tabs.');
        }
      }}
      screenOptions={{
        tabBarStyle: {
          display: !authInitialized || inCall || isSessionRoute ? 'none' : 'flex',
          backgroundColor: '#FBF5FF',
          borderTopWidth: 0,
          elevation: 0,
          height: tabBarHeight,
          paddingTop: tabBarTopPadding,
          paddingBottom: tabBarBottomPadding,
          paddingHorizontal: isWeb ? 8 : isCompactPhone ? 4 : 8
        },
        tabBarLabelStyle: {
          fontSize: tabBarLabelFontSize,
          fontFamily: 'Inter_600SemiBold',
          textAlign: 'center'
        },
        tabBarItemStyle: {
          flex: 1,
          minWidth: 0,
          paddingVertical: isWeb ? 0 : isCompactPhone ? 1 : 2
        },
        tabBarIconStyle: {
          marginBottom: isWeb ? 2 : isCompactPhone ? 1 : 3
        },
        tabBarLabelPosition: 'below-icon',
        tabBarHideOnKeyboard: true,
        tabBarAllowFontScaling: false,
        tabBarActiveTintColor: '#6155F5',
        tabBarInactiveTintColor: '#919191'
      }}>
      {/* Student tabs */}
      <Tabs.Screen
        name="(student)/classes"
        options={{
          title: 'Classes',
          tabBarShowLabel: false,
          tabBarIcon: ({ focused, color, size }) => 
            <TabIcon
              focused={focused}
              icon={
                <Image
                  source={HomeImage}
                  style={{ width: size, height: size, tintColor: color }}
                />
              }
              color={color}
              title="Classes"
            />,
          href: showStudentTabs ? '/(tabs)/(student)/classes' : null,
          headerShown: false
        }}
      />
      <Tabs.Screen
        name="(student)/recordings"
        options={{
          title: recordingsTitle,
          tabBarShowLabel: false,
          tabBarIcon: ({ focused, color, size }) => 
            <TabIcon
              focused={focused}
              color={color}
              icon={<Ionicons name="videocam-outline" color={color} size={size} />}
              title={recordingsTitle}
            />,
          href: showStudentTabs ? '/(tabs)/(student)/recordings' : null,
          headerShown: false
        }}
      />
      <Tabs.Screen
        name="(student)/stats"
        options={{
          title: 'Stats',
          tabBarShowLabel: false,
          tabBarIcon: ({ focused, color, size }) => 
            <TabIcon
              focused={focused}
              color={color}
              icon={<Entypo name="area-graph" color={color} size={size} />}
              title="Stats"
            />,
          href: showStudentTabs ? '/(tabs)/(student)/stats' : null,
          headerShown: false
        }}
      />

      {/* Instructor tabs */}
      <Tabs.Screen
        name="(teacher)/classes"
        options={{
          title: 'Classes',
          tabBarShowLabel: false,
          tabBarIcon: ({ focused, color, size }) =>
            <TabIcon
              focused={focused}
              color={color}
              icon={
                <Image
                  source={HomeImage}
                  style={{ width: size, height: size, tintColor: color }}
                />
              }
              title="Classes"
            />,
          href: showInstructorTabs ? '/(tabs)/(teacher)/classes' : null,
          headerShown: false
        }}
      />
      <Tabs.Screen
        name="(teacher)/recordings"
        options={{
          title: recordingsTitle,
          tabBarShowLabel: false,
          tabBarIcon: ({ focused, color, size }) =>
            <TabIcon
              focused={focused}
              color={color}
              icon={<Ionicons name="videocam-outline" color={color} size={size} />}
              title={recordingsTitle}
            />,
          href: showInstructorTabs ? '/(tabs)/(teacher)/recordings' : null,
          headerShown: false
        }}
      />
      <Tabs.Screen
        name="(teacher)/start-meeting"
        options={{
          title: startMeetingTitle,
          tabBarShowLabel: false,
          tabBarIcon: ({ focused, color, size }) =>
            <TabIcon
              focused={focused}
              color={color}
              icon={<MaterialIcons name="screenshot-monitor" color={color} size={size} />}
              title={startMeetingTitle}
            />,
          href: showInstructorTabs ? '/(tabs)/(teacher)/start-meeting' : null,
          headerShown: false
        }}
      />
      <Tabs.Screen
        name="(teacher)/schedule"
        options={{
          title: 'Schedule',
          tabBarShowLabel: false,
          tabBarIcon: ({ focused, color, size }) =>
            <TabIcon
              focused={focused}
              color={color}
              icon={<AntDesign name="schedule" color={color} size={size} />}
              title="Schedule"
            />,
          // Keep schedule reachable from the Classes screen CTA instead of overcrowding bottom navigation.
          href: null,
          headerShown: false
        }}
      />
      <Tabs.Screen
        name="(teacher)/students"
        options={{
          title: 'Students',
          tabBarShowLabel: false,
          tabBarIcon: ({ focused, color, size }) =>
            <TabIcon
              focused={focused}
              color={color}
              icon={<Ionicons name="people" color={color} size={size} />}
              title="Students"
            />,
          href: showInstructorTabs ? '/(tabs)/(teacher)/students' : null,
          headerShown: false
        }}
      />
      {/* TODO: Keep for testing only */}
      <Tabs.Screen
        name="(teacher)/stats"
        options={{
          title: 'Stats',
          tabBarShowLabel: false,
          tabBarIcon: ({ focused, color, size }) =>
            <TabIcon
              focused={focused}
              color={color}
              icon={<Entypo name="area-graph" color={color} size={size} />}
              title="Stats"
            />,
          href: showInstructorTabs ? '/(tabs)/(teacher)/stats' : null,
          headerShown: false
        }}
      />
      <Tabs.Screen
        name="session"
        options={{
          href: null,
          headerShown: false,
          tabBarShowLabel: false,
        }}
      />

      {/* Common tabs */}
      <Tabs.Screen
        name="video-ui-test"
        options={{
          title: 'UI Test',
          tabBarShowLabel: false,
          tabBarIcon: ({ focused, color, size }) =>
            <TabIcon
              focused={focused}
              color={color}
              icon={<Ionicons name="flask-outline" color={color} size={size} />} 
              title="UI Test"
            />,
          href: null,
          headerShown: false
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarShowLabel: false,
          tabBarIcon: ({ focused, color, size }) => 
            <TabIcon
              focused={focused}
              color={color}
              icon={<Ionicons name="person-outline" color={color} size={size} />}
              title="Profile"
            />,
          headerShown: false
        }}
      />
      <Tabs.Screen
        name="profile/achievements"
        options={{
          title: 'Achievements',
          href: null,
          headerShown: false,
          tabBarShowLabel: false,
        }}
      />
    </Tabs>
  );
}
