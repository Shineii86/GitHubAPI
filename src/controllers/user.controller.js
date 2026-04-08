/**
 * User controller – all endpoints with Google Sans fonts, game‑style ranks, base64 avatars.
 * 
 * Features:
 * - JSON analysis (/api/user/:username) with level, rankName, rankWithBullet
 * - Side‑by‑side comparison (/api/compare/:user1/:user2)
 * - SVG profile card (/api/card/:username) – avatar, name, username+level, rank name only,
 *   following/followers, watermark, optional custom background images (?bgImage=1..6)
 * - NEW: GitHub Achievements icons with auto-adjustable grid layout
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
import { fetchAchievements, getAchievementIconBase64 } from '../services/achievements.js';
import { getRankName, getRankWithBullet, getRankDetails } from '../utils/rank.js';
import { getBase64Image } from '../utils/image.js';

// ----------------------------------------------------------------------
// Custom background images for the profile card (hardcoded URLs)
// Add as many as you want – index starts at 1 for query param ?bgImage=1
// ----------------------------------------------------------------------
const CUSTOM_BG = [
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG1.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG2.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG3.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG4.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG5.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG6.png',
];

/**
 * Fetch background image and convert to base64 data URL
 */
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
// GET /api/card/:username – FULL PROFILE CARD WITH ACHIEVEMENTS
// Supports ?theme=light|dark, ?bgImage=1..6
// ----------------------------------------------------------------------
export const generateProfileCard = async (req, res) => {
  try {
    const { username } = req.params;
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    
    // Handle custom background image
    const bgImageIndex = parseInt(req.query.bgImage, 10);
    let bgImageDataUrl = null;
    if (!isNaN(bgImageIndex) && bgImageIndex >= 1 && bgImageIndex <= CUSTOM_BG.length) {
      const rawUrl = CUSTOM_BG[bgImageIndex - 1];
      bgImageDataUrl = await getBase64ImageFromUrl(rawUrl);
    }

    // Fetch core analysis data
    const { analysis, scoreData } = await getUserAnalysisData(username);
    
    // Fetch raw GitHub user data
    const { data: rawUser } = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
      timeout: 5000,
    });

    // NEW: Fetch achievements
    const achievements = await fetchAchievements(username);
    
    // Convert achievement icons to base64 for reliable SVG embedding
    const achievementIcons = await Promise.all(
      achievements.map(async (ach) => {
        const base64 = await getAchievementIconBase64(ach.iconUrl);
        return base64 ? { name: ach.name, src: base64 } : null;
      })
    ).then(results => results.filter(Boolean));

    const { followers, following, bio, name, avatar_url } = rawUser;
    const { score } = scoreData;
    const displayName = name || username;
    const shortBio = bio ? (bio.length > 40 ? bio.slice(0, 37) + '...' : bio) : 'GitHub Developer';
    const level = Math.floor(score);
    const rankName = getRankName(score);

    const avatarBase64 = await getBase64Image(avatar_url);

    // Card dimensions
    const width = 500;
    const height = 380; // Increased for achievements section
    const avatarSize = 90;
    const avatarX = width / 2 - avatarSize / 2;
    const avatarY = 25;

    // Theme color palette
    const colors = theme === 'light' ? {
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      rankColor: '#f97316',
      avatarGlow: '#cbd5e1',
      watermarkColor: '#9ca3af',
      overlayColor: 'rgba(255, 255, 255, 0.85)',
      badgeBg: 'rgba(255, 255, 255, 0.7)',
      badgeBorder: 'rgba(0,0,0,0.08)',
      badgeText: '#334155'
    } : {
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      rankColor: '#fbbf24',
      avatarGlow: '#334155',
      watermarkColor: '#64748b',
      overlayColor: 'rgba(0, 0, 0, 0.75)',
      badgeBg: 'rgba(255, 255, 255, 0.12)',
      badgeBorder: 'rgba(255,255,255,0.15)',
      badgeText: '#e2e8f0'
    };

    // Background layer SVG
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

    // NEW: Generate achievements SVG grid (auto-adjustable)
    let achievementsHtml = '';
    if (achievementIcons.length > 0) {
      const iconSize = 26;
      const gap = 10;
      const totalWidth = (achievementIcons.length * iconSize) + ((achievementIcons.length - 1) * gap);
      const startX = (width - totalWidth) / 2;
      const yStart = 315;

      achievementsHtml = `
    <!-- Achievements Trophy Case -->
    <g transform="translate(${startX}, ${yStart})">
      <!-- Glassmorphism backplate -->
      <rect x="-8" y="-10" width="${totalWidth + 16}" height="42" rx="14" 
            fill="${colors.badgeBg}" stroke="${colors.badgeBorder}" stroke-width="1.5"/>
      
      <!-- Achievement icons -->
      ${achievementIcons.map((ach, index) => {
        const x = index * (iconSize + gap);
        return `
        <g transform="translate(${x}, 0)">
          <title>${escapeXml(ach.name)}</title>
          <!-- Subtle hover effect simulation via slight scale -->
          <image href="${escapeXml(ach.src)}" width="${iconSize}" height="${iconSize}" 
                 style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.15))"/>
        </g>`;
      }).join('')}
    </g>
      `;
    }

    // Complete SVG card
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme === 'light' ? '#f1f5f9' : '#0f172a'}" />
      <stop offset="100%" stop-color="${theme === 'light' ? '#e2e8f0' : '#1e293b'}" />
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.25"/>
    </filter>
    <filter id="iconGlow">
      <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <clipPath id="avatarClip">
      <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2}" />
    </clipPath>
    <style>
      .font-main { font-family: 'Google Sans', 'Product Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
      .rank-text { font-weight: 800; letter-spacing: 0.5px; }
      .stat-label { text-transform: uppercase; letter-spacing: 0.5px; font-size: 9px; }
    </style>
  </defs>

  <!-- Card base with shadow -->
  <rect width="100%" height="100%" rx="20" filter="url(#shadow)" 
        fill="${theme === 'light' ? '#ffffff' : '#1e293b'}"/>
  
  <!-- Background layer (image or gradient) -->
  ${backgroundSvg}

  <!-- Avatar glow effect -->
  <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2 + 10}" 
          fill="${colors.avatarGlow}" opacity="0.35"/>
  
  <!-- Avatar image -->
  <image href="${escapeXml(avatarBase64)}" x="${avatarX}" y="${avatarY}" 
         width="${avatarSize}" height="${avatarSize}" clip-path="url(#avatarClip)"
         style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1))"/>

  <!-- User identity section -->
  <g text-anchor="middle" class="font-main">
    <text x="${width/2}" y="${avatarY + avatarSize + 30}" 
          fill="${colors.textPrimary}" font-size="21" font-weight="700">
      ${escapeXml(displayName)}
    </text>
    <text x="${width/2}" y="${avatarY + avatarSize + 54}" 
          fill="${colors.textSecondary}" font-size="14">
      @${escapeXml(username)} • Lv ${escapeXml(level)}
    </text>
    <text x="${width/2}" y="${avatarY + avatarSize + 76}" 
          fill="${colors.textMuted}" font-size="13">
      ${escapeXml(shortBio)}
    </text>
  </g>

  <!-- Rank badge display -->
  <g text-anchor="middle">
    <text x="${width/2}" y="238" 
          fill="${colors.rankColor}" font-family="'Google Sans', 'Product Sans', sans-serif" 
          font-size="31" class="rank-text">
      ${escapeXml(rankName)}
    </text>
  </g>

  <!-- Stats: Following / Followers -->
  <g transform="translate(${width/2 - 95}, 272)" text-anchor="middle" class="font-main">
    <text x="0" y="0" fill="${colors.textPrimary}" font-size="17" font-weight="700">
      ${escapeXml(following)}
    </text>
    <text x="0" y="19" fill="${colors.textSecondary}" class="stat-label">Following</text>
  </g>
  <g transform="translate(${width/2 + 95}, 272)" text-anchor="middle" class="font-main">
    <text x="0" y="0" fill="${colors.textPrimary}" font-size="17" font-weight="700">
      ${escapeXml(followers)}
    </text>
    <text x="0" y="19" fill="${colors.textSecondary}" class="stat-label">Followers</text>
  </g>

  <!-- NEW: Achievements section (auto-adjustable grid) -->
  ${achievementsHtml}

  <!-- Footer watermark -->
  <text x="${width - 15}" y="${height - 12}" text-anchor="end" 
        fill="${colors.watermarkColor}" font-family="sans-serif" font-size="9" opacity="0.6">
    githubsmartapi.vercel.app
  </text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);

  } catch (err) {
    console.error('Card generation error:', err.message);
    
    // Fallback error card
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const bg = theme === 'light' ? '#f3f4f6' : '#1e293b';
    const text = theme === 'light' ? '#111827' : '#f1f5f9';
    const errorSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="380" viewBox="0 0 500 380">
  <defs>
    <linearGradient id="errGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${theme === 'light' ? '#e2e8f0' : '#334155'}"/>
    </linearGradient>
  </defs>
  <rect width="500" height="380" rx="20" fill="url(#errGrad)"/>
  <text x="250" y="170" text-anchor="middle" fill="#ef4444" 
        font-family="sans-serif" font-size="20" font-weight="600">⚠️ Card Error</text>
  <text x="250" y="200" text-anchor="middle" fill="${text}" 
        font-family="sans-serif" font-size="14">${escapeXml(String(err.message))}</text>
  <text x="250" y="240" text-anchor="middle" fill="${theme === 'light' ? '#64748b' : '#94a3b8'}" 
        font-family="sans-serif" font-size="12">Try refreshing or check the username</text>
</svg>`;
    res.status(500).setHeader('Content-Type', 'image/svg+xml').send(errorSvg);
  }
};

// ----------------------------------------------------------------------
// Helper: Safe XML/HTML entity escape for SVG text content
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
