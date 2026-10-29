export function isGeneratedProfileName(value?: string | null): boolean {
  const normalized = value?.trim().toLowerCase() || '';
  return normalized === 'new instructor' || normalized === 'new student';
}

export function isPlaceholderProfileName(value?: string | null): boolean {
  const normalized = value?.trim().toLowerCase() || '';
  return isGeneratedProfileName(value) || normalized === 'instructor' || normalized === 'student';
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
  if (username && !isPlaceholderProfileName(username)) {
    return username;
  }
  return input.fallback;
}
