import type { Request, Response } from 'express';
import { getFeedbackFromUserId, type Feedback } from '@/services/Firebase/firebase-feedback.js';
import { getCachedSummary, saveSummary } from '@/services/Firebase/firebase-monthly-summary.js';
import { generateMonthlySummary } from '@/services/gemini.js';
import { logControllerError, sendErrorResponse } from '@/utils/request-logging.js';

export async function getMonthlySummaryController(req: Request, res: Response) {
  try {
    const userId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
    if (!userId?.trim()) {
      return sendErrorResponse(req, res, 400, 'userId is required.');
    }

    const now = new Date();
    // Default to the most recently completed calendar month
    const targetDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = req.query.year ? parseInt(req.query.year as string, 10) : targetDate.getFullYear();
    const month = req.query.month ? parseInt(req.query.month as string, 10) : targetDate.getMonth() + 1;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return sendErrorResponse(req, res, 400, 'Invalid year or month.');
    }

    const monthLabel = `${year}-${String(month).padStart(2, '0')}`;
    const monthStart = new Date(year, month - 1, 1).getTime();
    const monthEnd = new Date(year, month, 1).getTime() - 1;

    // Check cache first
    const cached = await getCachedSummary(userId, monthLabel);
    if (cached) {
      return res.status(200).json({ summary: cached, month: monthLabel, sessionCount: null, cached: true });
    }

    // Query feedbacks for this month
    const allFeedbacks = await getFeedbackFromUserId(userId);
    if (!allFeedbacks) {
      return res.status(200).json({ summary: null, month: monthLabel, sessionCount: 0 });
    }

    const monthFeedbacks = allFeedbacks.filter((f: Feedback) => {
      const t = Number(f.starttime);
      return t >= monthStart && t <= monthEnd;
    });

    if (monthFeedbacks.length < 2) {
      return res.status(200).json({ summary: null, month: monthLabel, sessionCount: monthFeedbacks.length });
    }

    // Build prompt data
    const sessionCount = monthFeedbacks.length;
    const exercises = [...new Set(monthFeedbacks.map((f) => f.exercise).filter(Boolean))];

    const sorted = [...monthFeedbacks].sort((a, b) => Number(a.starttime) - Number(b.starttime));
    const half = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, half);
    const secondHalf = sorted.slice(half);
    const avgScore = (sessions: Feedback[]) =>
      sessions.reduce((sum, f) => sum + (Number(f.score) || 0), 0) / sessions.length;
    const scoreTrend = { firstHalf: avgScore(firstHalf), secondHalf: avgScore(secondHalf) };

    // Count all feedback strings across all sessions and exercises, ranked by frequency
    const issueCounts: Record<string, number> = {};
    for (const f of monthFeedbacks) {
      for (const d of f.data ?? []) {
        if (d.feedback?.trim()) {
          const key = d.feedback.trim();
          issueCounts[key] = (issueCounts[key] ?? 0) + 1;
        }
      }
    }
    const commonIssues = Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([issue]) => issue);

    const sessionSummaries = monthFeedbacks.map((f) => f.summary).filter(Boolean);

    const displayMonth = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const summary = await generateMonthlySummary(
      sessionCount,
      exercises,
      scoreTrend,
      commonIssues,
      sessionSummaries,
      displayMonth
    );

    await saveSummary(userId, monthLabel, summary, sessionCount);

    return res.status(200).json({ summary, month: monthLabel, sessionCount });
  } catch (err: any) {
    logControllerError(req, err, 'monthlySummaryController failed');
    return sendErrorResponse(req, res, 500, err?.message || 'Internal Server Error');
  }
}
