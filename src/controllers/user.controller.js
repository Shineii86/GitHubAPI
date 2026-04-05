/**
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  🎮 GitHub Smart API – User Controller                         ║
 * ║  Stylish endpoints with Google Sans, game‑style ranks & SVGs   ║
 * ╚════════════════════════════════════════════════════════════════╝
 * 
 * 📦 Features:
 *   • JSON Analysis      → /api/user/:username
 *   • Side‑by‑Side Compare → /api/vs/:user1/:user2
 *   • Compact Badge SVG  → /api/badge/:username
 *   • Profile Card SVG   → /api/card/:username (?bgImage=1..6)
 *   • Shields‑Style Badges → /api/rank-badge/:username, /api/level-badge/:username
 *   • 🎨 Light/Dark Themes via ?theme=light|dark
 *   • ⚡ Redis Caching (5min TTL) + Optional AI Summaries
 * 
 * 🎨 Design Tokens:
 *   • Font Stack: 'Google Sans', 'Product Sans', sans-serif
 *   • Rank System: BEGINNER → GODLIKE (11 tiers)
 *   • Color Mapping: Dynamic per-rank gradients
 * 
 * @author  Shinei Nouzen (@Shineii86)
 * @license MIT
 * @version 2.0.0 – Stylish Refactor Edition ✨
 */

import axios from 'axios';
import { fetchGitHubData, fetchContributions } from '../services/github.service.js';
import { analyzeUser } from '../services/analysis.service.js';
import { calculateScore } from '../services/scoring.service.js';
import { generateAISummary } from '../services/ai.service.js';
import { getCached, setCached } from '../services/cache.service.js';
import { getRankName, getRankWithBullet, getRankDetails } from '../utils/rank.js';
import { getBase64Image } from '../utils/image.js';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎨 CONFIGURATION & ASSETS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Custom background images for profile cards (query: ?bgImage=1..6) */
const CUSTOM_BACKGROUNDS = [
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG1.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG2.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG3.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG4.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG5.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG6.png',
];

/** Rank → Color mapping for dynamic styling */
const RANK_COLOR_MAP = Object.freeze({
  BEGINNER:    '#9ca3af',   // ⚪ Gray
  NOVICE:      '#6b7280',   // ⚫ Dark Gray
  APPRENTICE:  '#3b82f6',   // 🔵 Blue
  DEVELOPER:   '#10b981',   // 🟢 Green
  EXPERT:      '#06b6d4',   // 🟦 Cyan
  ELITE:       '#8b5cf6',   // 🟣 Purple
  MASTER:      '#f59e0b',   // 🟠 Amber
  GRANDMASTER: '#ef4444',   // 🔴 Red
  LEGEND:      '#ec489a',   // 🩷 Pink
  MYTHIC:      '#d946ef',   // 💜 Fuchsia
  GODLIKE:     '#ffaa44',   // 🟡 Gold-Orange
});

/** Theme color presets for consistent SVG styling */
const THEME_COLORS = {
  light: {
    bgPrimary:    '#f8fafc',
    bgSecondary:  '#e2e8f0',
    bgGradient:   ['#f1f5f9', '#e2e8f0'],
    textPrimary:  '#0f172a',
    textSecondary:'#475569',
    textMuted:    '#64748b',
    textLabel:    '#475569',
    rankAccent:   '#f97316',
    badgeStroke:  '#e2e8f0',
    avatarGlow:   '#cbd5e1',
    watermark:    '#9ca3af',
    overlay:      'rgba(255, 255, 255, 0.75)',
  },
  dark: {
    bgPrimary:    '#1f2937',
    bgSecondary:  '#334155',
    bgGradient:   ['#0f172a', '#1e293b'],
    textPrimary:  '#f8fafc',
    textSecondary:'#cbd5e1',
    textMuted:    '#94a3b8',
    textLabel:    '#94a3b8',
    rankAccent:   '#fbbf24',
    badgeStroke:  '#334155',
    avatarGlow:   '#334155',
    watermark:    '#64748b',
    overlay:      'rgba(0, 0, 0, 0.65)',
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🛠️ UTILITY HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Fetch & convert image URL to base64 data URI
 * @param {string} url - Image source URL
 * @returns {Promise<string|null>} Base64 data URI or null on failure
 */
const fetchBase64Image = async (url) => {
  try {
    const { data, headers } = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10_000,
    });
    const contentType = headers['content-type'] || 'image/png';
    const base64 = Buffer.from(data, 'binary').toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.error('🖼️  Image fetch failed:', url, err.message);
    return null;
  }
};

