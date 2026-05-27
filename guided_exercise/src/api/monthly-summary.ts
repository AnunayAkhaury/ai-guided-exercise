export interface MonthlySummaryResponse {
  summary: string | null;
  month: string;
  sessionCount: number;
}

export async function getMonthlySummary(
  userId: string,
  year?: number,
  month?: number
): Promise<MonthlySummaryResponse | null> {
  try {
    const params = new URLSearchParams();
    if (year !== undefined) params.set('year', String(year));
    if (month !== undefined) params.set('month', String(month));

    const query = params.toString() ? `?${params.toString()}` : '';
    const url = `${process.env.EXPO_PUBLIC_API_URL}/api/monthly-summary/user/${userId}${query}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`getMonthlySummary failed with status ${response.status}:`, errorText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Network or parsing error in getMonthlySummary:', error);
    return null;
  }
}
