import { House, Trophy, User } from 'lucide-react-native';
import { View, Text, Pressable, Image } from 'react-native';
import { useRouter, usePathname, Slot, Href } from 'expo-router';
import LogoImage from '@/src/assets/images/logo.png'; 
import { AntDesign, Entypo, Ionicons, MaterialIcons } from '@expo/vector-icons';
import HomeImage from '@/src/assets/images/home.svg'; 

export const getPathname = (href: Href | string) => typeof href === "string" ? href : href.pathname;

function NavItem({
  route,
  icon,
  title,
}: {
  route: Href;
  icon: (color: string) => React.ReactNode;
  title: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const focused = getPathname(pathname).split("/").pop() === getPathname(route).split("/").pop();

  const color = focused ? '#8B5CF6' : '#8E8E93';

  return (
    <Pressable
      onPress={() => router.push(route)}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
      }}
    >
      {icon(color)}

      <Text
        numberOfLines={1}
        style={{
          fontSize: 12,
          color,
          marginTop: 2,
          textAlign: 'center',
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
    </Pressable>
  );
}

function Navbar({ showInstructorTabs } : {showInstructorTabs: boolean}) {
  return (
    <View
      style={{
        height: 80,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingHorizontal: 32,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE',
        backgroundColor: '#F7F5FF',
      }}
    >
      <Image
        source={LogoImage}
        resizeMode='contain'
        style={{position: 'absolute', left: 0, bottom: -20, width: 200}}
      />

      
      <View
        style={{
          flexDirection: 'row',
          gap: 12,
        }}
      >
        <NavItem
          route={showInstructorTabs ? "/(tabs)/(teacher)/classes" : "/(tabs)/(student)/classes" }
          title="Classes"
          icon={(color) => (
            <Image
              source={HomeImage}
              style={{ width: 24, height: 24, tintColor: color }}
            />
          )}
        />

        <NavItem
          route={showInstructorTabs ? "/(tabs)/(teacher)/recordings" : "/(tabs)/(student)/recordings" }
          title="Recordings"
          icon={(color) => (
            <Ionicons name="videocam-outline" color={color} size={24} />
          )}
        />

        {showInstructorTabs &&
          <NavItem
            route="/(tabs)/(teacher)/start-meeting"
            title="Start"
            icon={(color) => (
              <Ionicons name="add-circle-outline" color={color} size={24} />
            )}
          />
        }

        {showInstructorTabs &&
          <NavItem
            route="/(tabs)/(teacher)/students"
            title="Students"
            icon={(color) => (
              <Ionicons name="people" color={color} size={24} />
            )}
          />
        }

        <NavItem
          route={showInstructorTabs ? "/(tabs)/(teacher)/stats" : "/(tabs)/(student)/stats" }
          title="Stats"
          icon={(color) => (
            <Entypo name="area-graph" color={color} size={24} />
          )}
        />

        <NavItem
          route="/profile"
          title="Profile"
          icon={(color) => (
            <User size={24} color={color} />
          )}
        />
      </View>
    </View>
  );
}

export default function WebLayout({ showInstructorTabs } : { showInstructorTabs: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <Navbar showInstructorTabs={showInstructorTabs} />

      <Slot />
    </View>
  );
}