/**
 * Safe XML/HTML entity encoder for SVG text content
 * @param {*} str - Value to escape
 * @returns {string} Escaped string
 */
const escapeXml = (str) => {
  if (str == null) return '';
  return String(str).replace(/[<>&'"]/g, (ch) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[ch]));
};

/**
 * Get dynamic color for rank name
 * @param {string} rankName - Rank identifier
 * @returns {string} Hex color code
 */
const getRankColor = (rankName) => RANK_COLOR_MAP[rankName] || '#fbbf24';

/**
 * Get dynamic color for level number based on tier thresholds
 * @param {number} level - User level/score
 * @returns {string} Hex color code
 */
const getLevelColor = (level) => {
  const thresholds = [
    { min: 100, color: '#ffaa44' },  // GODLIKE
    { min: 90,  color: '#d946ef' },  // MYTHIC
    { min: 80,  color: '#ec489a' },  // LEGEND
    { min: 70,  color: '#ef4444' },  // GRANDMASTER
    { min: 60,  color: '#f59e0b' },  // MASTER
    { min: 50,  color: '#8b5cf6' },  // ELITE
    { min: 40,  color: '#06b6d4' },  // EXPERT
    { min: 30,  color: '#10b981' },  // DEVELOPER
    { min: 20,  color: '#3b82f6' },  // APPRENTICE
    { min: 10,  color: '#6b7280' },  // NOVICE
  ];
  const match = thresholds.find(t => level >= t.min);
  return match?.color || '#9ca3af';  // BEGINNER
};

/**
 * Core data fetcher: GitHub profile + analysis + scoring (cached)
 * @param {string} username - GitHub username
 * @returns {Promise<{analysis: object, scoreData: object}>}
 */
const fetchUserAnalysisData = async (username) => {
  const [githubData, contributions] = await Promise.all([
    fetchGitHubData(username),
    fetchContributions(username),
  ]);
  const analysis = analyzeUser(githubData, contributions);
  const scoreData = calculateScore(analysis);
  return { analysis, scoreData };
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🎨 SVG GENERATION HELPERS (Modular & Reusable)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate linear gradient definition for SVG backgrounds
 * @param {string[]} colors - [startColor, endColor]
 * @param {string} id - Gradient ID reference
 * @param {string} direction - Gradient direction (default: vertical)
 * @returns {string} SVG <linearGradient> element
 */
const createGradientDef = (colors, id = 'bgGrad', direction = 'x2="0" y2="100%"') =>
  `<linearGradient id="${id}" x1="0%" y1="0%" ${direction}>
    <stop offset="0%" stop-color="${colors[0]}" />
    <stop offset="100%" stop-color="${colors[1]}" />
  </linearGradient>`;

/**
 * Generate drop shadow filter for SVG elements
 * @param {string} id - Filter ID reference
 * @param {object} opts - Shadow parameters
 * @returns {string} SVG <filter> element
 */
const createShadowFilter = (id = 'shadow', { dx = 0, dy = 4, stdDeviation = 6, opacity = 0.2 } = {}) =>
  `<filter id="${id}">
    <feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${stdDeviation}" flood-color="#000" flood-opacity="${opacity}"/>
  </filter>`;

/**
 * Generate circular clipPath for avatar masking
 * @param {number} cx - Center X
 * @param {number} cy - Center Y
 * @param {number} r - Radius
 * @param {string} id - ClipPath ID
 * @returns {string} SVG <clipPath> element
 */
const createAvatarClip = (cx, cy, r, id = 'avatarClip') =>
  `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}" /></clipPath>`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📡 API ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  GET /api/user/:username                                     ║
 * ║  → Full JSON analysis with level, rank, metrics & AI summary ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export const getUserAnalysis = async (req, res) => {
  try {
    const { username } = req.params;
    
    // 🔄 Cache check
    const cached = await getCached(`user:${username}`);
    if (cached) return res.json({ ...cached, cached: true });

    // 📊 Fetch & enrich data
    const { analysis, scoreData } = await fetchUserAnalysisData(username);
    const level = Math.floor(scoreData.score);
    const rankName = getRankName(scoreData.score);
    
    // 🤖 Optional AI summary
    let aiSummary = null;
    if (process.env.OPENAI_API_KEY) {
      aiSummary = await generateAISummary(analysis, scoreData);
    }

    const response = {
      username,
      score: scoreData.score,
      rank: scoreData.rank,
      level,
      rankName,
      rankWithBullet: getRankWithBullet(scoreData.score),
      profile: analysis.profile,
      stats: analysis.stats,
      topLanguages: analysis.languages,
      aiSummary,
      fetchedAt: new Date().toISOString(),
    };

    // 💾 Cache & respond
    await setCached(`user:${username}`, response, 300); // 5min TTL
    res.json(response);

  } catch (err) {
    console.error('❌ Analysis error:', err.message);
    const isNotFound = err.response?.status === 404;
    res.status(isNotFound ? 404 : 500).json({
      error: isNotFound ? 'GitHub user not found' : err.message,
    });
  }
};

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  GET /api/vs/:user1/:user2                                   ║
 * ║  → Side‑by‑side comparison with enriched rank data           ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export const compareUsers = async (req, res) => {
  try {
    const { user1, user2 } = req.params;

    const [data1, data2] = await Promise.all([
      fetchUserAnalysisData(user1),
      fetchUserAnalysisData(user2),
    ]);

    const enrich = (data, username) => {
      const score = data.scoreData.score;
      return {
        username,
        ...data.analysis,
        ...data.scoreData,
        level: Math.floor(score),
        rankName: getRankName(score),
        rankWithBullet: getRankWithBullet(score),
      };
    };

    res.json({
      user1: enrich(data1, user1),
      user2: enrich(data2, user2),
    });

  } catch (err) {
    console.error('❌ Comparison error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  GET /api/badge/:username                                    ║
 * ║  → Compact horizontal badge: avatar + name + "MYTHIC • LV90" ║
 * ║  Params: ?theme=light|dark                                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export const generateBadge = async (req, res) => {
  try {
    const { username } = req.params;
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const colors = THEME_COLORS[theme];

    const { scoreData } = await fetchUserAnalysisData(username);
    const { data: githubUser } = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
      timeout: 5_000,
    });

    const avatarBase64 = await getBase64Image(githubUser.avatar_url);
    const displayName = githubUser.name || username;
    const nameText = displayName.length > 14 ? `${displayName.slice(0, 11)}...` : displayName;
    const rankWithBullet = getRankWithBullet(scoreData.score);

    // Dimensions & layout
    const W = 250, H = 30, AVATAR_SIZE = 20, AVATAR_PAD = 8, TEXT_BASELINE = 19;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    ${createGradientDef(colors.bgGradient, 'g')}
    ${createAvatarClip(AVATAR_PAD + AVATAR_SIZE/2, H/2, AVATAR_SIZE/2, 'c')}
  </defs>
  
  <!-- Background -->
  <rect width="${W}" height="${H}" rx="6" fill="url(#g)"/>
  
  <!-- Avatar -->
  <image href="${escapeXml(avatarBase64)}" x="${AVATAR_PAD}" y="${(H - AVATAR_SIZE)/2}" 
         width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" clip-path="url(#c)"/>
  
  <!-- Username -->
  <text x="${AVATAR_PAD + AVATAR_SIZE + 8}" y="${TEXT_BASELINE}" 
        fill="${colors.textPrimary}" font-family="'Google Sans','Product Sans',sans-serif" 
        font-size="12">${escapeXml(nameText)}</text>
  
  <!-- Rank Badge -->
  <text x="150" y="${TEXT_BASELINE}" fill="${colors.rankAccent}" 
        font-family="'Google Sans','Product Sans',sans-serif" font-size="12" font-weight="700">
    ${escapeXml(rankWithBullet)}
  </text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);

  } catch (err) {
    console.error('❌ Badge generation failed:', err.message);
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="250" height="30">
  <rect width="250" height="30" rx="6" fill="${THEME_COLORS[theme].bgPrimary}"/>
  <text x="125" y="19" text-anchor="middle" fill="#ef4444" font-size="12" 
        font-family="sans-serif">Error</text>
</svg>`;
    res.status(404).setHeader('Content-Type', 'image/svg+xml').send(fallback);
  }
};

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  GET /api/rank-badge/:username                               ║
 * ║  → Shields-style badge: "RANK MASTER" (dual-color text)      ║
 * ║  Params: ?theme=light|dark                                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export const generateRankBadge = async (req, res) => {
  try {
    const { username } = req.params;
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const colors = THEME_COLORS[theme];

    const { scoreData } = await fetchUserAnalysisData(username);
    const rankName = getRankName(scoreData.score);
    const rankColor = getRankColor(rankName);

    const LABEL = 'RANK ', rankText = rankName;
    const width = Math.max(90, (LABEL.length + rankText.length) * 8 + 20);
    const height = 28;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="6" fill="${colors.bgPrimary}" 
        stroke="${colors.badgeStroke}" stroke-width="1"/>
  <text x="8" y="18" fill="${colors.textLabel}" 
        font-family="'Google Sans','Product Sans',sans-serif" font-size="12" font-weight="700">
    ${escapeXml(LABEL)}
  </text>
  <text x="${8 + LABEL.length * 7.5}" y="18" fill="${rankColor}" 
        font-family="'Google Sans','Product Sans',sans-serif" font-size="12" font-weight="700">
    ${escapeXml(rankText)}
  </text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);

  } catch (err) {
    console.error('❌ Rank badge error:', err.message);
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="28">
  <rect width="100" height="28" rx="6" fill="${THEME_COLORS[theme].bgPrimary}"/>
  <text x="50" y="18" text-anchor="middle" fill="#ef4444" font-size="12">Error</text>
</svg>`;
    res.status(404).setHeader('Content-Type', 'image/svg+xml').send(fallback);
  }
};

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  GET /api/level-badge/:username                              ║
 * ║  → Shields-style badge: "LEVEL 90" (dynamic level color)     ║
 * ║  Params: ?theme=light|dark                                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export const generateRankLevelBadge = async (req, res) => {
  try {
    const { username } = req.params;
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const colors = THEME_COLORS[theme];

    const { scoreData } = await fetchUserAnalysisData(username);
    const level = Math.floor(scoreData.score);
    const levelColor = getLevelColor(level);

    const LABEL = 'LEVEL ', levelText = level.toString();
    const width = Math.max(80, (LABEL.length + levelText.length) * 8 + 20);
    const height = 28;

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" rx="6" fill="${colors.bgPrimary}" 
        stroke="${colors.badgeStroke}" stroke-width="1"/>
  <text x="8" y="18" fill="${colors.textLabel}" 
        font-family="'Google Sans','Product Sans',sans-serif" font-size="12" font-weight="700">
    ${escapeXml(LABEL)}
  </text>
  <text x="${8 + LABEL.length * 7.5}" y="18" fill="${levelColor}" 
        font-family="'Google Sans','Product Sans',sans-serif" font-size="12" font-weight="700">
    ${escapeXml(levelText)}
  </text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);

  } catch (err) {
    console.error('❌ Level badge error:', err.message);
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="80" height="28">
  <rect width="80" height="28" rx="6" fill="${THEME_COLORS[theme].bgPrimary}"/>
  <text x="40" y="18" text-anchor="middle" fill="#ef4444" font-size="12">0</text>
</svg>`;
    res.status(404).setHeader('Content-Type', 'image/svg+xml').send(fallback);
  }
};

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  GET /api/card/:username                                     ║
 * ║  → Full profile card SVG with avatar, stats, rank & bg options║
 * ║  Params: ?theme=light|dark & ?bgImage=1..6                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
export const generateProfileCard = async (req, res) => {
  try {
    const { username } = req.params;
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const colors = THEME_COLORS[theme];

    // 🖼️ Optional custom background
    const bgIndex = parseInt(req.query.bgImage, 10);
    let bgImageDataUrl = null;
    if (!isNaN(bgIndex) && bgIndex >= 1 && bgIndex <= CUSTOM_BACKGROUNDS.length) {
      bgImageDataUrl = await fetchBase64Image(CUSTOM_BACKGROUNDS[bgIndex - 1]);
    }

    // 📦 Fetch all required data
    const { analysis, scoreData } = await fetchUserAnalysisData(username);
    const { data: githubUser } = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
      timeout: 5_000,
    });

    const { followers, following, bio, name, avatar_url } = githubUser;
    const score = scoreData.score;
    const displayName = name || username;
    const shortBio = bio ? (bio.length > 60 ? `${bio.slice(0, 57)}...` : bio) : 'GitHub Developer';
    const level = Math.floor(score);
    const rankName = getRankName(score);
    const avatarBase64 = await getBase64Image(avatar_url);

    // 📐 Card dimensions & layout constants
    const W = 500, H = 350;
    const AVATAR_SIZE = 95, AVATAR_Y = 30;
    const AVATAR_X = (W - AVATAR_SIZE) / 2;
    const AVATAR_CENTER = { x: W / 2, y: AVATAR_Y + AVATAR_SIZE / 2 };

    // 🎨 Build background layer
    const backgroundLayer = bgImageDataUrl
      ? `<image href="${escapeXml(bgImageDataUrl)}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice"/>
         <rect width="100%" height="100%" fill="${colors.overlay}"/>`
      : `<rect width="100%" height="100%" rx="20" fill="url(#bgGrad)"/>`;

    // 🧩 Compose SVG
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    ${createGradientDef(colors.bgGradient)}
    ${createShadowFilter()}
    ${createAvatarClip(AVATAR_CENTER.x, AVATAR_CENTER.y, AVATAR_SIZE / 2)}
  </defs>

  <!-- Base card with shadow -->
  <rect width="${W}" height="${H}" rx="20" filter="url(#shadow)"/>
  
  <!-- Background layer -->
  ${backgroundLayer}

  <!-- Avatar glow + image -->
  <circle cx="${AVATAR_CENTER.x}" cy="${AVATAR_CENTER.y}" r="${AVATAR_SIZE/2 + 6}" 
          fill="${colors.avatarGlow}" opacity="0.4"/>
  <image href="${escapeXml(avatarBase64)}" x="${AVATAR_X}" y="${AVATAR_Y}" 
         width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" clip-path="url(#avatarClip)"/>

  <!-- User info section -->
  <g text-anchor="middle">
    <text x="${W/2}" y="${AVATAR_Y + AVATAR_SIZE + 28}" 
          fill="${colors.textPrimary}" font-family="'Google Sans','Product Sans',sans-serif" 
          font-size="22" font-weight="700">${escapeXml(displayName)}</text>
    <text x="${W/2}" y="${AVATAR_Y + AVATAR_SIZE + 52}" 
          fill="${colors.textSecondary}" font-family="'Google Sans','Product Sans',sans-serif" 
          font-size="14">@${escapeXml(username)} • LV${escapeXml(level)}</text>
    <text x="${W/2}" y="${AVATAR_Y + AVATAR_SIZE + 76}" 
          fill="${colors.textMuted}" font-family="'Google Sans','Product Sans',sans-serif" 
          font-size="13">${escapeXml(shortBio)}</text>
  </g>

  <!-- Rank display (prominent) -->
  <text x="${W/2}" y="240" text-anchor="middle" 
        fill="${colors.rankAccent}" font-family="'Google Sans','Product Sans',sans-serif" 
        font-size="36" font-weight="800">${escapeXml(rankName)}</text>

  <!-- Stats: Following / Followers -->
  <g transform="translate(${W/2 - 100}, 280)" text-anchor="middle">
    <text x="0" y="0" fill="${colors.textPrimary}" 
          font-family="'Google Sans','Product Sans',sans-serif" font-size="18" font-weight="700">
      ${escapeXml(following)}
    </text>
    <text x="0" y="18" fill="${colors.textSecondary}" 
          font-family="'Google Sans','Product Sans',sans-serif" font-size="11">Following</text>
  </g>
  <g transform="translate(${W/2 + 100}, 280)" text-anchor="middle">
    <text x="0" y="0" fill="${colors.textPrimary}" 
          font-family="'Google Sans','Product Sans',sans-serif" font-size="18" font-weight="700">
      ${escapeXml(followers)}
    </text>
    <text x="0" y="18" fill="${colors.textSecondary}" 
          font-family="'Google Sans','Product Sans',sans-serif" font-size="11">Followers</text>
  </g>

  <!-- Watermark -->
  <text x="${W - 12}" y="${H - 8}" text-anchor="end" 
        fill="${colors.watermark}" font-family="'Google Sans','Product Sans',sans-serif" 
        font-size="9" opacity="0.6">githubsmartapi.vercel.app</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);

  } catch (err) {
    console.error('❌ Card generation failed:', err.message);
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const colors = THEME_COLORS[theme];
    const errorSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="500" height="350" viewBox="0 0 500 350">
  <rect width="500" height="350" rx="20" fill="${colors.bgPrimary}"/>
  <text x="250" y="175" text-anchor="middle" fill="#ef4444" 
        font-family="'Google Sans','Product Sans',sans-serif" font-size="16">
    ⚠️ ${escapeXml(String(err.message))}
  </text>
</svg>`;
    res.status(500).setHeader('Content-Type', 'image/svg+xml').send(errorSvg);
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ✨ END OF CONTROLLER – Keep building awesome things! 🚀
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
