import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';

const COLORS = {
  primary: '#6155F5',
  secondary: '#0ea5e9',
  neutralDark: '#302E47',
  neutralLight: '#F5F2FF',
  action: '#f59e0b',
  muted: '#4E4680',
  border: '#E3E1FF',
};

// Placeholder store URLs — replace once the app is published
const APP_STORE_URL = 'http://guided-exercise.expo.app';
const PLAY_STORE_URL = 'https://play.google.com';

export default function LandingPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>

        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={[styles.logoBox, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.logoLetter}>G</Text>
            </View>
            <Text style={[styles.logoText, { color: COLORS.neutralDark }]}>Move Together, Heal Together</Text>
          </View>
        </View>

        <View style={[styles.mainLayout, { flexDirection: isLargeScreen ? 'row' : 'column' }]}>

          <View style={[styles.textColumn, { width: isLargeScreen ? '50%' : '100%' }]}>
            <Text style={[styles.headline, { color: COLORS.neutralDark }]}>
              Expert coaching.{'\n'}
              <Text style={{ color: COLORS.primary }}>Mobile & Web</Text> in sync.
            </Text>

            <Text style={[styles.subheadline, { color: COLORS.muted }]}>
              Get real-time AI feedback on your form, track your progress, and train with your instructor — wherever you are.
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.btnMobile, { backgroundColor: COLORS.primary }]}
                onPress={() => Linking.openURL(APP_STORE_URL)}>
                <Text style={styles.btnMobileText}>Download for iOS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.btnMobile, { backgroundColor: COLORS.primary }]}
                onPress={() => Linking.openURL(PLAY_STORE_URL)}>
                <Text style={styles.btnMobileText}>Download for Android</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.btnWeb, { borderColor: COLORS.primary }]}
                onPress={() => router.push('/auth-redirect')}>
                <Text style={[styles.btnWebText, { color: COLORS.primary }]}>Open Web App</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.radialWrapper, { width: isLargeScreen ? '50%' : '100%' }]}>
            <View style={styles.radialContainer}>

              <View style={[styles.phoneMockup, styles.phone1]}>
                <View style={[styles.screenContent, { backgroundColor: '#1e1b4b' }]}>
                  <View style={styles.screenHeader}>
                    <Text style={styles.screenTitle}>DASHBOARD</Text>
                    <View style={[styles.accentDot, { backgroundColor: COLORS.primary }]} />
                  </View>
                  <View style={styles.cardSimulator} />
                  <View style={[styles.cardSimulator, { width: '80%' }]} />
                </View>
              </View>

              <View style={[styles.phoneMockup, styles.phone2]}>
                <View style={[styles.screenContent, { backgroundColor: '#0f172a' }]}>
                  <View style={styles.screenHeader}>
                    <Text style={styles.screenTitle}>ANALYTICS</Text>
                    <View style={[styles.miniBadge, { backgroundColor: COLORS.action }]}>
                      <Text style={styles.miniBadgeText}>LIVE</Text>
                    </View>
                  </View>
                  <View style={styles.chartSimulator} />
                </View>
              </View>

              <View style={[styles.phoneMockup, styles.phone3]}>
                <View style={[styles.screenContent, { backgroundColor: '#1e1b4b' }]}>
                  <View style={styles.screenHeader}>
                    <Text style={styles.screenTitle}>PROFILE</Text>
                  </View>
                  <View style={styles.profileSimulator} />
                  <View style={styles.cardSimulator} />
                </View>
              </View>

            </View>
          </View>

        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}> Move Together, Heal Together. </Text>
          <TouchableOpacity onPress={() => router.push('/(onboarding)/login')}>
            <Text style={[styles.footerLink, { color: COLORS.primary }]}>Log in to existing account</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2FF',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logoText: {
    fontWeight: 'bold',
    fontSize: 20,
    marginLeft: 8,
    letterSpacing: -0.5,
  },
  mainLayout: {
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textColumn: {
    marginBottom: 40,
  },
  headline: {
    fontSize: 36,
    fontWeight: '900',
    lineHeight: 44,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  subheadline: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  btnMobile: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#2D2288',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  btnMobileText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  btnWeb: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnWebText: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  radialWrapper: {
    height: 420,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  radialContainer: {
    width: 200,
    height: 300,
    position: 'relative',
  },
  phoneMockup: {
    position: 'absolute',
    width: 140,
    height: 280,
    backgroundColor: '#111827',
    borderRadius: 20,
    borderWidth: 6,
    borderColor: '#111827',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  phone1: {
    left: -60,
    top: 20,
    transform: [{ rotate: '-18deg' }],
    zIndex: 1,
  },
  phone2: {
    left: 20,
    top: 0,
    transform: [{ rotate: '-2deg' }],
    zIndex: 2,
  },
  phone3: {
    left: 100,
    top: 30,
    transform: [{ rotate: '14deg' }],
    zIndex: 3,
  },
  screenContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  screenTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: 'bold',
  },
  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  miniBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniBadgeText: {
    color: '#ffffff',
    fontSize: 7,
    fontWeight: 'bold',
  },
  cardSimulator: {
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    marginVertical: 4,
  },
  chartSimulator: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: '#38bdf8',
    borderStyle: 'dashed',
    alignSelf: 'center',
    marginVertical: 20,
  },
  profileSimulator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
  },
  footer: {
    marginTop: 60,
    borderTopWidth: 1,
    borderTopColor: '#E3E1FF',
    width: '100%',
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
