/**
 * User controller – all endpoints with Google Sans fonts, game‑style ranks, base64 avatars.
 * 
 * Features:
 * - JSON analysis (/api/user/:username) with level, rankName, rankWithBullet
 * - Side‑by‑side comparison (/api/compare/:user1/:user2)
 * - SVG badge (/api/badge/:username) – avatar, name, rank with level (e.g., "MYTHIC • LV90")
 * - SVG profile card (/api/card/:username) – avatar, name, username+level, rank name only,
 *   following/followers, watermark, optional custom background images (?bgImage=1..6)
 * - Shields.io badges: /api/rank-badge/:username ("Rank MASTER" with separate colors),
 *   /api/rank-level/:username ("Level 90" with separate colors)
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
// Dynamic colors for rank names (based on your rank tiers)
// ----------------------------------------------------------------------
function getRankColor(rankName) {
  const colors = {
    'BEGINNER':    '#9ca3af',   // gray
    'NOVICE':      '#6b7280',   // darker gray
    'APPRENTICE':  '#3b82f6',   // blue
    'DEVELOPER':   '#10b981',   // green
    'EXPERT':      '#06b6d4',   // cyan
    'ELITE':       '#8b5cf6',   // purple
    'MASTER':      '#f59e0b',   // amber
    'GRANDMASTER': '#ef4444',   // red
    'LEGEND':      '#ec489a',   // pink
    'MYTHIC':      '#d946ef',   // fuchsia
    'GODLIKE':     '#ffaa44'    // gold-orange
  };
  return colors[rankName] || '#fbbf24'; // fallback yellow
}

// ----------------------------------------------------------------------
// Dynamic color for level number based on tier (same mapping as rank colors)
// ----------------------------------------------------------------------
function getLevelColor(level) {
  if (level >= 100) return '#ffaa44';     // GODLIKE gold
  if (level >= 90)  return '#d946ef';     // MYTHIC fuchsia
  if (level >= 80)  return '#ec489a';     // LEGEND pink
  if (level >= 70)  return '#ef4444';     // GRANDMASTER red
  if (level >= 60)  return '#f59e0b';     // MASTER amber
  if (level >= 50)  return '#8b5cf6';     // ELITE purple
  if (level >= 40)  return '#06b6d4';     // EXPERT cyan
  if (level >= 30)  return '#10b981';     // DEVELOPER green
  if (level >= 20)  return '#3b82f6';     // APPRENTICE blue
  if (level >= 10)  return '#6b7280';     // NOVICE gray
  return '#9ca3af';                       // BEGINNER light gray
}

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
// GET /api/compare/:user1/:user2 – includes level, rankName, rankWithBullet
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
// GET /api/badge/:username – avatar + name + rank with bullet (e.g., "MYTHIC • LV90")
// Supports ?theme=light|dark (no animation)
// ----------------------------------------------------------------------
export const generateBadge = async (req, res) => {
  try {
    const { username } = req.params;
    const theme = req.query.theme === 'light' ? 'light' : 'dark';

    const { scoreData } = await getUserAnalysisData(username);
    const rankWithBullet = getRankWithBullet(scoreData.score);

    const { data: rawUser } = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
      timeout: 5000,
    });
    const avatarBase64 = await getBase64Image(rawUser.avatar_url);
    const displayName = rawUser.name || username;
    const nameText = displayName.length > 14 ? displayName.slice(0, 11) + '...' : displayName;

    const bgGradient = theme === 'light'
      ? '<linearGradient id="g" x2="0" y2="100%"><stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient>'
      : '<linearGradient id="g" x2="0" y2="100%"><stop offset="0" stop-color="#334155"/><stop offset="1" stop-color="#1e293b"/></linearGradient>';
    
    const textColor = theme === 'light' ? '#0f172a' : '#f8fafc';
    const rankColor = theme === 'light' ? '#ea580c' : '#fbbf24';

    const width = 250;
    const height = 30;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>${bgGradient}<clipPath id="c"><circle cx="18" cy="15" r="10"/></clipPath></defs>
  <rect width="${width}" height="${height}" rx="6" fill="url(#g)"/>
  <image href="${escapeXml(avatarBase64)}" x="8" y="5" width="20" height="20" clip-path="url(#c)"/>
  <text x="36" y="19" fill="${textColor}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="12">${escapeXml(nameText)}</text>
  <text x="150" y="19" fill="${rankColor}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="12" font-weight="bold">${escapeXml(rankWithBullet)}</text>
</svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);
  } catch (err) {
    console.error('Badge error:', err.message);
    const fallbackSvg = `<svg width="250" height="30"><rect width="250" height="30" rx="6" fill="#1f2937"/><text x="125" y="19" text-anchor="middle" fill="#ef4444" font-size="12">Error</text></svg>`;
    res.status(404).setHeader('Content-Type', 'image/svg+xml').send(fallbackSvg);
  }
};

// ----------------------------------------------------------------------
// GET /api/rank-badge/:username – shows "Rank MASTER" with separate colors:
//   "Rank " in neutral gray, rank name in dynamic rank color
// Supports ?theme=light|dark
// ----------------------------------------------------------------------
export const generateRankBadge = async (req, res) => {
  try {
    const { username } = req.params;
    const theme = req.query.theme === 'light' ? 'light' : 'dark';

    const { scoreData } = await getUserAnalysisData(username);
    const rankName = getRankName(scoreData.score);
    
    const bgColor = theme === 'light' ? '#f8fafc' : '#1f2937';
    const labelColor = '#64748b';  // neutral gray for "Rank "
    const rankColor = getRankColor(rankName);

    const labelText = "RANK ";
    const rankText = rankName;
    const fullText = labelText + rankText;
    const width = Math.max(90, fullText.length * 8 + 20);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28" viewBox="0 0 ${width} 28">
  <rect width="${width}" height="28" rx="6" fill="${bgColor}" stroke="#e2e8f0" stroke-width="1"/>
  <text x="8" y="18" fill="${labelColor}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="12" font-weight="bold">${escapeXml(labelText)}</text>
  <text x="${8 + labelText.length * 7}" y="18" fill="${rankColor}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="12" font-weight="bold">${escapeXml(rankText)}</text>
</svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);
  } catch (err) {
    console.error('Rank badge error:', err.message);
    const fallbackSvg = `<svg width="100" height="28"><rect width="100" height="28" rx="6" fill="#1f2937"/><text x="50" y="18" text-anchor="middle" fill="#ef4444" font-size="12">Error</text></svg>`;
    res.status(404).setHeader('Content-Type', 'image/svg+xml').send(fallbackSvg);
  }
};

// ----------------------------------------------------------------------
// GET /api/rank-level/:username – shows "Level 90" with separate colors:
//   "Level " in neutral gray, level number in dynamic level color
// Supports ?theme=light|dark
// ----------------------------------------------------------------------
export const generateRankLevelBadge = async (req, res) => {
  try {
    const { username } = req.params;
    const theme = req.query.theme === 'light' ? 'light' : 'dark';

    const { scoreData } = await getUserAnalysisData(username);
    const level = Math.floor(scoreData.score);
    
    const bgColor = theme === 'light' ? '#f8fafc' : '#1f2937';
    const labelColor = '#64748b';  // neutral gray for "Level "
    const levelColor = getLevelColor(level);

    const labelText = "Level ";
    const levelText = level.toString();
    const fullText = labelText + levelText;
    const width = Math.max(80, fullText.length * 8 + 20);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="28" viewBox="0 0 ${width} 28">
  <rect width="${width}" height="28" rx="6" fill="${bgColor}" stroke="#e2e8f0" stroke-width="1"/>
  <text x="8" y="18" fill="${labelColor}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="12" font-weight="bold">${escapeXml(labelText)}</text>
  <text x="${8 + labelText.length * 7}" y="18" fill="${levelColor}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="12" font-weight="bold">${escapeXml(levelText)}</text>
</svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);
  } catch (err) {
    console.error('Level badge error:', err.message);
    const fallbackSvg = `<svg width="80" height="28"><rect width="80" height="28" rx="6" fill="#1f2937"/><text x="40" y="18" text-anchor="middle" fill="#ef4444" font-size="12">0</text></svg>`;
    res.status(404).setHeader('Content-Type', 'image/svg+xml').send(fallbackSvg);
  }
};

// ----------------------------------------------------------------------
// GET /api/card/:username – full profile card with optional custom background
// Supports ?theme=light|dark, ?bgImage=1..6
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
    const shortBio = bio ? (bio.length > 60 ? bio.slice(0, 57) + '...' : bio) : 'GitHub Developer';
    const level = Math.floor(score);
    const rankName = getRankName(score);

    const avatarBase64 = await getBase64Image(avatar_url);

    const width = 500;
    const height = 350;
    const avatarSize = 95;
    const avatarX = width / 2 - avatarSize / 2;
    const avatarY = 30;

    const colors = theme === 'light' ? {
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      rankColor: '#f97316',
      avatarGlow: '#cbd5e1',
      watermarkColor: '#9ca3af',
      overlayColor: 'rgba(255, 255, 255, 0.75)',
    } : {
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      rankColor: '#fbbf24',
      avatarGlow: '#334155',
      watermarkColor: '#64748b',
      overlayColor: 'rgba(0, 0, 0, 0.65)',
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
      <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2}" />
    </clipPath>
  </defs>

  <rect width="100%" height="100%" rx="20" filter="url(#shadow)" />
  ${backgroundSvg}

  <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2 + 6}" fill="${colors.avatarGlow}" opacity="0.4"/>
  <image href="${escapeXml(avatarBase64)}" x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" clip-path="url(#avatarClip)" />

  <g>
    <text x="${width/2}" y="${avatarY + avatarSize + 28}" text-anchor="middle" fill="${colors.textPrimary}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="22" font-weight="700">${escapeXml(displayName)}</text>
    <text x="${width/2}" y="${avatarY + avatarSize + 52}" text-anchor="middle" fill="${colors.textSecondary}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="14">@${escapeXml(username)} • LV${escapeXml(level)}</text>
    <text x="${width/2}" y="${avatarY + avatarSize + 76}" text-anchor="middle" fill="${colors.textMuted}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="13">${escapeXml(shortBio)}</text>
  </g>

  <g>
    <text x="${width/2}" y="240" text-anchor="middle" fill="${colors.rankColor}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="36" font-weight="800">${escapeXml(rankName)}</text>
  </g>

  <g transform="translate(${width/2 - 100}, 280)">
    <text x="0" y="0" text-anchor="middle" fill="${colors.textPrimary}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="18" font-weight="700">${escapeXml(following)}</text>
    <text x="0" y="18" text-anchor="middle" fill="${colors.textSecondary}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="11">Following</text>
  </g>
  <g transform="translate(${width/2 + 100}, 280)">
    <text x="0" y="0" text-anchor="middle" fill="${colors.textPrimary}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="18" font-weight="700">${escapeXml(followers)}</text>
    <text x="0" y="18" text-anchor="middle" fill="${colors.textSecondary}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="11">Followers</text>
  </g>

  <text x="${width - 12}" y="${height - 8}" text-anchor="end" fill="${colors.watermarkColor}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="9" opacity="0.6">githubsmartapi.vercel.app</text>
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
  <text x="250" y="160" text-anchor="middle" fill="#ef4444" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="18">Error: ${escapeXml(String(err.message))}</text>
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
