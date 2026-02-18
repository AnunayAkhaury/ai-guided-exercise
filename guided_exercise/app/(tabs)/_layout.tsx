import { Tabs } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useUserStore } from '@/src/store/userStore';

export default function TabLayout() {
  const role = useUserStore((state) => state.role);
  const skipAuth = __DEV__ && role == null;

  return (
    <Tabs>
      {/* Student tabs */}
      <Tabs.Screen
        name="(student)/classes"
        options={{
          title: 'Classes',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="screenshot-monitor" color={color} size={size} />,
          href: role === 'student' || skipAuth ? '/(tabs)/(student)/classes' : null
        }}
      />
      <Tabs.Screen
        name="(student)/recordings"
        options={{
          title: 'Recordings',
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="video-outline" color={color} size={size} />,
          href: role === 'student' || skipAuth ? '/(tabs)/(student)/recordings' : null,
          headerShown: false
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
          title: 'Classes',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="screenshot-monitor" color={color} size={size} />,
          href: role === 'instructor' || skipAuth ? '/(tabs)/(teacher)/classes' : null
        }}
      />
      <Tabs.Screen
        name="(teacher)/start-meeting"
        options={{
          title: 'Start Meeting',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="screenshot-monitor" color={color} size={size} />,
          href: role === 'instructor' || skipAuth ? '/(tabs)/(teacher)/start-meeting' : null
        }}
      />
      <Tabs.Screen
        name="(teacher)/students"
        options={{
          title: 'Students',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="screenshot-monitor" color={color} size={size} />,
          href: role === 'instructor' || skipAuth ? '/(tabs)/(teacher)/students' : null
        }}
      />
      <Tabs.Screen
        name="(teacher)/session"
        options={{
          href: null,
          headerShown: false
        }}
      />

      {/* Common tabs */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="person-outline" color={color} size={size} />,
          headerShown: false
        }}
      />
      <Tabs.Screen
        name="(student)/join-meeting"
        options={{
          title: 'Join Meeting',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="screenshot-monitor" color={color} size={size} />,
          href: '/(tabs)/(student)/join-meeting'
        }}
      />
    </Tabs>
  );
}
