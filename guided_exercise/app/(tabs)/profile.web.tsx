import { Image, ScrollView, StyleSheet, TouchableOpacity, View, ActivityIndicator, Text } from 'react-native';
import { AntDesign, Entypo, Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { ReactNode, useState } from 'react';
import { router } from 'expo-router';
import BgImage from '@/src/assets/images/profile-background.png';
import ProfileImage from '@/src/assets/images/default-profile.jpg';
import { logout } from '@/src/api/Firebase/firebase-auth';
import { useUserStore } from '@/src/store/userStore';
import { resolvePreferredDisplayName } from '@/src/utils/display-name';

function ActionRow({ icon, title, onPress, destructive = false }: { icon: ReactNode; title: string; onPress?: () => void; destructive?: boolean }) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress}>
      <View style={styles.actionLeft}>
        {icon}
        <Text style={[styles.actionText, destructive && styles.actionTextDestructive]}>{title}</Text>
      </View>
      <AntDesign name="right" size={12} color="#868686" />
    </TouchableOpacity>
  );
}

export default function ProfileWeb() {
  const username = useUserStore((state) => state.username);
  const fullname = useUserStore((state) => state.fullname);
  const role = useUserStore((state) => state.role);
  const email = useUserStore((state) => state.email);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const displayName = resolvePreferredDisplayName({
    fullname,
    username,
    fallback: 'User'
  });

  const showBrowserAlert = (title: string, message: string) => {
    if (typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;

    const confirmed = typeof window === 'undefined' ? true : window.confirm('Are you sure you want to log out?');
    if (!confirmed) {
      return;
    }

    try {
      setIsLoggingOut(true);
      await logout();
      router.replace('/(onboarding)/login');
    } catch (err: any) {
      showBrowserAlert('Logout failed', err?.message || 'Unable to log out.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleComingSoon = (title: string) => {
    showBrowserAlert(title, 'This page is not wired up yet.');
  };

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
          <View style={styles.banner}>
            <Image source={BgImage} resizeMode="cover" style={styles.bannerImage} />
          </View>

          <View style={styles.card}>
            <Image source={ProfileImage} resizeMode="cover" style={styles.avatar} />

            <View style={styles.identityBlock}>
              <Text style={styles.displayName}>{displayName}</Text>
              <Text style={styles.role}>{role === 'instructor' ? 'Instructor' : 'Student'}</Text>
              {email ? <Text style={styles.email}>{email}</Text> : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Personal</Text>
              <View style={styles.group}>
                <ActionRow icon={<MaterialIcons name="edit" size={18} color="#111" />} title="Edit Profile" onPress={() => router.push('/edit-profile')} />
                <View style={styles.divider} />
                <ActionRow
                  icon={<Ionicons name="ribbon-sharp" size={18} color="#111" />}
                  title="Achievements"
                  onPress={() => router.push('/(tabs)/profile/achievements')}
                />
                <View style={styles.divider} />
                <ActionRow
                  icon={<Ionicons name="notifications-outline" size={18} color="#111" />}
                  title="Notifications"
                  onPress={() => handleComingSoon('Notifications')}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Other</Text>
              <View style={styles.group}>
                <ActionRow
                  icon={<MaterialCommunityIcons name="hand-heart-outline" size={18} color="#111" />}
                  title="Donate Page"
                  onPress={() => handleComingSoon('Donate Page')}
                />
                <View style={styles.divider} />
                <ActionRow
                  icon={<AntDesign name="filetext1" size={18} color="#111" />}
                  title="Terms and Conditions"
                  onPress={() => handleComingSoon('Terms and Conditions')}
                />
                <View style={styles.divider} />
                <ActionRow
                  icon={<Entypo name="star-outlined" size={18} color="#111" />}
                  title="Rate App"
                  onPress={() => handleComingSoon('Rate App')}
                />
              </View>
            </View>

            <View style={[styles.group, styles.logoutGroup]}>
              <TouchableOpacity style={styles.actionRow} onPress={handleLogout} disabled={isLoggingOut}>
                <View style={styles.actionLeft}>
                  <MaterialCommunityIcons name="logout" size={18} color="#FF0000" />
                  {isLoggingOut ? (
                    <ActivityIndicator color="#FF0000" />
                  ) : (
                    <Text style={[styles.actionText, styles.actionTextDestructive]}>Logout</Text>
                  )}
                </View>
                {!isLoggingOut ? <AntDesign name="right" size={12} color="#868686" /> : null}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#F4F3FF'
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center'
  },
  shell: {
    width: '100%',
    maxWidth: 1080
  },
  banner: {
    width: '100%',
    height: 240,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#D8F0FF'
  },
  bannerImage: {
    width: '100%',
    height: '100%'
  },
  card: {
    marginTop: -52,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 30,
    paddingTop: 0,
    paddingBottom: 28,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4
  },
  avatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
    marginTop: -66,
    alignSelf: 'center'
  },
  identityBlock: {
    alignItems: 'center',
    marginTop: 18
  },
  displayName: {
    fontSize: 30,
    fontWeight: '700',
    color: '#161328'
  },
  role: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '600',
    color: '#666666'
  },
  email: {
    marginTop: 8,
    fontSize: 16,
    color: '#888888'
  },
  section: {
    marginTop: 32
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#17142B',
    marginBottom: 12
  },
  group: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#F6F5F5'
  },
  logoutGroup: {
    marginTop: 32
  },
  actionRow: {
    minHeight: 76,
    paddingHorizontal: 22,
    paddingVertical: 20,
    backgroundColor: '#F6F5F5',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    paddingRight: 12
  },
  actionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111111'
  },
  actionTextDestructive: {
    color: '#FF0000'
  },
  divider: {
    height: 1,
    backgroundColor: '#D5D5D5',
    marginHorizontal: 22
  }
});
