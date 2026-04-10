/**
 * User controller – all endpoints with Google Sans fonts, game‑style ranks, base64 avatars.
 * 
 * Features:
 * - JSON analysis (/api/user/:username) with level, rankName, rankWithBullet
 * - Side‑by‑side comparison (/api/compare/:user1/:user2)
 * - SVG profile card (/api/card/:username) – upgraded UI/UX with stats grid, progress bar,
 *   modern layout, and optional custom background images (?bgImage=1..6)
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
// GET /api/card/:username – upgraded UI/UX profile card
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

    const {
      followers,
      following,
      public_repos: repos,
      public_gists: gists,
      bio,
      name,
      avatar_url,
    } = rawUser;
    const { score } = scoreData;
    const displayName = name || username;
    const shortBio = bio ? (bio.length > 70 ? bio.slice(0, 67) + '...' : bio) : 'GitHub Developer';
    const level = Math.floor(score);
    const rankName = getRankName(score);
    const progressPercent = (score - level) * 100; // decimal part as percentage

    const avatarBase64 = await getBase64Image(avatar_url);

    // New dimensions – more spacious
    const width = 600;
    const height = 340;
    const padding = 24;

    // Theme colours – refined for better contrast and modern look
    const colors = theme === 'light' ? {
      bgStart: '#f8fafc',
      bgEnd: '#e2e8f0',
      cardBg: '#ffffff',
      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      accent: '#3b82f6',
      rankColor: '#f97316',
      progressBg: '#e2e8f0',
      progressFill: '#3b82f6',
      statValue: '#1e293b',
      statLabel: '#64748b',
      borderLight: '#e2e8f0',
      watermark: '#9ca3af',
      overlay: 'rgba(255, 255, 255, 0.75)',
    } : {
      bgStart: '#0f172a',
      bgEnd: '#1e293b',
      cardBg: '#1e293b',
      textPrimary: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      accent: '#60a5fa',
      rankColor: '#fbbf24',
      progressBg: '#334155',
      progressFill: '#60a5fa',
      statValue: '#f1f5f9',
      statLabel: '#94a3b8',
      borderLight: '#334155',
      watermark: '#64748b',
      overlay: 'rgba(0, 0, 0, 0.65)',
    };

    // Background SVG – either gradient or custom image with overlay
    let backgroundSvg = '';
    if (bgImageDataUrl) {
      backgroundSvg = `
    <image href="${escapeXml(bgImageDataUrl)}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" />
    <rect width="100%" height="100%" fill="${colors.overlay}" />
      `;
    } else {
      backgroundSvg = `
    <rect width="100%" height="100%" rx="20" fill="url(#bgGrad)" />
      `;
    }

    // SVG template with improved layout
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colors.bgStart}" />
      <stop offset="100%" stop-color="${colors.bgEnd}" />
    </linearGradient>
    <filter id="cardShadow">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity="0.15"/>
    </filter>
    <filter id="avatarGlow">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <clipPath id="avatarClip">
      <circle cx="84" cy="84" r="56" />
    </clipPath>
    <linearGradient id="progressGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${colors.accent}" />
      <stop offset="100%" stop-color="${theme === 'light' ? '#8b5cf6' : '#a78bfa'}" />
    </linearGradient>
  </defs>

  <!-- Main card background -->
  <rect width="100%" height="100%" rx="20" filter="url(#cardShadow)" />
  ${backgroundSvg}

  <!-- Left section: Avatar & Profile -->
  <g transform="translate(${padding}, ${padding})">
    <!-- Avatar glow & image -->
    <circle cx="84" cy="84" r="60" fill="${colors.borderLight}" opacity="0.4" />
    <image href="${escapeXml(avatarBase64)}" x="28" y="28" width="112" height="112" clip-path="url(#avatarClip)" />
    
    <!-- Name & Username -->
    <text x="160" y="54" fill="${colors.textPrimary}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="24" font-weight="700" letter-spacing="-0.5">${escapeXml(displayName)}</text>
    <text x="160" y="80" fill="${colors.textSecondary}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="16">@${escapeXml(username)}</text>
    
    <!-- Level badge -->
    <rect x="160" y="96" width="72" height="26" rx="13" fill="${colors.accent}" opacity="0.15" />
    <text x="196" y="114" text-anchor="middle" fill="${colors.accent}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="14" font-weight="600">Lv ${level}</text>
  </g>

  <!-- Bio line -->
  <text x="${padding + 160}" y="${padding + 140}" fill="${colors.textMuted}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="14" font-style="italic">${escapeXml(shortBio)}</text>

  <!-- Stats grid: Repos, Gists, Followers, Following -->
  <g transform="translate(${padding}, 210)">
    <!-- Repos -->
    <rect x="0" y="0" width="110" height="60" rx="12" fill="${colors.cardBg}" stroke="${colors.borderLight}" stroke-width="1.5" />
    <text x="55" y="24" text-anchor="middle" fill="${colors.statValue}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="18" font-weight="700">${escapeXml(repos)}</text>
    <text x="55" y="44" text-anchor="middle" fill="${colors.statLabel}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="11">Repositories</text>

    <!-- Gists -->
    <rect x="126" y="0" width="110" height="60" rx="12" fill="${colors.cardBg}" stroke="${colors.borderLight}" stroke-width="1.5" />
    <text x="181" y="24" text-anchor="middle" fill="${colors.statValue}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="18" font-weight="700">${escapeXml(gists)}</text>
    <text x="181" y="44" text-anchor="middle" fill="${colors.statLabel}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="11">Gists</text>

    <!-- Followers -->
    <rect x="252" y="0" width="110" height="60" rx="12" fill="${colors.cardBg}" stroke="${colors.borderLight}" stroke-width="1.5" />
    <text x="307" y="24" text-anchor="middle" fill="${colors.statValue}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="18" font-weight="700">${escapeXml(followers)}</text>
    <text x="307" y="44" text-anchor="middle" fill="${colors.statLabel}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="11">Followers</text>

    <!-- Following -->
    <rect x="378" y="0" width="110" height="60" rx="12" fill="${colors.cardBg}" stroke="${colors.borderLight}" stroke-width="1.5" />
    <text x="433" y="24" text-anchor="middle" fill="${colors.statValue}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="18" font-weight="700">${escapeXml(following)}</text>
    <text x="433" y="44" text-anchor="middle" fill="${colors.statLabel}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="11">Following</text>
  </g>

  <!-- Rank section with progress bar -->
  <g transform="translate(${padding}, 300)">
    <text x="0" y="10" fill="${colors.rankColor}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="20" font-weight="800">${escapeXml(rankName)}</text>
    
    <!-- Progress bar container -->
    <rect x="150" y="0" width="300" height="10" rx="5" fill="${colors.progressBg}" />
    <rect x="150" y="0" width="${progressPercent * 3}" height="10" rx="5" fill="url(#progressGrad)" />
    <text x="460" y="10" fill="${colors.textSecondary}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="12" text-anchor="end">${Math.round(progressPercent)}% to next level</text>
  </g>

  <!-- Watermark -->
  <text x="${width - 16}" y="${height - 8}" text-anchor="end" fill="${colors.watermark}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="10" opacity="0.5">githubsmartapi.vercel.app</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);
  } catch (err) {
    console.error('Card error:', err.message);
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const bg = theme === 'light' ? '#f8fafc' : '#0f172a';
    const text = theme === 'light' ? '#0f172a' : '#f8fafc';
    const errorSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="340" viewBox="0 0 600 340">
  <rect width="600" height="340" rx="20" fill="${bg}" stroke="#ef4444" stroke-width="2"/>
  <text x="300" y="150" text-anchor="middle" fill="#ef4444" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="18" font-weight="600">Oops! Something went wrong</text>
  <text x="300" y="180" text-anchor="middle" fill="${text}" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="14">${escapeXml(String(err.message))}</text>
  <text x="300" y="220" text-anchor="middle" fill="${text}" opacity="0.7" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="12">Please check the username and try again</text>
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
