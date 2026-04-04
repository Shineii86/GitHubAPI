/**
 * Request handlers for user analysis, comparison, badges, and profile cards.
 * Supports:
 * - Light/dark theme (query param `?theme=light`)
 * - Animated stats (fade-in + count-up via SVG `<animate>`)
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
 * Professional profile card with:
 * - Avatar, name, bio, following/followers, rank, score
 * - Optional light theme (?theme=light)
 * - Optional animated stats (?animated=true)
 */
export const generateProfileCard = async (req, res) => {
  try {
    const { username } = req.params;
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const animated = req.query.animated === 'true';

    const { analysis, scoreData } = await getUserAnalysisData(username);
    const { data: rawUser } = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
      timeout: 5000,
    });

    const { avatar_url, followers, following, bio, name } = rawUser;
    const { rank, score } = scoreData;
    const displayName = name || username;
    const shortBio = bio ? (bio.length > 60 ? bio.slice(0, 57) + '...' : bio) : 'GitHub Developer';

    // Theme colours
    const colors = theme === 'light'
      ? {
          bgStart: '#f8f9fa',
          bgEnd: '#e9ecef',
          cardBg: '#ffffff',
          textPrimary: '#212529',
          textSecondary: '#6c757d',
          textMuted: '#adb5bd',
          rankGradStart: '#e67e22',
          rankGradEnd: '#f39c12',
          avatarGlow: '#dee2e6',
        }
      : {
          bgStart: '#1f1f2e',
          bgEnd: '#2a2a3b',
          cardBg: '#1f1f2e',
          textPrimary: '#ffffff',
          textSecondary: '#aaaaaa',
          textMuted: '#6c757d',
          rankGradStart: '#ffb347',
          rankGradEnd: '#ffcc33',
          avatarGlow: '#3a3a4e',
        };

    const width = 480;
    const height = 380;
    const avatarSize = 80;
    const avatarX = width / 2 - avatarSize / 2;
    const avatarY = 35;

    const rankAnimation = animated
      ? `<animate attributeName="opacity" from="0" to="1" dur="0.5s" fill="freeze"/>
         <animate attributeName="transform" type="scale" from="0.5" to="1" dur="0.4s" fill="freeze" additive="sum"/>`
      : '';
    const scoreAnimation = animated
      ? `<animate attributeName="opacity" from="0" to="1" dur="0.5s" fill="freeze"/>
         <animate attributeName="transform" type="scale" from="0.5" to="1" dur="0.4s" fill="freeze" additive="sum"/>`
      : '';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${colors.bgStart};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${colors.bgEnd};stop-opacity:1" />
    </linearGradient>
    <linearGradient id="rankGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${colors.rankGradStart}" />
      <stop offset="100%" style="stop-color:${colors.rankGradEnd}" />
    </linearGradient>
    <clipPath id="circleClip">
      <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2}" />
    </clipPath>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.15"/>
    </filter>
  </defs>

  <rect width="100%" height="100%" rx="16" fill="url(#bgGrad)" filter="url(#shadow)"/>
  <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2 + 4}" fill="${colors.avatarGlow}" />
  <image x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" href="${avatar_url}" clip-path="url(#circleClip)" />

  <text x="${width/2}" y="${avatarY + avatarSize + 22}" text-anchor="middle" fill="${colors.textPrimary}" font-family="Arial, sans-serif" font-size="18" font-weight="bold">${escapeXml(displayName)}</text>
  <text x="${width/2}" y="${avatarY + avatarSize + 42}" text-anchor="middle" fill="${colors.textSecondary}" font-family="Arial, sans-serif" font-size="13">@${escapeXml(username)}</text>
  <text x="${width/2}" y="${avatarY + avatarSize + 65}" text-anchor="middle" fill="${colors.textMuted}" font-family="Arial, sans-serif" font-size="12">${escapeXml(shortBio)}</text>

  <g transform="translate(${width/2 - 70}, ${height - 130})" ${animated ? 'opacity="0"' : ''}>
    ${animated ? rankAnimation : ''}
    <text x="0" y="0" text-anchor="middle" fill="url(#rankGrad)" font-family="'Courier New', monospace" font-size="48" font-weight="bold">${rank}</text>
    <text x="0" y="22" text-anchor="middle" fill="${colors.textSecondary}" font-size="11">RANK</text>
  </g>

  <g transform="translate(${width/2 + 70}, ${height - 130})" ${animated ? 'opacity="0"' : ''}>
    ${animated ? scoreAnimation : ''}
    <text x="0" y="0" text-anchor="middle" fill="${colors.textPrimary}" font-family="Arial, sans-serif" font-size="36" font-weight="bold">${score}</text>
    <text x="0" y="22" text-anchor="middle" fill="${colors.textSecondary}" font-size="11">SCORE</text>
  </g>

  <g transform="translate(${width/2 - 120}, ${height - 55})" ${animated ? 'opacity="0"' : ''}>
    ${animated ? `<animate attributeName="opacity" from="0" to="1" dur="0.6s" fill="freeze"/>` : ''}
    <text x="0" y="0" text-anchor="middle" fill="${colors.textPrimary}" font-size="18" font-weight="bold">${following}</text>
    <text x="0" y="20" text-anchor="middle" fill="${colors.textSecondary}" font-size="12">Following</text>
  </g>

  <g transform="translate(${width/2 + 120}, ${height - 55})" ${animated ? 'opacity="0"' : ''}>
    ${animated ? `<animate attributeName="opacity" from="0" to="1" dur="0.6s" fill="freeze"/>` : ''}
    <text x="0" y="0" text-anchor="middle" fill="${colors.textPrimary}" font-size="18" font-weight="bold">${followers}</text>
    <text x="0" y="20" text-anchor="middle" fill="${colors.textSecondary}" font-size="12">Followers</text>
  </g>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);
  } catch (err) {
    console.error('Card generation error:', err.message);
    const errorSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <rect width="400" height="200" fill="#2d2d2d" rx="12"/>
  <text x="200" y="110" text-anchor="middle" fill="#ff5555" font-family="monospace" font-size="16">User not found or API error</text>
</svg>`;
    res.status(404).setHeader('Content-Type', 'image/svg+xml').send(errorSvg);
  }
};

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
