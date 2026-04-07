/**
 * User controller – Instagram-style profile cards with Google Sans fonts, game‑style ranks, base64 avatars.
 * 
 * Features:
 * - JSON analysis (/api/user/:username) with level, rankName, rankWithBullet
 * - Side‑by‑side comparison (/api/compare/:user1/:user2)
 * - Instagram-style SVG profile card (/api/card/:username) – username•level, avatar+stats, rank, bio
 * - Optional AI summaries (OpenAI), Redis caching (5 min TTL)
 * - Light/dark themes via ?theme=light|dark
 * - Custom backgrounds via ?bgImage=1..6
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
// ----------------------------------------------------------------------
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
// Dynamic colors for rank names
// ----------------------------------------------------------------------
function getRankColor(rankName) {
  const colors = {
    'BEGINNER':    '#9ca3af',
    'NOVICE':      '#6b7280',
    'APPRENTICE':  '#3b82f6',
    'DEVELOPER':   '#10b981',
    'EXPERT':      '#06b6d4',
    'ELITE':       '#8b5cf6',
    'MASTER':      '#f59e0b',
    'GRANDMASTER': '#ef4444',
    'LEGEND':      '#ec489a',
    'MYTHIC':      '#d946ef',
    'GODLIKE':     '#ffaa44'
  };
  return colors[rankName] || '#fbbf24';
}

// ----------------------------------------------------------------------
// Dynamic color for level number based on tier
// ----------------------------------------------------------------------
function getLevelColor(level) {
  if (level >= 100) return '#ffaa44';
  if (level >= 90)  return '#d946ef';
  if (level >= 80)  return '#ec489a';
  if (level >= 70)  return '#ef4444';
  if (level >= 60)  return '#f59e0b';
  if (level >= 50)  return '#8b5cf6';
  if (level >= 40)  return '#06b6d4';
  if (level >= 30)  return '#10b981';
  if (level >= 20)  return '#3b82f6';
  if (level >= 10)  return '#6b7280';
  return '#9ca3af';
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
// GET /api/card/:username – Instagram-style profile card
// Layout:
//   [Username] • [Level]
//   [Profile Picture]  [Followers]  [Following]
//   [Rank]
//   [Bio]
// Supports ?theme=light|dark, ?bgImage=1..6
// ----------------------------------------------------------------------
export const generateProfileCard = async (req, res) => {
  try {
    const { username } = req.params;
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    
    // Handle custom background
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
    const shortBio = bio ? (bio.length > 80 ? bio.slice(0, 77) + '...' : bio) : 'GitHub Developer';
    const level = Math.floor(score);
    const rankName = getRankName(score);
    const rankColor = getRankColor(rankName);

    const avatarBase64 = await getBase64Image(avatar_url);

    // Card dimensions
    const width = 420;
    const height = 520;
    
    // Theme colors
    const colors = theme === 'light' ? {
      bgPrimary: '#ffffff',
      bgSecondary: '#f8fafc',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      border: '#e2e8f0',
      avatarBorder: '#ffffff',
      watermarkColor: '#94a3b8',
      overlayColor: 'rgba(255, 255, 255, 0.85)',
    } : {
      bgPrimary: '#1e293b',
      bgSecondary: '#0f172a',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      border: '#334155',
      avatarBorder: '#1e293b',
      watermarkColor: '#64748b',
      overlayColor: 'rgba(15, 23, 42, 0.85)',
    };

    // Build background layer
    let backgroundLayer = '';
    if (bgImageDataUrl) {
      backgroundLayer = `
    <image href="${escapeXml(bgImageDataUrl)}" width="100%" height="140" preserveAspectRatio="xMidYMid slice" />
    <rect width="100%" height="140" fill="${colors.overlayColor}" />
      `;
    } else {
      backgroundLayer = `
    <rect width="100%" height="140" fill="url(#headerGrad)" />
      `;
    }

    // Stats positioning (next to avatar)
    const avatarX = 24;
    const avatarY = 100;
    const avatarSize = 88;
    const statsStartX = avatarX + avatarSize + 20;
    
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme === 'light' ? '#6366f1' : '#7c3aed'}" />
      <stop offset="100%" stop-color="${theme === 'light' ? '#8b5cf6' : '#a855f7'}" />
    </linearGradient>
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.15"/>
    </filter>
    <clipPath id="avatarClip">
      <circle cx="${avatarX + avatarSize/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2}" />
    </clipPath>
  </defs>

  <!-- Main card background -->
  <rect width="${width}" height="${height}" rx="16" fill="${colors.bgPrimary}" filter="url(#cardShadow)" />
  
  <!-- Header gradient / custom bg -->
  <rect width="${width}" height="140" rx="16" ry="16" />
  <clipPath id="headerClip">
    <rect width="${width}" height="140" rx="16" ry="16" />
  </clipPath>
  <g clip-path="url(#headerClip)">
    ${backgroundLayer}
  </g>

  <!-- Username • Level (top center) -->
  <text x="${width/2}" y="32" text-anchor="middle" fill="${colors.textPrimary}" 
        font-family="'Google Sans', 'Product Sans', sans-serif" font-size="18" font-weight="700">
    ${escapeXml(displayName)} • LV${escapeXml(level)}
  </text>

  <!-- Profile Picture with border -->
  <circle cx="${avatarX + avatarSize/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2 + 4}" fill="${colors.avatarBorder}" />
  <image href="${escapeXml(avatarBase64)}" x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" 
         clip-path="url(#avatarClip)" />

  <!-- Followers / Following stats (right of avatar) -->
  <g transform="translate(${statsStartX}, ${avatarY + 8})">
    <text x="0" y="0" fill="${colors.textPrimary}" font-family="'Google Sans', 'Product Sans', sans-serif" 
          font-size="20" font-weight="700">${escapeXml(following)}</text>
    <text x="0" y="18" fill="${colors.textMuted}" font-family="'Google Sans', 'Product Sans', sans-serif" 
          font-size="11">Following</text>
  </g>
  <g transform="translate(${statsStartX + 85}, ${avatarY + 8})">
    <text x="0" y="0" fill="${colors.textPrimary}" font-family="'Google Sans', 'Product Sans', sans-serif" 
          font-size="20" font-weight="700">${escapeXml(followers)}</text>
    <text x="0" y="18" fill="${colors.textMuted}" font-family="'Google Sans', 'Product Sans', sans-serif" 
          font-size="11">Followers</text>
  </g>

  <!-- Rank badge (prominent, colored) -->
  <g transform="translate(${width/2}, 230)">
    <rect x="-60" y="-18" width="120" height="36" rx="18" fill="${colors.bgSecondary}" stroke="${rankColor}" stroke-width="2"/>
    <text x="0" y="6" text-anchor="middle" fill="${rankColor}" 
          font-family="'Google Sans', 'Product Sans', sans-serif" font-size="16" font-weight="800">
      ${escapeXml(rankName)}
    </text>
  </g>

  <!-- Bio section -->
  <g transform="translate(24, 290)">
    <rect width="${width - 48}" height="160" rx="12" fill="${colors.bgSecondary}" opacity="0.6"/>
    <text x="16" y="24" fill="${colors.textSecondary}" font-family="'Google Sans', 'Product Sans', sans-serif" 
          font-size="13" font-weight="500" line-height="1.5">
      ${escapeXml(shortBio)}
    </text>
  </g>

  <!-- Watermark -->
  <text x="${width - 10}" y="${height - 8}" text-anchor="end" fill="${colors.watermarkColor}" 
        font-family="'Google Sans', 'Product Sans', sans-serif" font-size="8" opacity="0.7">
    githubsmartapi.vercel.app
  </text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);
  } catch (err) {
    console.error('Card error:', err.message);
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const bg = theme === 'light' ? '#f8fafc' : '#1e293b';
    const text = theme === 'light' ? '#0f172a' : '#f8fafc';
    const errorSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="520" viewBox="0 0 420 520">
  <rect width="420" height="520" rx="16" fill="${bg}"/>
  <text x="210" y="260" text-anchor="middle" fill="#ef4444" 
        font-family="'Google Sans', 'Product Sans', sans-serif" font-size="14">
    Error: ${escapeXml(String(err.message))}
  </text>
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
