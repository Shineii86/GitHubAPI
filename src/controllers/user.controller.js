/**
 * Request handlers for user analysis, comparison, badges, and profile cards.
 * 
 * Features:
 * - GitHub REST + GraphQL data fetching
 * - Advanced scoring (0–100 + rank D–SSS)
 * - AI summaries (OpenAI, optional)
 * - Redis caching (5 min TTL)
 * - Shields.io‑style badge (theme, animation, avatar)
 * - Glassmorphism profile card with contribution heatmap, golden rank frame, XP bar
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

// ----------------------------------------------------------------------
// Helper: get analysis + score (cached internally)
// ----------------------------------------------------------------------
export const getUserAnalysisData = async (username) => {
  const githubData = await fetchGitHubData(username);
  const contributions = await fetchContributions(username);
  const analysis = analyzeUser(githubData, contributions);
  const scoreData = calculateScore(analysis);
  return { analysis, scoreData };
};

// ----------------------------------------------------------------------
// Helper: rank title from score
// ----------------------------------------------------------------------
function getRankTitle(score) {
  if (score >= 95) return 'GRANDMASTER';
  if (score >= 80) return 'MASTER';
  if (score >= 65) return 'EXPERT';
  if (score >= 45) return 'REGULAR';
  if (score >= 25) return 'APPRENTICE';
  return 'BEGINNER';
}

// ----------------------------------------------------------------------
// GET /api/user/:username
// Returns full JSON analysis
// ----------------------------------------------------------------------
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

// ----------------------------------------------------------------------
// GET /api/compare/:user1/:user2
// ----------------------------------------------------------------------
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

// ----------------------------------------------------------------------
// GET /api/badge/:username
// SVG badge: avatar, name, rank, score, level
// ----------------------------------------------------------------------
export const generateBadge = async (req, res) => {
  try {
    const { username } = req.params;
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const animated = req.query.animated === 'true';

    const { scoreData } = await getUserAnalysisData(username);
    const { rank, score } = scoreData;

    const { data: rawUser } = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
      timeout: 5000,
    });

    const avatarUrl = rawUser.avatar_url;
    const displayName = rawUser.name || username;
    const nameText = displayName.length > 16 ? displayName.slice(0, 13) + '...' : displayName;
    const level = Math.floor(score);
    const rankTitle = getRankTitle(score);

    const bgGradient = theme === 'light'
      ? '<linearGradient id="g" x2="0" y2="100%"><stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient>'
      : '<linearGradient id="g" x2="0" y2="100%"><stop offset="0" stop-color="#334155"/><stop offset="1" stop-color="#1e293b"/></linearGradient>';
    
    const textColor = theme === 'light' ? '#0f172a' : '#f8fafc';
    const rankColor = theme === 'light' ? '#ea580c' : '#fbbf24';
    const scoreColor = theme === 'light' ? '#2563eb' : '#38bdf8';

    const width = 380;
    const height = 28;
    const animation = animated ? `<animate attributeName="opacity" from="0" to="1" dur="0.3s" fill="freeze"/>` : '';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>${bgGradient}<clipPath id="c"><circle cx="18" cy="14" r="10"/></clipPath></defs>
  <rect width="${width}" height="${height}" rx="6" fill="url(#g)"/>
  <image href="${escapeXml(avatarUrl)}" x="8" y="4" width="20" height="20" clip-path="url(#c)"/>
  <g opacity="0">${animation}
    <text x="36" y="18" fill="${textColor}" font-family="system-ui, sans-serif" font-size="12">${escapeXml(nameText)}</text>
    <text x="160" y="18" fill="${rankColor}" font-family="system-ui, sans-serif" font-size="12" font-weight="bold">${escapeXml(rankTitle)}</text>
    <text x="230" y="18" fill="${scoreColor}" font-family="system-ui, sans-serif" font-size="12" font-weight="bold">${escapeXml(score)}</text>
    <text x="290" y="18" fill="${textColor}" font-family="system-ui, sans-serif" font-size="11">LV${escapeXml(level)}</text>
  </g>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);
  } catch (err) {
    console.error('Badge error:', err.message);
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const bg = theme === 'light' ? '#f8fafc' : '#1f2937';
    const text = theme === 'light' ? '#1e293b' : '#f1f5f9';
    const fallbackSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="48" viewBox="0 0 300 48">
  <rect width="300" height="48" rx="12" fill="${bg}"/>
  <text x="150" y="28" text-anchor="middle" fill="${text}" font-family="system-ui, sans-serif" font-size="14">User not found</text>
</svg>`;
    res.status(404).setHeader('Content-Type', 'image/svg+xml').send(fallbackSvg);
  }
};

// ----------------------------------------------------------------------
// GET /api/card/:username
// SVG card: avatar, name, username, bio, rank, score, level, following, followers
// ----------------------------------------------------------------------
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

    const { followers, following, bio, name, avatar_url } = rawUser;
    const { rank, score } = scoreData;
    const displayName = name || username;
    const shortBio = bio ? (bio.length > 60 ? bio.slice(0, 57) + '...' : bio) : 'GitHub Developer';
    const level = Math.floor(score);
    const rankTitle = getRankTitle(score);

    const width = 500;
    const height = 320;
    const avatarSize = 96;
    const avatarX = width / 2 - avatarSize / 2;
    const avatarY = 30;

    const colors = theme === 'light' ? {
      bgStart: '#f1f5f9',
      bgEnd: '#e2e8f0',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      rankColor: '#f97316',
      scoreColor: '#3b82f6',
      avatarGlow: '#cbd5e1',
    } : {
      bgStart: '#0f172a',
      bgEnd: '#1e293b',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      rankColor: '#fbbf24',
      scoreColor: '#60a5fa',
      avatarGlow: '#334155',
    };

    const animationAttr = animated ? 'opacity="0"' : '';
    const fadeIn = animated ? `<animate attributeName="opacity" from="0" to="1" dur="0.6s" fill="freeze"/>` : '';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colors.bgStart}" />
      <stop offset="100%" stop-color="${colors.bgEnd}" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.2"/>
    </filter>
    <clipPath id="avatarClip">
      <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2}" />
    </clipPath>
  </defs>

  <rect width="100%" height="100%" rx="20" fill="url(#bgGrad)" filter="url(#shadow)"/>

  <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2 + 6}" fill="${colors.avatarGlow}" opacity="0.4"/>
  <image href="${escapeXml(avatar_url)}" x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" clip-path="url(#avatarClip)" />

  <g ${animationAttr}>${fadeIn}
    <text x="${width/2}" y="${avatarY + avatarSize + 28}" text-anchor="middle" fill="${colors.textPrimary}" font-family="system-ui, sans-serif" font-size="22" font-weight="700">${escapeXml(displayName)}</text>
    <text x="${width/2}" y="${avatarY + avatarSize + 52}" text-anchor="middle" fill="${colors.textSecondary}" font-family="system-ui, sans-serif" font-size="14">@${escapeXml(username)}</text>
    <text x="${width/2}" y="${avatarY + avatarSize + 76}" text-anchor="middle" fill="${colors.textMuted}" font-family="system-ui, sans-serif" font-size="13">${escapeXml(shortBio)}</text>
  </g>

  <g ${animationAttr}>${fadeIn}
    <text x="${width/2 - 100}" y="240" text-anchor="middle" fill="${colors.rankColor}" font-family="system-ui, sans-serif" font-size="36" font-weight="800">${escapeXml(rankTitle)}</text>
    <text x="${width/2}" y="240" text-anchor="middle" fill="${colors.scoreColor}" font-family="system-ui, sans-serif" font-size="28" font-weight="800">${escapeXml(score)}</text>
    <text x="${width/2 + 100}" y="240" text-anchor="middle" fill="${colors.textSecondary}" font-family="system-ui, sans-serif" font-size="20" font-weight="700">LV${escapeXml(level)}</text>

    <text x="${width/2 - 100}" y="260" text-anchor="middle" fill="${colors.textMuted}" font-size="11">RANK</text>
    <text x="${width/2}" y="260" text-anchor="middle" fill="${colors.textMuted}" font-size="11">SCORE</text>
    <text x="${width/2 + 100}" y="260" text-anchor="middle" fill="${colors.textMuted}" font-size="11">LEVEL</text>
  </g>

  <g transform="translate(${width/2 - 100}, 280)" ${animationAttr}>${fadeIn}
    <text x="0" y="0" text-anchor="middle" fill="${colors.textPrimary}" font-size="18" font-weight="700">${escapeXml(following)}</text>
    <text x="0" y="18" text-anchor="middle" fill="${colors.textSecondary}" font-size="11">Following</text>
  </g>
  <g transform="translate(${width/2 + 100}, 280)" ${animationAttr}>${fadeIn}
    <text x="0" y="0" text-anchor="middle" fill="${colors.textPrimary}" font-size="18" font-weight="700">${escapeXml(followers)}</text>
    <text x="0" y="18" text-anchor="middle" fill="${colors.textSecondary}" font-size="11">Followers</text>
  </g>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);
  } catch (err) {
    console.error('Card error:', err.message);
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const bg = theme === 'light' ? '#f3f4f6' : '#1e293b';
    const text = theme === 'light' ? '#111827' : '#f1f5f9';
    const errorSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="320" viewBox="0 0 500 320">
  <rect width="500" height="320" rx="20" fill="${bg}"/>
  <text x="250" y="160" text-anchor="middle" fill="#ef4444" font-family="system-ui, sans-serif" font-size="18">Error: ${escapeXml(String(err.message))}</text>
</svg>`;
    res.status(500).setHeader('Content-Type', 'image/svg+xml').send(errorSvg);
  }
};

// ----------------------------------------------------------------------
// Helper: safe XML escape
// ----------------------------------------------------------------------
function escapeXml(str) {
  if (str == null) return '';
  const s = String(str);
  return s.replace(/[<>&'"]/g, (ch) => {
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
