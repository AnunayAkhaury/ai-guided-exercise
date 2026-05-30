import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY ?? '');

export async function generateMonthlySummary(
  sessionCount: number,
  exercises: string[],
  scoreTrend: { firstHalf: number; secondHalf: number },
  commonIssues: string[],
  sessionSummaries: string[],
  monthLabel: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const exerciseList = exercises.join(', ');
  const improved = scoreTrend.secondHalf > scoreTrend.firstHalf;
  const trendNote = improved
    ? `average score improved from ${scoreTrend.firstHalf.toFixed(1)} to ${scoreTrend.secondHalf.toFixed(1)}`
    : `average score was ${scoreTrend.secondHalf.toFixed(1)}`;

  const issuesList = commonIssues.map((issue, i) => `${i + 1}. ${issue}`).join('; ');
  const summariesText = sessionSummaries.map((s, i) => `Session ${i + 1}: ${s}`).join(' | ');

  const prompt = `You are writing a monthly fitness recap for a user of an AI-guided exercise app.

Month: ${monthLabel}
Sessions attended: ${sessionCount}
Exercise(s): ${exerciseList}
Score trend: ${trendNote}
Top 3 form issues this month (ranked by frequency): ${issuesList}
Session summaries: ${summariesText}

Write exactly 3 sentences totaling 50 words or fewer. Follow these rules strictly:
- Sentence 1: Celebrate that the user attended ${sessionCount} sessions and highlight any score improvement.
- Sentence 2 & 3: Name all 3 form issues from the list above as the key areas to focus on.
- Use an encouraging, specific, motivating tone.
- NEVER suggest the user needs to attend more often or show up more.
- Write plain flowing prose — no bullet points, no numbered lists.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
