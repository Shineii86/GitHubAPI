/**
 * User controller – all endpoints with Google Sans fonts, game‑style ranks, base64 avatars.
 * 
 * Features:
 * - JSON analysis (/api/user/:username) with level, rankName, rankWithBullet
 * - Side‑by‑side comparison (/api/compare/:user1/:user2)
 * - SVG profile card (/api/card/:username) – Instagram‑like layout:
 *   [Username] • [Level]
 *   [Profile Picture]  [Followers]  [Following]
 *   [Rank]
 *   [Bio]
 *   Optional custom background images (?bgImage=1..6)
 * - Shields.io badges: /api/rank-level/:username ("Level 90" with separate colors)
 * - Optional AI summaries (OpenAI), Redis caching (5 min TTL)
 * - Light/dark themes via ?theme=light|dark
 * - Google Sans font stack (fallback to Product Sans, sans-serif)
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
import { getRankName, getRankWithBullet, getRankDetails } from '../utils/rank.js';
import { getBase64Image } from '../utils/image.js';

// ----------------------------------------------------------------------
// Custom background images for the profile card (hardcoded URLs)
// Add as many as you want – index starts at 1 for query param ?bgImage=1
// ----------------------------------------------------------------------
const CUSTOM_BG = [
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG1.png',   // ?bgImage=1
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG2.png',   // ?bgImage=2
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG3.png',   // ?bgImage=3
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG4.png',   // ?bgImage=4
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG5.png',   // ?bgImage=5
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG6.png',   // ?bgImage=6
];

async function getBase64ImageFromUrl(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    const contentType = response.headers['content-type'];
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.error('Failed to fetch background image:', url, err.message);
    return null;
  }
}

// ----------------------------------------------------------------------
// Helper: get analysis + score (cached)
// ----------------------------------------------------------------------
export const getUserAnalysisData = async (username) => {
  const githubData = await fetchGitHubData(username);
  const contributions = await fetchContributions(username);
  const analysis = analyzeUser(githubData, contributions);
  const scoreData = calculateScore(analysis);
  return { analysis, scoreData };
};

// ----------------------------------------------------------------------
// GET /api/user/:username – JSON with level, rankName, rankWithBullet
// ----------------------------------------------------------------------
export const getUserAnalysis = async (req, res) => {
  try {
    const { username } = req.params;
    const cached = await getCached(`user:${username}`);
    if (cached) return res.json({ ...cached, cached: true });
    const { analysis, scoreData } = await getUserAnalysisData(username);
    let aiSummary = null;
    if (process.env.OPENAI_API_KEY) {
      aiSummary = await generateAISummary(analysis, scoreData);
    }

    const level = Math.floor(scoreData.score);
    const rankName = getRankName(scoreData.score);
    const rankWithBullet = getRankWithBullet(scoreData.score);

    const response = {
      username,
      score: scoreData.score,
      rank: scoreData.rank,
      level,
      rankName,
      rankWithBullet,
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
// GET /api/vs/:user1/:user2 – includes level, rankName, rankWithBullet
// ----------------------------------------------------------------------
export const compareUsers = async (req, res) => {
  try {
    const { user1, user2 } = req.params;
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
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// ----------------------------------------------------------------------
// GET /api/card/:username – Instagram‑like profile card
// Supports ?theme=light|dark, ?bgImage=1..6
// Layout:
//   [Username] • [Level]
//   [Profile Picture]  [Followers]  [Following]
//   [Rank]
//   [Bio]
// ----------------------------------------------------------------------
export const generateProfileCard = async (req, res) => {
  try {
    const { username } = req.params;
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    
    const bgImageIndex = parseInt(req.query.bgImage, 10);
    let bgImageDataUrl = null;
    if (!isNaN(bgImageIndex) && bgImageIndex >= 1 && bgImageIndex <= CUSTOM_BG.length) {
      const rawUrl = CUSTOM_BG[bgImageIndex - 1];
      bgImageDataUrl = await getBase64ImageFromUrl(rawUrl);
    }

    const { analysis, scoreData } = await getUserAnalysisData(username);
    const { data: rawUser } = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
      timeout: 5000,
    });

    const { followers, following, bio, name, avatar_url } = rawUser;
    const { score } = scoreData;
    const displayName = name || username;
    const shortBio = bio ? (bio.length > 70 ? bio.slice(0, 67) + '...' : bio) : 'GitHub Developer';
    const level = Math.floor(score);
    const rankName = getRankName(score);

    const avatarBase64 = await getBase64Image(avatar_url);

    const width = 500;
    const height = 420;  // Slightly taller to fit new layout
    const avatarSize = 90;
    const avatarX = 35;
    const avatarY = 90;

    const colors = theme === 'light' ? {
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      rankColor: '#f97316',
      avatarGlow: '#cbd5e1',
      watermarkColor: '#9ca3af',
      overlayColor: 'rgba(255, 255, 255, 0.85)',
      statValue: '#0f172a',
      statLabel: '#64748b',
    } : {
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      rankColor: '#fbbf24',
      avatarGlow: '#334155',
      watermarkColor: '#64748b',
      overlayColor: 'rgba(0, 0, 0, 0.7)',
      statValue: '#f8fafc',
      statLabel: '#94a3b8',
    };

    let backgroundSvg = '';
    if (bgImageDataUrl) {
      backgroundSvg = `
    <image href="${escapeXml(bgImageDataUrl)}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
    <rect width="100%" height="100%" fill="${colors.overlayColor}" />
      `;
    } else {
      backgroundSvg = `
    <rect width="100%" height="100%" rx="20" fill="url(#bgGrad)" />
      `;
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme === 'light' ? '#f1f5f9' : '#0f172a'}" />
      <stop offset="100%" stop-color="${theme === 'light' ? '#e2e8f0' : '#1e293b'}" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.2"/>
    </filter>
    <clipPath id="avatarClip">
      <circle cx="${avatarX + avatarSize/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2}" />
    </clipPath>
  </defs>

  <rect width="100%" height="100%" rx="20" filter="url(#shadow)" />
  ${backgroundSvg}

  <!-- Row 1: Username • Level -->
  <text x="${width/2}" y="48" text-anchor="middle" fill="${colors.textPrimary}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="22" font-weight="700">${escapeXml(displayName)} • LV${escapeXml(level)}</text>

  <!-- Row 2: Avatar + Followers + Following -->
  <!-- Avatar with glow -->
  <circle cx="${avatarX + avatarSize/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2 + 5}" fill="${colors.avatarGlow}" opacity="0.4"/>
  <image href="${escapeXml(avatarBase64)}" x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" clip-path="url(#avatarClip)" />

  <!-- Followers stat block (to the right of avatar) -->
  <g transform="translate(${avatarX + avatarSize + 40}, ${avatarY + 12})">
    <text x="0" y="0" fill="${colors.statValue}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="20" font-weight="700">${escapeXml(followers)}</text>
    <text x="0" y="20" fill="${colors.statLabel}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="12">Followers</text>
  </g>

  <!-- Following stat block -->
  <g transform="translate(${avatarX + avatarSize + 160}, ${avatarY + 12})">
    <text x="0" y="0" fill="${colors.statValue}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="20" font-weight="700">${escapeXml(following)}</text>
    <text x="0" y="20" fill="${colors.statLabel}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="12">Following</text>
  </g>

  <!-- Row 3: Rank (big, centered) -->
  <text x="${width/2}" y="260" text-anchor="middle" fill="${colors.rankColor}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="34" font-weight="800" letter-spacing="1">${escapeXml(rankName)}</text>

  <!-- Row 4: Bio (centered, with some margin) -->
  <text x="${width/2}" y="310" text-anchor="middle" fill="${colors.textSecondary}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="13" font-style="italic">${escapeXml(shortBio)}</text>

  <!-- Watermark -->
  <text x="${width - 12}" y="${height - 12}" text-anchor="end" fill="${colors.watermarkColor}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="9" opacity="0.6">githubsmartapi.vercel.app</text>
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
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="420" viewBox="0 0 500 420">
  <rect width="500" height="420" rx="20" fill="${bg}"/>
  <text x="250" y="210" text-anchor="middle" fill="#ef4444" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="18">Error: ${escapeXml(String(err.message))}</text>
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
