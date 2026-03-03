import { Redirect, useLocalSearchParams } from 'expo-router';

type SessionParams = {
  sessionName?: string;
  userName?: string;
  token?: string;
};

export default function LegacyTeacherSessionRoute() {
  const { sessionName, userName, token } = useLocalSearchParams<SessionParams>();

  return (
    <Redirect
      href={{
        pathname: '/(tabs)/(teacher)/session',
        params: { sessionName, userName, token }
      }}
    />
  );
}
