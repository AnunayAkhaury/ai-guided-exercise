import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? '');

export async function generateMonthlySummary(
  sessionCount: number,
  scoreTrend: { firstHalf: number; secondHalf: number },
  perExerciseIssues: Record<string, string[]>,
  sessionSummaries: string[],
  monthLabel: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

  const improved = scoreTrend.secondHalf > scoreTrend.firstHalf;
  const trendNote = improved
    ? `average score improved from ${scoreTrend.firstHalf.toFixed(1)} to ${scoreTrend.secondHalf.toFixed(1)}`
    : `average score was ${scoreTrend.secondHalf.toFixed(1)}`;

  const exerciseIssuesText = Object.entries(perExerciseIssues)
    .map(([exercise, issues]) => `- ${exercise}: ${issues.join('; ')}`)
    .join('\n');
  const summariesText = sessionSummaries.map((s, i) => `Session ${i + 1}: ${s}`).join(' | ');

  const prompt = `You are writing a monthly fitness recap for a user of an AI-guided exercise app.

Month: ${monthLabel}
Sessions attended: ${sessionCount}
Score trend: ${trendNote}
Top form issues by exercise (ranked by frequency):
${exerciseIssuesText}
Session summaries: ${summariesText}

Write 1 short opening sentence followed by one sentence per exercise listed above. Follow these rules strictly:
- Opening sentence: Celebrate that the user attended ${sessionCount} sessions and highlight any score improvement. Keep it under 15 words.
- Exercise sentences: For each exercise, write one sentence formatted as "<ExerciseName>: <top issues to focus on>." Use the exact exercise name as-is. Keep each sentence under 15 words.
- Use an encouraging, specific, motivating tone.
- NEVER suggest the user needs to attend more often or show up more.
- Write plain flowing prose — no bullet points, no numbered lists.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
