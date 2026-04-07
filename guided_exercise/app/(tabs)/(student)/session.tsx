import { Redirect, useLocalSearchParams } from 'expo-router';

export default function StudentSessionRedirect() {
  const params = useLocalSearchParams<Record<string, string | string[] | undefined>>();
  return (
    <Redirect
      href={{
        pathname: '/(tabs)/session',
        params: {
          ...params,
          role: 'student'
        }
      }}
    />
  );
}
