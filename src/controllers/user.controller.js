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
//  Rank & XP helpers
// ----------------------------------------------------------------------
function getRankData(score) {
  if (score >= 95) return { title: 'GRANDMASTER', min: 95, max: 100 };
  if (score >= 80) return { title: 'MASTER', min: 80, max: 95 };
  if (score >= 65) return { title: 'EXPERT', min: 65, max: 80 };
  if (score >= 45) return { title: 'REGULAR', min: 45, max: 65 };
  if (score >= 25) return { title: 'APPRENTICE', min: 25, max: 45 };
  return { title: 'BEGINNER', min: 0, max: 25 };
}

function getXPProgress(score, min, max) {
  return ((score - min) / (max - min)) * 100;
}

// ----------------------------------------------------------------------
//  Helper: get analysis + score for a user (no caching, used internally)
// ----------------------------------------------------------------------
export const getUserAnalysisData = async (username) => {
  const githubData = await fetchGitHubData(username);
  const contributions = await fetchContributions(username);
  const analysis = analyzeUser(githubData, contributions);
  const scoreData = calculateScore(analysis);
  return { analysis, scoreData };
};

// ----------------------------------------------------------------------
//  GET /api/user/:username
//  Returns full JSON analysis (profile, stats, languages, AI summary)
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
//  GET /api/compare/:user1/:user2
//  Side‑by‑side comparison of two GitHub users
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
//  GET /api/badge/:username
//  Shields.io style – clean, fast, avatar + rank + score
//  Query: ?theme=light|dark (default dark), ?animated=true
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

    const bgGradient = theme === 'light'
      ? '<linearGradient id="g" x2="0" y2="100%"><stop offset="0" stop-color="#e2e8f0"/><stop offset="1" stop-color="#cbd5e1"/></linearGradient>'
      : '<linearGradient id="g" x2="0" y2="100%"><stop offset="0" stop-color="#334155"/><stop offset="1" stop-color="#1e293b"/></linearGradient>';
    
    const textColor = theme === 'light' ? '#0f172a' : '#f8fafc';
    const rankColor = theme === 'light' ? '#ea580c' : '#fbbf24';
    const scoreColor = theme === 'light' ? '#2563eb' : '#38bdf8';

    const width = 340;
    const height = 28;
    const animation = animated ? `<animate attributeName="opacity" from="0" to="1" dur="0.3s" fill="freeze"/>` : '';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>${bgGradient}<clipPath id="c"><circle cx="18" cy="14" r="10"/></clipPath></defs>
  <rect width="${width}" height="${height}" rx="6" fill="url(#g)"/>
  <image href="${escapeXml(avatarUrl)}" x="8" y="4" width="20" height="20" clip-path="url(#c)"/>
  <g opacity="0">${animation}
    <text x="36" y="18" fill="${textColor}" font-family="system-ui, sans-serif" font-size="12">${escapeXml(nameText)}</text>
    <text x="180" y="18" fill="${rankColor}" font-family="system-ui, sans-serif" font-size="12" font-weight="bold">${escapeXml(rank)}</text>
    <text x="250" y="18" fill="${scoreColor}" font-family="system-ui, sans-serif" font-size="12" font-weight="bold">${escapeXml(score)}</text>
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
//  GET /api/card/:username
//  Glassmorphism profile card + contribution heatmap + golden rank frame + XP bar
//  Query: ?theme=light|dark (default dark), ?animated=true
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
    const contributions = await fetchContributions(username);

    const { followers, following, bio, name, avatar_url } = rawUser;
    const { score } = scoreData;
    const displayName = name || username;
    const shortBio = bio ? (bio.length > 60 ? bio.slice(0, 57) + '...' : bio) : 'GitHub Developer';
    const contributionGrid = contributions.contributionGrid || [];

    // Rank & XP data
    const rankData = getRankData(score);
    const xpPercent = getXPProgress(score, rankData.min, rankData.max);
    const rankText = `${rankData.title} (LV${Math.floor(score)})`;

    // Card dimensions
    const width = 600;
    const height = 420;
    const avatarSize = 110;
    const avatarX = width / 2 - avatarSize / 2;
    const avatarY = 30;

    // Theme colors
    const colors = theme === 'light' ? {
      bgStart: '#f1f5f9',
      bgEnd: '#e2e8f0',
      glass: 'rgba(255,255,255,0.7)',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      rankGradStart: '#f97316',
      rankGradEnd: '#ea580c',
      avatarGlow: '#cbd5e1',
      contributionHigh: '#16a34a',
      xpBarBg: '#e2e8f0',
    } : {
      bgStart: '#020617',
      bgEnd: '#0f172a',
      glass: 'rgba(255,255,255,0.08)',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      rankGradStart: '#fbbf24',
      rankGradEnd: '#f59e0b',
      avatarGlow: '#334155',
      contributionHigh: '#22c55e',
      xpBarBg: '#1e293b',
    };

    // Heatmap generator
    const generateHeatmap = (grid, startX, startY) => {
      const cellSize = 10;
      const gap = 4;
      if (!grid.length) return '';
      return grid.map((week, wi) =>
        week.map((count, di) => {
          const opacity = count === 0 ? 0.12 : Math.min(0.3 + count / 8, 0.95);
          return `<rect x="${startX + di * (cellSize + gap)}" y="${startY + wi * (cellSize + gap)}" width="${cellSize}" height="${cellSize}" rx="2" fill="${colors.contributionHigh}" opacity="${opacity}"/>`;
        }).join('')
      ).join('');
    };

    const heatmapX = width / 2 - 95;
    const heatmapY = height - 115;
    const animationAttr = animated ? 'opacity="0"' : '';
    const fadeIn = animated ? `<animate attributeName="opacity" from="0" to="1" dur="0.6s" fill="freeze"/>` : '';

    // XP bar dimensions
    const xpBarMaxWidth = 400;
    const xpFillWidth = (xpPercent / 100) * xpBarMaxWidth;
    const xpBarX = width / 2 - xpBarMaxWidth / 2;
    const xpBarY = height - 50;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="30%" r="80%">
      <stop offset="0%" stop-color="${colors.bgStart}" />
      <stop offset="100%" stop-color="${colors.bgEnd}" />
    </radialGradient>
    <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${colors.glass}" stop-opacity="0.9" />
      <stop offset="100%" stop-color="${colors.glass}" stop-opacity="0.4" />
    </linearGradient>
    <!-- Gold gradient for rank frame -->
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="50%" stop-color="#fde68a"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>
    <!-- Animated shine -->
    <linearGradient id="shine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="50%" stop-color="white" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="transparent"/>
      <animateTransform attributeName="gradientTransform"
        type="translate"
        from="-1 0"
        to="1 0"
        dur="2s"
        repeatCount="indefinite"/>
    </linearGradient>
    <!-- Glow filter -->
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="shadow">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.3"/>
    </filter>
    <clipPath id="avatarClip">
      <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2}" />
    </clipPath>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#bgGrad)" />

  <!-- Glass card -->
  <rect x="20" y="20" width="560" height="380" rx="24" fill="url(#glassGrad)" stroke="rgba(255,255,255,0.15)" filter="url(#shadow)"/>

  <!-- Avatar glow & image -->
  <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2 + 8}" fill="${colors.avatarGlow}" opacity="0.5" filter="url(#glow)"/>
  <image href="${escapeXml(avatar_url)}" x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" clip-path="url(#avatarClip)" />

  <!-- User info -->
  <g ${animationAttr}>${fadeIn}
    <text x="${width/2}" y="${avatarY + avatarSize + 28}" text-anchor="middle" fill="${colors.textPrimary}" font-family="system-ui, sans-serif" font-size="22" font-weight="700">${escapeXml(displayName)}</text>
    <text x="${width/2}" y="${avatarY + avatarSize + 52}" text-anchor="middle" fill="${colors.textSecondary}" font-family="system-ui, sans-serif" font-size="14">@${escapeXml(username)}</text>
    <text x="${width/2}" y="${avatarY + avatarSize + 76}" text-anchor="middle" fill="${colors.textMuted}" font-family="system-ui, sans-serif" font-size="13">${escapeXml(shortBio)}</text>
  </g>

  <!-- ========== GOLDEN RANK FRAME ========== -->
  <g ${animationAttr}>${fadeIn}
    <!-- Frame background -->
    <rect x="100" y="${height - 175}" width="400" height="50" rx="12" fill="url(#glassGrad)" stroke="url(#gold)" stroke-width="2"/>
    <!-- Decorative lines -->
    <line x1="120" y1="${height - 165}" x2="480" y2="${height - 165}" stroke="url(#gold)" opacity="0.3"/>
    <line x1="120" y1="${height - 135}" x2="480" y2="${height - 135}" stroke="url(#gold)" opacity="0.3"/>
    <!-- Shine overlay -->
    <rect x="100" y="${height - 175}" width="400" height="50" rx="12" fill="url(#shine)" opacity="0.4"/>
    <!-- Rank text -->
    <text x="300" y="${height - 135}" text-anchor="middle" fill="url(#gold)" font-family="system-ui, sans-serif" font-size="20" font-weight="900" filter="url(#glow)">${escapeXml(rankText)}</text>
  </g>

  <!-- Contribution Heatmap -->
  <g transform="translate(${heatmapX}, ${heatmapY})">
    ${generateHeatmap(contributionGrid, 0, 0)}
  </g>

  <!-- XP Bar -->
  <g ${animationAttr}>${fadeIn}
    <!-- XP Bar Background -->
    <rect x="${xpBarX}" y="${xpBarY}" width="${xpBarMaxWidth}" height="8" rx="4" fill="${colors.xpBarBg}"/>
    <!-- XP Fill (animated) -->
    <rect x="${xpBarX}" y="${xpBarY}" width="0" height="8" rx="4" fill="url(#gold)">
      <animate attributeName="width" from="0" to="${xpFillWidth}" dur="1s" fill="freeze"/>
    </rect>
    <!-- XP Text -->
    <text x="${width/2}" y="${xpBarY + 22}" text-anchor="middle" fill="${colors.textMuted}" font-family="system-ui, sans-serif" font-size="11">XP ${Math.round(xpPercent)}%</text>
  </g>

  <!-- Footer stats -->
  <text x="${width/2}" y="${height - 12}" text-anchor="middle" fill="${colors.textMuted}" font-family="system-ui, sans-serif" font-size="10">${escapeXml(following)} following · ${escapeXml(followers)} followers</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);
  } catch (err) {
    console.error('Card generation error:', err.message);
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const bg = theme === 'light' ? '#f3f4f6' : '#1e293b';
    const text = theme === 'light' ? '#111827' : '#f1f5f9';
    const errorSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" viewBox="0 0 600 300">
  <rect width="600" height="300" rx="20" fill="${bg}"/>
  <text x="300" y="160" text-anchor="middle" fill="#ef4444" font-family="system-ui, sans-serif" font-size="18">Unable to generate card — user not found or API error</text>
</svg>`;
    res.status(404).setHeader('Content-Type', 'image/svg+xml').send(errorSvg);
  }
};

// ----------------------------------------------------------------------
//  Helper: escape XML special characters (security)
// ----------------------------------------------------------------------
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
