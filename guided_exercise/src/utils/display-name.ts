export function isPlaceholderProfileName(value?: string | null): boolean {
  const normalized = value?.trim().toLowerCase() || '';
  return normalized === 'new instructor' || normalized === 'new student' || normalized === 'instructor' || normalized === 'student';
}

export function resolvePreferredDisplayName(input: {
  fullname?: string | null;
  username?: string | null;
  fallback: string;
}): string {
  const fullname = input.fullname?.trim();
  const username = input.username?.trim();

  if (fullname && !isPlaceholderProfileName(fullname)) {
    return fullname;
  }
  if (username) {
    return username;
  }
  if (fullname) {
    return fullname;
  }
  return input.fallback;
}
