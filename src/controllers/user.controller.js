/**
 * User controller – all endpoints with Google Sans fonts, game‑style ranks, base64 avatars.
 * 
 * Features:
 * - JSON analysis (/api/user/:username) with level, rankName, rankWithBullet
 * - Side‑by‑side comparison (/api/compare/:user1/:user2)
 * - SVG profile card (/api/card/:username) – upgraded UI/UX
 * - Optional AI summaries, Redis caching, themes, custom backgrounds
 * 
 * Author: Shinei Nouzen (@Shineii86)
 * License: MIT
 */

import axios from 'axios';
import { fetchGitHubData, fetchContributions } from '../services/github.service.js';
import { analyzeUser } from '../services/analysis.service.js';
import { calculateScore } from '../services/scoring.service.js';
import { generateAISummary } from '../services/ai.service.js';
import { getCached, setCached } from '../services/cache.service.js';
import { getRankName, getRankWithBullet, getRankColor } from '../utils/rank.js';
import { getBase64Image } from '../utils/image.js';
import { isValidGitHubUsername } from '../utils/helpers.js';
import { config } from '../config/env.js';

// Custom background URLs
const CUSTOM_BG = [
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG1.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG2.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG3.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG4.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG5.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG6.png',
];

async function getBase64ImageFromUrl(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 8000,
    });
    const contentType = response.headers['content-type'];
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.warn(`[Background] Failed to fetch ${url}: ${err.message}`);
    return null;
  }
}

export const getUserAnalysisData = async (username) => {
  const cacheKey = `analysis:${username}`;
  const cached = await getCached(cacheKey);
  if (cached) return { ...cached, cached: true };

  const githubData = await fetchGitHubData(username);
  const contributions = await fetchContributions(username);
  const analysis = analyzeUser(githubData, contributions);
  const scoreData = calculateScore(analysis);

  const result = { analysis, scoreData };
  await setCached(cacheKey, result, config.cacheTtlSeconds);
  return result;
};

export const getUserAnalysis = async (req, res) => {
  try {
    const { username } = req.params;
    if (!isValidGitHubUsername(username)) {
      return res.status(400).json({ error: 'Invalid GitHub username format' });
    }

    const { analysis, scoreData, cached } = await getUserAnalysisData(username);
    let aiSummary = null;
    if (config.openAiKey) {
      aiSummary = await generateAISummary(analysis, scoreData);
    }

    const level = Math.floor(scoreData.score);
    const rankName = getRankName(scoreData.score);
    const rankWithBullet = getRankWithBullet(scoreData.score);
    const rankColor = getRankColor(scoreData.score);

    const response = {
      username,
      score: scoreData.score,
      level,
      rankName,
      rankWithBullet,
      rankColor,
      breakdown: scoreData.breakdown,
      profile: analysis.profile,
      stats: analysis.stats,
      topLanguages: analysis.languages,
      aiSummary,
      cached: !!cached,
      fetchedAt: new Date().toISOString(),
    };

    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json(response);
  } catch (err) {
    console.error(`[Analysis Error] ${req.params.username}:`, err);
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
};

export const compareUsers = async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    if (!isValidGitHubUsername(user1) || !isValidGitHubUsername(user2)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }

    const [data1, data2] = await Promise.all([
      getUserAnalysisData(user1),
      getUserAnalysisData(user2),
    ]);

    const enrich = (data, username) => {
      const level = Math.floor(data.scoreData.score);
      const rankName = getRankName(data.scoreData.score);
      const rankWithBullet = getRankWithBullet(data.scoreData.score);
      return {
        username,
        ...data.analysis,
        ...data.scoreData,
        level,
        rankName,
        rankWithBullet,
      };
    };

    res.json({
      user1: enrich(data1, user1),
      user2: enrich(data2, user2),
      winner: data1.scoreData.score > data2.scoreData.score ? user1 : user2,
    });
  } catch (err) {
    console.error('[Comparison Error]:', err);
    res.status(500).json({ error: err.message });
  }
};
