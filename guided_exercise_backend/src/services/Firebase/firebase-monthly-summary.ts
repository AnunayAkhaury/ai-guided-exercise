import { db } from './firebase-service.js';

export async function getCachedSummary(userId: string, month: string): Promise<string | null> {
  try {
    const snap = await db.collection('monthly_summaries').doc(`${userId}_${month}`).get();
    if (!snap.exists) return null;
    return (snap.data()?.summary as string) ?? null;
  } catch (error) {
    console.error('Error fetching monthly summary cache:', error);
    return null;
  }
}

export async function saveSummary(
  userId: string,
  month: string,
  summary: string,
  sessionCount: number
): Promise<void> {
  try {
    await db.collection('monthly_summaries').doc(`${userId}_${month}`).set({
      userId,
      month,
      summary,
      sessionCount,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Error saving monthly summary:', error);
    throw error;
  }
}
