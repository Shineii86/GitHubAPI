/**
 * Request handlers for user analysis, comparison, badges, and profile cards.
 */
import axios from 'axios';
import { fetchGitHubData, fetchContributions } from '../services/github.service.js';
import { analyzeUser } from '../services/analysis.service.js';
import { calculateScore } from '../services/scoring.service.js';
import { generateAISummary } from '../services/ai.service.js';
import { getCached, setCached } from '../services/cache.service.js';

/**
 * Helper to get all analysis data for a user (without caching logic).
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
 */
export const getUserAnalysis = async (req, res) => {
  try {
    const { username } = req.params;

    const cached = await getCached(`user:${username}`);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    const { analysis, scoreData } = await getUserAnalysisData(username);

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
 * Simple horizontal badge (original)
 */
export const generateBadge = async (req, res) => {
  try {
    const { username } = req.params;
    const { scoreData } = await getUserAnalysisData(username);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="280" height="40" viewBox="0 0 280 40">
  <rect width="280" height="40" fill="#2d2d2d" rx="8"/>
  <text x="12" y="25" fill="white" font-family="monospace" font-size="14">${escapeXml(username)}</text>
  <text x="180" y="25" fill="#ffcc00" font-family="monospace" font-size="14" font-weight="bold">${scoreData.rank}</text>
  <text x="230" y="25" fill="#ffffff" font-family="monospace" font-size="14">${scoreData.score}</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    console.error('Badge error:', err.message);
    res.status(500).send('Error generating badge');
  }
};

/**
 * GET /api/card/:username
 * Professional profile card with photo, following/followers, rank, score
 */
export const generateProfileCard = async (req, res) => {
  try {
    const { username } = req.params;

    // 1. Get analysis & score
    const { analysis, scoreData } = await getUserAnalysisData(username);

    // 2. Fetch raw user data for avatar, following, bio (reuse token)
    const { data: rawUser } = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
      timeout: 5000,
    });

    const {
      avatar_url,
      followers,
      following,
      bio,
      name,
    } = rawUser;

    const { rank, score } = scoreData;
    const displayName = name || username;
    const shortBio = bio ? (bio.length > 60 ? bio.slice(0, 57) + '...' : bio) : 'GitHub Developer';

    // SVG dimensions
    const width = 480;
    const height = 320;
    const avatarSize = 80;
    const avatarX = width / 2 - avatarSize / 2;
    const avatarY = 40;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1f1f2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2a2a3b;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="rankGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#ffb347" />
      <stop offset="100%" style="stop-color:#ffcc33" />
    </linearGradient>
    <clipPath id="circleClip">
      <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2}" />
    </clipPath>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>

  <rect width="100%" height="100%" rx="16" fill="url(#bgGrad)" filter="url(#shadow)"/>
  <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2 + 4}" fill="#3a3a4e" />
  <image x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" href="${avatar_url}" clip-path="url(#circleClip)" />

  <text x="${width/2}" y="${avatarY + avatarSize + 25}" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="18" font-weight="bold">${escapeXml(displayName)}</text>
  <text x="${width/2}" y="${avatarY + avatarSize + 45}" text-anchor="middle" fill="#aaaaaa" font-family="Arial, sans-serif" font-size="13">@${escapeXml(username)}</text>
  <text x="${width/2}" y="${avatarY + avatarSize + 70}" text-anchor="middle" fill="#cccccc" font-family="Arial, sans-serif" font-size="12">${escapeXml(shortBio)}</text>

  <g transform="translate(${width/2 - 120}, ${height - 90})">
    <text x="0" y="0" text-anchor="middle" fill="#ffffff" font-size="16" font-weight="bold">${following}</text>
    <text x="0" y="20" text-anchor="middle" fill="#aaaaaa" font-size="12">Following</text>
  </g>
  <g transform="translate(${width/2 + 120}, ${height - 90})">
    <text x="0" y="0" text-anchor="middle" fill="#ffffff" font-size="16" font-weight="bold">${followers}</text>
    <text x="0" y="20" text-anchor="middle" fill="#aaaaaa" font-size="12">Followers</text>
  </g>

  <g transform="translate(${width/2 - 70}, ${height - 100})">
    <text x="0" y="0" text-anchor="middle" fill="url(#rankGrad)" font-family="'Courier New', monospace" font-size="48" font-weight="bold">${rank}</text>
    <text x="0" y="20" text-anchor="middle" fill="#aaaaaa" font-size="10">RANK</text>
  </g>

  <g transform="translate(${width/2 + 70}, ${height - 100})">
    <text x="0" y="0" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="36" font-weight="bold">${score}</text>
    <text x="0" y="20" text-anchor="middle" fill="#aaaaaa" font-size="10">SCORE</text>
  </g>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);
  } catch (err) {
    console.error('Card generation error:', err.message);
    // Send a graceful fallback SVG
    const errorSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <rect width="400" height="200" fill="#2d2d2d" rx="12"/>
  <text x="200" y="110" text-anchor="middle" fill="#ff5555" font-family="monospace" font-size="16">User not found or API error</text>
</svg>`;
    res.status(404).setHeader('Content-Type', 'image/svg+xml').send(errorSvg);
  }
};

/**
 * Helper: escape XML special characters
 */
function escapeXml(str) {
  if (!str) return '';
  return str.replace(/[<>&'"]/g, (ch) => {
    switch (ch) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return ch;
    }
  });
}
