/**
 * Request handlers for user analysis, comparison, and badges.
 */
import { fetchGitHubData, fetchContributions } from '../services/github.service.js';
import { analyzeUser } from '../services/analysis.service.js';
import { calculateScore } from '../services/scoring.service.js';
import { generateAISummary } from '../services/ai.service.js';
import { getCached, setCached } from '../services/cache.service.js';

/**
 * Helper to get all analysis data for a user (without caching logic).
 * Used internally by compare and badge endpoints.
 */
export const getUserAnalysisData = async (username) => {
  const githubData = await fetchGitHubData(username);
  const contributions = await fetchContributions(username);
  const analysis = analyzeUser(githubData, contributions);
  const scoreData = calculateScore(analysis);
  return { analysis, scoreData };
};

/**
 * GET /api/user/:username
 * Returns full profile analysis, score, rank, and AI summary.
 */
export const getUserAnalysis = async (req, res) => {
  try {
    const { username } = req.params;

    // Check cache
    const cached = await getCached(`user:${username}`);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Fetch fresh data
    const { analysis, scoreData } = await getUserAnalysisData(username);

    // Generate AI summary (only if OpenAI is configured)
    let aiSummary = null;
    if (process.env.OPENAI_API_KEY) {
      aiSummary = await generateAISummary(analysis, scoreData);
    }

    const response = {
      username,
      score: scoreData.score,
      rank: scoreData.rank,
      profile: analysis.profile,
      stats: analysis.stats,
      topLanguages: analysis.languages,
      aiSummary,
      fetchedAt: new Date().toISOString(),
    };

    // Cache for 5 minutes
    await setCached(`user:${username}`, response, 300);

    res.json(response);
  } catch (err) {
    console.error(err);
    const status = err.response?.status === 404 ? 404 : 500;
    const message = err.response?.status === 404 ? 'GitHub user not found' : err.message;
    res.status(status).json({ error: message });
  }
};

/**
 * GET /api/compare/:user1/:user2
 * Returns side‑by‑side comparison of two users.
 */
export const compareUsers = async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const [data1, data2] = await Promise.all([
      getUserAnalysisData(user1),
      getUserAnalysisData(user2),
    ]);

    res.json({
      user1: { username: user1, ...data1.analysis, ...data1.scoreData },
      user2: { username: user2, ...data2.analysis, ...data2.scoreData },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/badge/:username
 * Returns an SVG badge with username, score, and rank.
 */
export const generateBadge = async (req, res) => {
  try {
    const { username } = req.params;
    const { scoreData } = await getUserAnalysisData(username);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="280" height="40" viewBox="0 0 280 40">
  <rect width="280" height="40" fill="#2d2d2d" rx="8"/>
  <text x="12" y="25" fill="white" font-family="monospace" font-size="14">${username}</text>
  <text x="180" y="25" fill="#ffcc00" font-family="monospace" font-size="14" font-weight="bold">${scoreData.rank}</text>
  <text x="230" y="25" fill="#ffffff" font-family="monospace" font-size="14">${scoreData.score}</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    res.status(500).send('Error generating badge');
  }
};
