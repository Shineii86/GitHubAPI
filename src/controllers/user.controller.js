/**
/**
 * Request handlers for user analysis, comparison, badges, and profile cards.
 * 
 * Features:
 * - GitHub REST + GraphQL data fetching
 * - Advanced scoring (0–100 + rank D–SSS)
 * - AI summaries (OpenAI, optional)
 * - Redis caching (5 min TTL)
 * - Badge (horizontal, with avatar, theme, animation)
 * - Profile card (large, custom backgrounds, theme, animation)
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
//  Modern horizontal badge with:
//  - Circular profile photo (36×36)
//  - Username (truncated)
//  - Rank + label
//  - Score + label
//  - Query: ?theme=light|dark (default dark)
//  - Query: ?animated=true (fade-in)
// ----------------------------------------------------------------------
export const generateBadge = async (req, res) => {
  try {
    const { username } = req.params;
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const animated = req.query.animated === 'true';

    const { scoreData } = await getUserAnalysisData(username);
    const { rank, score } = scoreData;

    // Fetch user info for display name
    const { data: rawUser } = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
      timeout: 5000,
    });
    const avatarUrl = `https://github.com/${username}.png?size=64`;
    const displayName = rawUser.name || username;

    // Theme colours
    const colors = theme === 'light'
      ? {
          bgStart: '#f8fafc',
          bgEnd: '#e2e8f0',
          textPrimary: '#1e293b',
          rankColor: '#e67e22',
          scoreColor: '#3b82f6',
          labelColor: '#64748b',
        }
      : {
          bgStart: '#1f2937',
          bgEnd: '#111827',
          textPrimary: '#f1f5f9',
          rankColor: '#fbbf24',
          scoreColor: '#60a5fa',
          labelColor: '#9ca3af',
        };

    const height = 48;
    const avatarSize = 36;
    const avatarX = 8;
    const avatarY = (height - avatarSize) / 2;
    const textStartX = avatarX + avatarSize + 12;

    const nameText = displayName.length > 18 ? displayName.slice(0, 15) + '...' : displayName;
    const rankText = `${rank}`;
    const scoreText = `${score}`;

    // Approximate width
    const nameWidth = nameText.length * 8;
    const rankWidth = rankText.length * 12 + 40; // +40 for "Rank" label
    const scoreWidth = scoreText.length * 12 + 40;
    const totalWidth = textStartX + nameWidth + 30 + rankWidth + 30 + scoreWidth + 20;

    const animationAttr = animated ? 'opacity="0"' : '';
    const animationElem = animated
      ? `<animate attributeName="opacity" from="0" to="1" dur="0.5s" fill="freeze"/>`
      : '';

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${colors.bgStart}"/>
      <stop offset="100%" stop-color="${colors.bgEnd}"/>
    </linearGradient>
    <clipPath id="circleClip">
      <circle cx="${avatarX + avatarSize/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2}" />
    </clipPath>
  </defs>
  <rect width="100%" height="100%" rx="12" fill="url(#bgGrad)"/>
  <image x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" href="${avatarUrl}" clip-path="url(#circleClip)"/>
  <g ${animationAttr}>${animationElem}
    <text x="${textStartX}" y="${height/2 + 5}" fill="${colors.textPrimary}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600">${escapeXml(nameText)}</text>
    <text x="${textStartX + nameWidth + 20}" y="${height/2 + 5}" fill="${colors.rankColor}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="800">${rankText}</text>
    <text x="${textStartX + nameWidth + 20 + rankWidth - 30}" y="${height/2 + 5}" fill="${colors.labelColor}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="500">Rank</text>
    <text x="${textStartX + nameWidth + 40 + rankWidth}" y="${height/2 + 5}" fill="${colors.scoreColor}" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="800">${scoreText}</text>
    <text x="${textStartX + nameWidth + 40 + rankWidth + scoreWidth - 30}" y="${height/2 + 5}" fill="${colors.labelColor}" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="500">Score</text>
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
//  Large profile card (600×450) with custom background designs:
//  - Light theme: soft diagonal mesh gradient
//  - Dark theme: glowing radial gradient + subtle grid pattern
//  - Query: ?theme=light|dark (default dark)
//  - Query: ?animated=true (fade/scale for rank/score)
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

    const { followers, following, bio, name } = rawUser;
    const { rank, score } = scoreData;
    const displayName = name || username;
    const shortBio = bio ? (bio.length > 60 ? bio.slice(0, 57) + '...' : bio) : 'GitHub Developer';

    const avatarUrl = `https://github.com/${username}.png?size=200`;

    // Card dimensions – larger, breathable
    const width = 600;
    const height = 450;
    const avatarSize = 110;
    const avatarX = width / 2 - avatarSize / 2;
    const avatarY = 35;

    // Custom background definitions
    const bgDefs = theme === 'light'
      ? `<linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
           <stop offset="0%" stop-color="#f9fafb"/>
           <stop offset="50%" stop-color="#f3f4f6"/>
           <stop offset="100%" stop-color="#e5e7eb"/>
         </linearGradient>
         <pattern id="mesh" patternUnits="userSpaceOnUse" width="40" height="40">
           <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d1d5db" stroke-width="0.5" opacity="0.3"/>
         </pattern>`
      : `<radialGradient id="bgGrad" cx="50%" cy="50%" r="70%">
           <stop offset="0%" stop-color="#1e293b"/>
           <stop offset="100%" stop-color="#0f172a"/>
         </radialGradient>
         <pattern id="grid" patternUnits="userSpaceOnUse" width="30" height="30">
           <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#334155" stroke-width="0.5" opacity="0.4"/>
         </pattern>`;

    const bgFill = theme === 'light'
      ? '<rect width="100%" height="100%" fill="url(#bgGrad)"/><rect width="100%" height="100%" fill="url(#mesh)"/>'
      : '<rect width="100%" height="100%" fill="url(#bgGrad)"/><rect width="100%" height="100%" fill="url(#grid)"/>';

    const colors = theme === 'light'
      ? {
          textPrimary: '#111827',
          textSecondary: '#4b5563',
          textMuted: '#6b7280',
          rankGradStart: '#f97316',
          rankGradEnd: '#f59e0b',
          avatarGlow: '#cbd5e1',
        }
      : {
          textPrimary: '#f1f5f9',
          textSecondary: '#cbd5e1',
          textMuted: '#94a3b8',
          rankGradStart: '#fbbf24',
          rankGradEnd: '#f59e0b',
          avatarGlow: '#334155',
        };

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
    ${bgDefs}
    <linearGradient id="rankGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${colors.rankGradStart}" />
      <stop offset="100%" stop-color="${colors.rankGradEnd}" />
    </linearGradient>
    <clipPath id="circleClip">
      <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2}" />
    </clipPath>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Background with custom pattern -->
  ${bgFill}

  <!-- Card shadow overlay (soft) -->
  <rect width="100%" height="100%" rx="28" fill="none" stroke="rgba(0,0,0,0.1)" stroke-width="1"/>

  <!-- Avatar glow ring -->
  <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2 + 8}" fill="${colors.avatarGlow}" opacity="0.4"/>
  <image x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" href="${avatarUrl}" clip-path="url(#circleClip)" />

  <!-- User info -->
  <text x="${width/2}" y="${avatarY + avatarSize + 32}" text-anchor="middle" fill="${colors.textPrimary}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="800">${escapeXml(displayName)}</text>
  <text x="${width/2}" y="${avatarY + avatarSize + 56}" text-anchor="middle" fill="${colors.textSecondary}" font-family="system-ui, -apple-system, sans-serif" font-size="15">@${escapeXml(username)}</text>
  <text x="${width/2}" y="${avatarY + avatarSize + 84}" text-anchor="middle" fill="${colors.textMuted}" font-family="system-ui, -apple-system, sans-serif" font-size="14">${escapeXml(shortBio)}</text>

  <!-- Rank & Score (side by side) -->
  <g transform="translate(${width/2 - 90}, ${height - 140})" ${animated ? 'opacity="0"' : ''}>
    ${animated ? rankAnimation : ''}
    <text x="0" y="0" text-anchor="middle" fill="url(#rankGrad)" font-family="'SF Mono', 'Courier New', monospace" font-size="68" font-weight="900">${rank}</text>
    <text x="0" y="30" text-anchor="middle" fill="${colors.textSecondary}" font-size="13" font-weight="700">RANK</text>
  </g>

  <g transform="translate(${width/2 + 90}, ${height - 140})" ${animated ? 'opacity="0"' : ''}>
    ${animated ? scoreAnimation : ''}
    <text x="0" y="0" text-anchor="middle" fill="${colors.textPrimary}" font-family="system-ui, -apple-system, sans-serif" font-size="56" font-weight="900">${score}</text>
    <text x="0" y="30" text-anchor="middle" fill="${colors.textSecondary}" font-size="13" font-weight="700">SCORE</text>
  </g>

  <!-- Following & Followers -->
  <g transform="translate(${width/2 - 160}, ${height - 55})" ${animated ? 'opacity="0"' : ''}>
    ${animated ? `<animate attributeName="opacity" from="0" to="1" dur="0.6s" fill="freeze"/>` : ''}
    <text x="0" y="0" text-anchor="middle" fill="${colors.textPrimary}" font-size="22" font-weight="800">${following}</text>
    <text x="0" y="24" text-anchor="middle" fill="${colors.textSecondary}" font-size="13" font-weight="600">Following</text>
  </g>

  <g transform="translate(${width/2 + 160}, ${height - 55})" ${animated ? 'opacity="0"' : ''}>
    ${animated ? `<animate attributeName="opacity" from="0" to="1" dur="0.6s" fill="freeze"/>` : ''}
    <text x="0" y="0" text-anchor="middle" fill="${colors.textPrimary}" font-size="22" font-weight="800">${followers}</text>
    <text x="0" y="24" text-anchor="middle" fill="${colors.textSecondary}" font-size="13" font-weight="600">Followers</text>
  </g>
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
