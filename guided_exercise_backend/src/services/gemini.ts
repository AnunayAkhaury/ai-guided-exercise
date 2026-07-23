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

Write 1 short opening sentence followed by one line per exercise listed above, each on its own paragraph separated by a blank line. Follow these rules strictly:
- Opening sentence: Celebrate that the user attended ${sessionCount} sessions and highlight any score improvement. Keep it under 15 words.
- Exercise lines: For each exercise, write one line formatted exactly as "<ExerciseName>: <top issues to focus on>." Use the exact exercise name as-is. Keep each line under 15 words.
- Separate the opening sentence and every exercise line with a blank line (double newline) so each appears as its own paragraph.
- Use an encouraging, specific, motivating tone.
- NEVER suggest the user needs to attend more often or show up more.
- No bullet points, no numbered lists — just the plain lines described above.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
