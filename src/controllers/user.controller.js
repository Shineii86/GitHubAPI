/**
 * User Controller – GitHub Profile API with Achievements
 * 
 * Features:
 * - JSON analysis (/api/user/:username)
 * - Comparison (/api/vs/:user1/:user2)
 * - SVG Profile Card (/api/card/:username) with auto-adjustable achievements
 * - Light/Dark themes, custom backgrounds, Redis caching, AI summaries
 * - Game-style ranks, Google Sans fonts, base64 embedding
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
import { getRankName, getRankWithBullet } from '../utils/rank.js';
import { getBase64Image } from '../utils/image.js';

// ----------------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------------
const CUSTOM_BG = [
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG1.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG2.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG3.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG4.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG5.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG6.png',
];

const ACHIEVEMENT_CDN = 'https://github.githubassets.com/images/modules/profile/achievements';

// Map known achievement names to their CDN filenames
const ACHIEVEMENT_MAP = {
  'Arctic Code Vault Contributor': 'arctic-code-vault-contributor.svg',
  'Pair Extraordinaire': 'pair-extraordinaire.svg',
  'Quickdraw': 'quickdraw.svg',
  'YOLO': 'yolo.svg',
  'Public Sponsor': 'public-sponsor.svg',
  'Galaxy Brain': 'galaxy-brain.svg',
  'Heart on Your Sleeve': 'heart-on-your-sleeve.svg',
  'Starstruck': 'starstruck.svg',
  'Pull Shark': 'pull-shark.svg',
  'Code Explorer': 'code-explorer.svg',
  'Open Source Champion': 'open-source-champion.svg'
};

// ----------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------
function escapeXml(str) {
  if (str == null) return '';
  return String(str).replace(/[<>&'"]/g, ch => {
    const map = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };
    return map[ch] || ch;
  });
}

async function fetchImageAsBase64(url, fallbackSvg = null) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 4000 });
    const type = res.headers['content-type'] || 'image/svg+xml';
    return `${type};base64,${Buffer.from(res.data).toString('base64')}`;
  } catch (err) {
    if (fallbackSvg) {
      return `image/svg+xml;base64,${Buffer.from(fallbackSvg).toString('base64')}`;
    }
    return null;
  }
}

// Robust achievement scraper with CDN mapping fallback
async function fetchUserAchievements(username) {
  try {
    const res = await axios.get(`https://github.com/${username}`, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (compatible; GitHubAPI/1.0)',
        'Accept': 'text/html'
      },
      timeout: 6000
    });

    const html = res.data;
    const names = [];
    
    // Extract achievement names from aria-label or data-content
    const regex = /(?:aria-label|data-content|title)="Achievement:\s*([^"]+)"/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const name = match[1].trim();
      if (!names.includes(name)) names.push(name);
    }

    // Map names to CDN URLs, limit to 6
    return names.slice(0, 6).map(name => ({
      name,
      iconUrl: `${ACHIEVEMENT_CDN}/${ACHIEVEMENT_MAP[name] || 'default.svg'}`
    }));
  } catch (err) {
    console.warn(`[Achievements] Fallback for ${username}:`, err.message);
    return []; // Graceful degradation: card renders without achievements
  }
}

// ----------------------------------------------------------------------
// Core Data Helper
// ----------------------------------------------------------------------
export const getUserAnalysisData = async (username) => {
  const githubData = await fetchGitHubData(username);
  const contributions = await fetchContributions(username);
  const analysis = analyzeUser(githubData, contributions);
  const scoreData = calculateScore(analysis);
  return { analysis, scoreData };
};

// ----------------------------------------------------------------------
// ENDPOINTS
// ----------------------------------------------------------------------

// GET /api/user/:username
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
    const response = {
      username,
      score: scoreData.score,
      rank: scoreData.rank,
      level,
      rankName: getRankName(scoreData.score),
      rankWithBullet: getRankWithBullet(scoreData.score),
      profile: analysis.profile,
      stats: analysis.stats,
      topLanguages: analysis.languages,
      aiSummary,
      fetchedAt: new Date().toISOString()
    };

    await setCached(`user:${username}`, response, 300);
    res.json(response);
  } catch (err) {
    console.error(err);
    const status = err.response?.status === 404 ? 404 : 500;
    res.status(status).json({ error: err.response?.status === 404 ? 'User not found' : err.message });
  }
};

// GET /api/vs/:user1/:user2
export const compareUsers = async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const [data1, data2] = await Promise.all([getUserAnalysisData(user1), getUserAnalysisData(user2)]);

    const enrich = (d, u) => ({
      username: u,
      ...d.analysis,
      ...d.scoreData,
      level: Math.floor(d.scoreData.score),
      rankName: getRankName(d.scoreData.score),
      rankWithBullet: getRankWithBullet(d.scoreData.score)
    });

    res.json({ user1: enrich(data1, user1), user2: enrich(data2, user2) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/card/:username (SVG Profile Card)
export const generateProfileCard = async (req, res) => {
  try {
    const { username } = req.params;
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const bgIndex = parseInt(req.query.bgImage, 10);
    
    // 1. Fetch User Data
    const { data: rawUser } = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN || ''}` },
      timeout: 5000
    });

    const { followers, following, bio, name, avatar_url } = rawUser;
    const { scoreData } = await getUserAnalysisData(username);
    const { score } = scoreData;

    const level = Math.floor(score);
    const rankName = getRankName(score);
    const displayName = name || username;
    const shortBio = bio ? (bio.length > 40 ? bio.slice(0, 37) + '...' : bio) : 'GitHub Developer';

    // 2. Fetch Assets (Avatar + Achievements) in Parallel
    const [avatarBase64, achievements, bgBase64] = await Promise.all([
      getBase64Image(avatar_url),
      fetchUserAchievements(username),
      (!isNaN(bgIndex) && bgIndex >= 1 && bgIndex <= CUSTOM_BG.length)
        ? fetchImageAsBase64(CUSTOM_BG[bgIndex - 1])
        : null
    ]);

    // Convert achievement icons to base64
    const achievementIcons = (await Promise.all(
      achievements.map(a => fetchImageAsBase64(a.iconUrl))
    )).filter(Boolean);

    // 3. Layout & Theme Config
    const W = 500, H = 380;
    const avSize = 90, avX = W/2 - avSize/2, avY = 25;
    
    const c = theme === 'light' ? {
      bg: '#ffffff', txt: '#0f172a', sub: '#475569', mut: '#64748b',
      accent: '#f97316', glow: '#cbd5e1', mark: '#9ca3af',
      ov: 'rgba(255,255,255,0.85)', badge: 'rgba(255,255,255,0.7)', bdr: 'rgba(0,0,0,0.08)'
    } : {
      bg: '#1e293b', txt: '#f8fafc', sub: '#cbd5e1', mut: '#94a3b8',
      accent: '#fbbf24', glow: '#334155', mark: '#64748b',
      ov: 'rgba(0,0,0,0.75)', badge: 'rgba(255,255,255,0.12)', bdr: 'rgba(255,255,255,0.15)'
    };

    // 4. Build SVG Sections
    const bgLayer = bgBase64 
      ? `<image href="${bgBase64}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"/>
         <rect width="100%" height="100%" fill="${c.ov}"/>`
      : `<rect width="100%" height="100%" rx="20" fill="url(#bgGrad)"/>`;

    let achHtml = '';
    if (achievementIcons.length > 0) {
      const sz = 26, gap = 10;
      const tw = achievementIcons.length * sz + (achievementIcons.length - 1) * gap;
      const sx = (W - tw) / 2, sy = 315;
      
      achHtml = `
        <g transform="translate(${sx}, ${sy})">
          <rect x="-8" y="-10" width="${tw + 16}" height="42" rx="14" 
                fill="${c.badge}" stroke="${c.bdr}" stroke-width="1.5"/>
          ${achievementIcons.map((src, i) => `
            <g transform="translate(${i * (sz + gap)}, 0)">
              <image href="${src}" width="${sz}" height="${sz}" 
                     style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2))"/>
            </g>`).join('')}
        </g>`;
    }

    // 5. Assemble Full SVG
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme === 'light' ? '#f1f5f9' : '#0f172a'}"/>
      <stop offset="100%" stop-color="${theme === 'light' ? '#e2e8f0' : '#1e293b'}"/>
    </linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.25"/></filter>
    <clipPath id="avClip"><circle cx="${W/2}" cy="${avY + avSize/2}" r="${avSize/2}"/></clipPath>
    <style>.f{font-family:'Google Sans','Product Sans',-apple-system,sans-serif}</style>
  </defs>

  <rect width="100%" height="100%" rx="20" filter="url(#shadow)" fill="${c.bg}"/>
  ${bgLayer}

  <circle cx="${W/2}" cy="${avY + avSize/2}" r="${avSize/2 + 10}" fill="${c.glow}" opacity="0.35"/>
  <image href="${avatarBase64 || ''}" x="${avX}" y="${avY}" width="${avSize}" height="${avSize}" clip-path="url(#avClip)"/>

  <g text-anchor="middle" class="f" fill="${c.txt}">
    <text x="${W/2}" y="${avY + avSize + 30}" font-size="21" font-weight="700">${escapeXml(displayName)}</text>
    <text x="${W/2}" y="${avY + avSize + 54}" font-size="14" fill="${c.sub}">@${escapeXml(username)} • Lv ${level}</text>
    <text x="${W/2}" y="${avY + avSize + 76}" font-size="13" fill="${c.mut}">${escapeXml(shortBio)}</text>
  </g>

  <g text-anchor="middle">
    <text x="${W/2}" y="238" fill="${c.accent}" font-family="'Google Sans',sans-serif" font-size="31" font-weight="800">${escapeXml(rankName)}</text>
  </g>

  <g transform="translate(${W/2 - 95}, 272)" text-anchor="middle" class="f">
    <text x="0" y="0" font-size="17" font-weight="700" fill="${c.txt}">${following}</text>
    <text x="0" y="19" font-size="9" fill="${c.sub}" text-transform="uppercase" letter-spacing="0.5">Following</text>
  </g>
  <g transform="translate(${W/2 + 95}, 272)" text-anchor="middle" class="f">
    <text x="0" y="0" font-size="17" font-weight="700" fill="${c.txt}">${followers}</text>
    <text x="0" y="19" font-size="9" fill="${c.sub}" text-transform="uppercase" letter-spacing="0.5">Followers</text>
  </g>

  ${achHtml}

  <text x="${W - 15}" y="${H - 12}" text-anchor="end" fill="${c.mark}" font-family="sans-serif" font-size="9" opacity="0.6">githubsmartapi.vercel.app</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);

  } catch (err) {
    console.error('❌ Card Error:', err.message);
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const bg = theme === 'light' ? '#f3f4f6' : '#1e293b';
    const txt = theme === 'light' ? '#111827' : '#f1f5f9';
    const errSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="380" viewBox="0 0 500 380">
  <rect width="100%" height="100%" rx="20" fill="${bg}"/>
  <text x="250" y="170" text-anchor="middle" fill="#ef4444" font-family="sans-serif" font-size="20" font-weight="600">⚠️ Card Error</text>
  <text x="250" y="205" text-anchor="middle" fill="${txt}" font-family="sans-serif" font-size="14">${escapeXml(err.message)}</text>
  <text x="250" y="235" text-anchor="middle" fill="${theme === 'light' ? '#64748b' : '#94a3b8'}" font-family="sans-serif" font-size="12">Check username or try again later</text>
</svg>`;
    res.status(500).setHeader('Content-Type', 'image/svg+xml').send(errSvg);
  }
};
