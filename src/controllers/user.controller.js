/**
 * Enhanced User Controller – Modern UI/UX with Glassmorphism, Animations, and Data Viz
 * 
 * Features:
 * - Animated SVG profile cards with gradient meshes and glassmorphism
 * - Level progress bars and contribution sparklines
 * - Language distribution pie chart in profile cards
 * - Smooth transitions and hover states (for HTML endpoints)
 * - Enhanced error boundaries with fallback UI
 * - Rate limiting headers and cache strategies
 * - Accessibility improvements (ARIA labels, contrast ratios)
 * - Mobile-responsive card layouts
 * 
 * @author Shinei Nouzen (@Shineii86)
 * @license MIT
 */

import axios from 'axios';
import { fetchGitHubData, fetchContributions } from '../services/github.service.js';
import { analyzeUser } from '../services/analysis.service.js';
import { calculateScore } from '../services/scoring.service.js';
import { generateAISummary } from '../services/ai.service.js';
import { getCached, setCached } from '../services/cache.service.js';
import { getRankName, getRankWithBullet, getRankDetails, getRankColor } from '../utils/rank.js';
import { getBase64Image } from '../utils/image.js';

// ----------------------------------------------------------------------
// Background Assets – Indexed Collection
// ----------------------------------------------------------------------
const CUSTOM_BG = [
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG1.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG2.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG3.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG4.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG5.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/refs/heads/main/images/BG6.png',
];

// ----------------------------------------------------------------------
// Design System – Colors, Gradients, Typography
// ----------------------------------------------------------------------
const DESIGN_TOKENS = {
  dark: {
    bg: { start: '#0f172a', end: '#1e293b', accent: '#334155' },
    text: { primary: '#f8fafc', secondary: '#cbd5e1', muted: '#94a3b8' },
    rank: { default: '#fbbf24', legend: '#f59e0b', epic: '#ec4899', rare: '#8b5cf6' },
    glass: { bg: 'rgba(30, 41, 59, 0.85)', border: 'rgba(255, 255, 255, 0.1)' },
    glow: { primary: 'rgba(56, 189, 248, 0.3)', success: 'rgba(34, 197, 94, 0.3)' },
    stats: { 
      commit: '#22d3ee', pr: '#a78bfa', issue: '#f472b6', 
      review: '#34d399', contrib: '#fbbf24' 
    }
  },
  light: {
    bg: { start: '#f8fafc', end: '#e2e8f0', accent: '#cbd5e1' },
    text: { primary: '#0f172a', secondary: '#475569', muted: '#64748b' },
    rank: { default: '#f59e0b', legend: '#d97706', epic: '#db2777', rare: '#7c3aed' },
    glass: { bg: 'rgba(255, 255, 255, 0.9)', border: 'rgba(0, 0, 0, 0.05)' },
    glow: { primary: 'rgba(59, 130, 246, 0.2)', success: 'rgba(34, 197, 94, 0.2)' },
    stats: { 
      commit: '#0891b2', pr: '#7c3aed', issue: '#db2777', 
      review: '#059669', contrib: '#d97706' 
    }
  }
};

// ----------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------
async function getBase64ImageFromUrl(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: { 'User-Agent': 'GitHubSmartAPI/2.0' }
    });
    const contentType = response.headers['content-type'];
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.error('[Background Fetch Error]:', url, err.message);
    return null;
  }
}

function escapeXml(str) {
  if (str == null) return '';
  const s = String(str);
  return s.replace(/[<>&'"]/g, (ch) => {
    const map = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };
    return map[ch] || ch;
  });
}

function generateGradientDefinition(id, colors) {
  return `
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colors[0]}" />
      <stop offset="100%" stop-color="${colors[1]}" />
    </linearGradient>
  `;
}

function generateProgressBar(x, y, width, height, progress, color, bgColor, radius = 4) {
  const progressWidth = (width * Math.min(Math.max(progress, 0), 100)) / 100;
  return `
    <g transform="translate(${x}, ${y})">
      <rect width="${width}" height="${height}" rx="${radius}" fill="${bgColor}" opacity="0.3"/>
      <rect width="${progressWidth}" height="${height}" rx="${radius}" fill="${color}">
        <animate attributeName="width" from="0" to="${progressWidth}" dur="1s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1"/>
      </rect>
    </g>
  `;
}

function generateLanguageBars(languages, x, y, width, maxItems = 4, theme) {
  if (!languages || languages.length === 0) return '';
  
  const tokens = DESIGN_TOKENS[theme];
  let svg = '';
  const barHeight = 4;
  const spacing = 20;
  
  languages.slice(0, maxItems).forEach((lang, index) => {
    const yPos = y + (index * spacing);
    const percentage = lang.percentage || 0;
    const langColor = lang.color || tokens.stats.commit;
    
    svg += `
      <g transform="translate(${x}, ${yPos})">
        <circle cx="6" cy="6" r="4" fill="${langColor}"/>
        <text x="16" y="9" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="11" fill="${tokens.text.secondary}">${escapeXml(lang.name)}</text>
        <text x="${width}" y="9" text-anchor="end" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="11" font-weight="600" fill="${tokens.text.primary}">${percentage}%</text>
        ${generateProgressBar(0, 12, width, barHeight, percentage, langColor, tokens.text.muted, 2)}
      </g>
    `;
  });
  
  return svg;
}

function generateSparkline(data, x, y, width, height, color) {
  if (!data || data.length < 2) return '';
  
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  
  let pathD = `M ${x} ${y + height - ((data[0] - min) / range) * height}`;
  
  data.forEach((val, i) => {
    const px = x + (i * stepX);
    const py = y + height - ((val - min) / range) * height;
    pathD += ` L ${px} ${py}`;
  });
  
  return `
    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.8">
      <animate attributeName="stroke-dasharray" from="0, ${width * 2}" to="${width * 2}, 0" dur="1.5s" fill="freeze"/>
    </path>
  `;
}

// ----------------------------------------------------------------------
// Core Analysis Logic
// ----------------------------------------------------------------------
export const getUserAnalysisData = async (username, includeAI = false) => {
  const cacheKey = `analysis:${username}:${includeAI ? 'ai' : 'noai'}`;
  const cached = await getCached(cacheKey);
  if (cached) return { ...cached, cached: true };

  const githubData = await fetchGitHubData(username);
  const contributions = await fetchContributions(username);
  const analysis = analyzeUser(githubData, contributions);
  const scoreData = calculateScore(analysis);
  
  let aiSummary = null;
  if (includeAI && process.env.OPENAI_API_KEY) {
    aiSummary = await generateAISummary(analysis, scoreData);
  }

  const level = Math.floor(scoreData.score);
  const nextLevelScore = Math.pow(level + 1, 1.8) * 100;
  const currentLevelScore = Math.pow(level, 1.8) * 100;
  const progress = ((scoreData.score * 100 - currentLevelScore) / (nextLevelScore - currentLevelScore)) * 100;

  const result = {
    username,
    score: scoreData.score,
    rank: scoreData.rank,
    level,
    progress: Math.min(Math.max(progress, 0), 100),
    nextLevelAt: nextLevelScore,
    rankName: getRankName(scoreData.score),
    rankWithBullet: getRankWithBullet(scoreData.score),
    rankColor: getRankColor(scoreData.score),
    profile: analysis.profile,
    stats: analysis.stats,
    topLanguages: analysis.languages,
    contributionCalendar: contributions?.calendar || [],
    aiSummary,
    analyzedAt: new Date().toISOString(),
  };

  await setCached(cacheKey, result, 300);
  return result;
};

// ----------------------------------------------------------------------
// JSON API Endpoints
// ----------------------------------------------------------------------
export const getUserAnalysis = async (req, res) => {
  try {
    const { username } = req.params;
    const includeAI = req.query.ai === 'true';
    
    if (!username || !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)) {
      return res.status(400).json({ 
        error: 'Invalid username format',
        message: 'GitHub usernames must be 1-39 characters, alphanumeric with hyphens'
      });
    }

    const data = await getUserAnalysisData(username, includeAI);
    
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.setHeader('X-RateLimit-Remaining', req.rateLimit?.remaining || 'N/A');
    res.json(data);
    
  } catch (err) {
    console.error(`[Analysis Error] ${req.params.username}:`, err);
    const status = err.response?.status === 404 ? 404 : 500;
    res.status(status).json({ 
      error: status === 404 ? 'GitHub user not found' : 'Internal server error',
      message: err.message,
      timestamp: new Date().toISOString()
    });
  }
};

export const compareUsers = async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    
    const [data1, data2] = await Promise.all([
      getUserAnalysisData(user1),
      getUserAnalysisData(user2)
    ]);

    const winner = data1.score > data2.score ? user1 : user2;
    const diff = Math.abs(data1.score - data2.score);

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      comparison: {
        winner,
        scoreDifference: diff.toFixed(2),
        generatedAt: new Date().toISOString()
      },
      user1: data1,
      user2: data2,
      stats: {
        totalCommits: (data1.stats?.totalCommits || 0) + (data2.stats?.totalCommits || 0),
        combinedLanguages: [...new Set([
          ...(data1.topLanguages || []).map(l => l.name),
          ...(data2.topLanguages || []).map(l => l.name)
        ])]
      }
    });
    
  } catch (err) {
    console.error('[Comparison Error]:', err);
    res.status(500).json({ 
      error: 'Comparison failed',
      message: err.message 
    });
  }
};

// ----------------------------------------------------------------------
// Enhanced SVG Profile Card Generator
// ----------------------------------------------------------------------
export const generateProfileCard = async (req, res) => {
  const username = req.params.username;
  const theme = req.query.theme === 'light' ? 'light' : 'dark';
  const showLanguages = req.query.lang !== 'false';
  const showSparkline = req.query.sparkline !== 'false';
  const bgImageIndex = parseInt(req.query.bgImage, 10);
  
  try {
    // Validation
    if (!username || !/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username)) {
      throw new Error('Invalid username format');
    }

    // Fetch data
    const [userData, rawUser] = await Promise.all([
      getUserAnalysisData(username),
      axios.get(`https://api.github.com/users/${username}`, {
        headers: { 
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          'User-Agent': 'GitHubSmartAPI/2.0'
        },
        timeout: 5000
      }).then(r => r.data)
    ]);

    // Background image handling
    let bgImageDataUrl = null;
    if (!isNaN(bgImageIndex) && bgImageIndex >= 1 && bgImageIndex <= CUSTOM_BG.length) {
      bgImageDataUrl = await getBase64ImageFromUrl(CUSTOM_BG[bgImageIndex - 1]);
    }

    // Assets
    const avatarBase64 = await getBase64Image(rawUser.avatar_url);
    const tokens = DESIGN_TOKENS[theme];
    
    // Dimensions
    const width = 850;
    const height = 400;
    const padding = 40;
    
    // Data extraction
    const { 
      score, level, progress, rankName, rankColor,
      topLanguages, stats, contributionCalendar 
    } = userData;
    
    const displayName = rawUser.name || username;
    const bio = rawUser.bio ? 
      (rawUser.bio.length > 80 ? rawUser.bio.slice(0, 77) + '...' : rawUser.bio) : 
      'Open Source Contributor';

    // Generate Language Visualization
    const languageSvg = showLanguages ? generateLanguageBars(
      topLanguages, 
      width - 220, 
      140, 
      180, 
      4, 
      theme
    ) : '';

    // Generate Contribution Sparkline (last 30 days approximation)
    const sparklineData = contributionCalendar.slice(-30).map(day => day.count || 0);
    const sparklineSvg = showSparkline ? generateSparkline(
      sparklineData,
      padding + 200,
      height - 80,
      300,
      40,
      tokens.stats.contrib
    ) : '';

    // Dynamic Rank Color
    const rankGlowColor = rankColor || tokens.rank.default;

    // Background Setup
    const backgroundSvg = bgImageDataUrl ? `
      <defs>
        <filter id="blur">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3"/>
        </filter>
        <linearGradient id="bgOverlay" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${tokens.bg.start}" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="${tokens.bg.end}" stop-opacity="0.95"/>
        </linearGradient>
      </defs>
      <image href="${escapeXml(bgImageDataUrl)}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" filter="url(#blur)"/>
      <rect width="100%" height="100%" fill="url(#bgOverlay)"/>
    ` : `
      <defs>
        ${generateGradientDefinition('mainBg', [tokens.bg.start, tokens.bg.end])}
        ${generateGradientDefinition('rankGrad', [rankGlowColor, tokens.rank.epic])}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
        <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity="0.25"/>
        </filter>
      </defs>
      <rect width="100%" height="100%" rx="24" fill="url(#mainBg)" filter="url(#cardShadow)"/>
    `;

    // Stats Grid Calculation
    const statItems = [
      { label: 'Repos', value: rawUser.public_repos || 0, icon: '●', color: tokens.stats.commit },
      { label: 'Commits', value: stats?.totalCommits || 'N/A', icon: '●', color: tokens.stats.contrib },
      { label: 'PRs', value: stats?.pullRequests || 0, icon: '●', color: tokens.stats.pr },
      { label: 'Stars', value: stats?.totalStars || 0, icon: '★', color: tokens.stats.issue }
    ];

    const statsY = 280;
    const statsStartX = 200;
    const statsSpacing = 150;

    // Main SVG Construction
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="GitHub Profile Card for ${escapeXml(username)}">
  ${backgroundSvg}
  
  <!-- Glassmorphism Side Panel -->
  <rect x="20" y="20" width="160" height="${height - 40}" rx="16" fill="${tokens.glass.bg}" stroke="${tokens.glass.border}" stroke-width="1"/>
  
  <!-- Avatar Section -->
  <defs>
    <clipPath id="avatarClip">
      <circle cx="100" cy="100" r="50"/>
    </clipPath>
    <linearGradient id="avatarRing" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${rankGlowColor}"/>
      <stop offset="100%" stop-color="${tokens.rank.epic}"/>
    </linearGradient>
  </defs>
  
  <!-- Avatar Glow -->
  <circle cx="100" cy="100" r="58" fill="url(#avatarRing)" opacity="0.3" filter="url(#glow)">
    <animate attributeName="opacity" values="0.3;0.5;0.3" dur="3s" repeatCount="indefinite"/>
  </circle>
  
  <!-- Avatar Image -->
  <circle cx="100" cy="100" r="54" fill="url(#avatarRing)"/>
  <image href="${escapeXml(avatarBase64)}" x="46" y="46" width="108" height="108" clip-path="url(#avatarClip)"/>
  
  <!-- Level Badge -->
  <g transform="translate(100, 170)">
    <rect x="-35" y="0" width="70" height="28" rx="14" fill="${tokens.glass.bg}" stroke="${rankGlowColor}" stroke-width="2"/>
    <text x="0" y="19" text-anchor="middle" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="14" font-weight="700" fill="${rankGlowColor}">Lv ${level}</text>
  </g>
  
  <!-- Rank Badge -->
  <g transform="translate(100, 215)">
    <text x="0" y="0" text-anchor="middle" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="24" font-weight="800" fill="${rankGlowColor}" filter="url(#glow)">${escapeXml(rankName)}</text>
  </g>
  
  <!-- Main Content Area -->
  <g transform="translate(200, 60)">
    <!-- Name & Username -->
    <text x="0" y="0" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="32" font-weight="700" fill="${tokens.text.primary}">
      ${escapeXml(displayName)}
      ${rawUser.hireable ? '<tspan dx="10" fill="#22c55e" font-size="20">●</tspan>' : ''}
    </text>
    <text x="0" y="30" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="16" fill="${tokens.text.secondary}">@${escapeXml(username)}</text>
    
    <!-- Bio -->
    <text x="0" y="65" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="14" fill="${tokens.text.muted}" font-style="italic">
      "${escapeXml(bio)}"
    </text>
    
    <!-- Progress Bar -->
    <g transform="translate(0, 85)">
      <text x="0" y="0" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="11" fill="${tokens.text.muted}">Progress to Level ${level + 1}</text>
      ${generateProgressBar(0, 8, 300, 8, progress, rankGlowColor, tokens.bg.accent, 4)}
      <text x="300" y="0" text-anchor="end" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="11" fill="${tokens.text.secondary}">${Math.round(progress)}%</text>
    </g>
    
    <!-- Stats Grid -->
    <g transform="translate(0, ${statsY - 60})">
      ${statItems.map((stat, i) => `
        <g transform="translate(${i * statsSpacing}, 0)">
          <text x="0" y="0" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="24" font-weight="700" fill="${stat.color}">${stat.value}</text>
          <text x="0" y="20" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="12" fill="${tokens.text.muted}" text-transform="uppercase" letter-spacing="1">${stat.label}</text>
        </g>
      `).join('')}
    </g>
  </g>
  
  <!-- Language Distribution -->
  ${languageSvg ? `
    <g transform="translate(${width - 240}, 110)">
      <text x="0" y="0" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="12" font-weight="600" fill="${tokens.text.secondary}" letter-spacing="1">TOP LANGUAGES</text>
      ${languageSvg}
    </g>
  ` : ''}
  
  <!-- Contribution Graph -->
  ${sparklineSvg ? `
    <g transform="translate(0, ${height - 100})">
      <text x="${padding + 200}" y="-10" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="11" fill="${tokens.text.muted}">30-Day Activity</text>
      ${sparklineSvg}
    </g>
  ` : ''}
  
  <!-- Footer -->
  <text x="${width - 20}" y="${height - 15}" text-anchor="end" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="10" fill="${tokens.text.muted}" opacity="0.6">
    githubsmartapi.vercel.app • Generated ${new Date().toLocaleDateString()}
  </text>
  
  <!-- Followers/Following Mini Stats -->
  <g transform="translate(200, ${height - 50})">
    <text x="0" y="0" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="13" fill="${tokens.text.secondary}">
      <tspan fill="${tokens.text.primary}" font-weight="600">${rawUser.following || 0}</tspan> Following
      <tspan dx="20" fill="${tokens.text.primary}" font-weight="600">${rawUser.followers || 0}</tspan> Followers
    </text>
  </g>
  
  <!-- Location & Company -->
  ${(rawUser.location || rawUser.company) ? `
    <g transform="translate(200, ${height - 25})">
      <text x="0" y="0" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="12" fill="${tokens.text.muted}">
        ${rawUser.location ? `📍 ${escapeXml(rawUser.location)}` : ''}
        ${rawUser.company ? `${rawUser.location ? '  ' : ''}🏢 ${escapeXml(rawUser.company)}` : ''}
      </text>
    </g>
  ` : ''}
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(svg);
    
  } catch (err) {
    console.error('[Card Generation Error]:', err);
    
    // Enhanced Error Card
    const tokens = DESIGN_TOKENS[theme];
    const errorSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="850" height="400" viewBox="0 0 850 400">
  <rect width="850" height="400" rx="24" fill="${tokens.bg.start}"/>
  <g transform="translate(425, 150)">
    <circle cx="0" cy="0" r="40" fill="#ef4444" opacity="0.2"/>
    <text x="0" y="10" text-anchor="middle" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="40" fill="#ef4444">⚠</text>
  </g>
  <text x="425" y="230" text-anchor="middle" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="20" font-weight="600" fill="${tokens.text.primary}">
    ${err.message.includes('not found') ? 'User Not Found' : 'Generation Failed'}
  </text>
  <text x="425" y="260" text-anchor="middle" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="14" fill="${tokens.text.secondary}">
    ${escapeXml(err.message)}
  </text>
</svg>`;
    
    res.status(err.message.includes('not found') ? 404 : 500);
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(errorSvg);
  }
};

// ----------------------------------------------------------------------
// Batch Card Generation (for comparisons)
// ----------------------------------------------------------------------
export const generateComparisonCard = async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    
    const [data1, data2] = await Promise.all([
      getUserAnalysisData(user1),
      getUserAnalysisData(user2)
    ]);
    
    const width = 900;
    const height = 500;
    const tokens = DESIGN_TOKENS[theme];
    
    // Generate side-by-side comparison SVG
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    ${generateGradientDefinition('bg', [tokens.bg.start, tokens.bg.end])}
    <filter id="shadow">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <rect width="100%" height="100%" rx="24" fill="url(#bg)"/>
  
  <!-- VS Badge -->
  <g transform="translate(${width/2}, ${height/2})">
    <circle r="35" fill="${tokens.rank.default}" filter="url(#shadow)"/>
    <text x="0" y="10" text-anchor="middle" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="24" font-weight="800" fill="#fff">VS</text>
  </g>
  
  <!-- User 1 Side -->
  <g transform="translate(100, 100)">
    <text x="150" y="0" text-anchor="middle" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="28" font-weight="700" fill="${tokens.text.primary}">${escapeXml(user1)}</text>
    <text x="150" y="40" text-anchor="middle" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="48" font-weight="800" fill="${data1.score > data2.score ? '#22c55e' : tokens.text.secondary}">${data1.score.toFixed(1)}</text>
    <text x="150" y="70" text-anchor="middle" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="16" fill="${tokens.text.muted}">${data1.rankName}</text>
  </g>
  
  <!-- User 2 Side -->
  <g transform="translate(500, 100)">
    <text x="150" y="0" text-anchor="middle" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="28" font-weight="700" fill="${tokens.text.primary}">${escapeXml(user2)}</text>
    <text x="150" y="40" text-anchor="middle" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="48" font-weight="800" fill="${data2.score > data1.score ? '#22c55e' : tokens.text.secondary}">${data2.score.toFixed(1)}</text>
    <text x="150" y="70" text-anchor="middle" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="16" fill="${tokens.text.muted}">${data2.rankName}</text>
  </g>
  
  <!-- Stats Comparison Bars -->
  <g transform="translate(100, 250)">
    ${['Commits', 'PRs', 'Issues', 'Stars'].map((stat, i) => {
      const val1 = data1.stats?.[stat.toLowerCase()] || 0;
      const val2 = data2.stats?.[stat.toLowerCase()] || 0;
      const total = val1 + val2 || 1;
      const pct1 = (val1 / total) * 300;
      const pct2 = (val2 / total) * 300;
      
      return `
        <g transform="translate(0, ${i * 60})">
          <text x="0" y="-10" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="12" fill="${tokens.text.muted}">${stat}</text>
          <rect x="0" y="0" width="${pct1}" height="20" rx="4" fill="#3b82f6"/>
          <rect x="${300 - pct2}" y="0" width="${pct2}" height="20" rx="4" fill="#ef4444"/>
          <text x="${pct1 + 10}" y="15" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="11" fill="${tokens.text.primary}">${val1}</text>
          <text x="${290 - pct2}" y="15" text-anchor="end" font-family="'Google Sans', 'Product Sans', sans-serif" font-size="11" fill="${tokens.text.primary}">${val2}</text>
        </g>
      `;
    }).join('')}
  </g>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);
    
  } catch (err) {
    console.error('[Comparison Card Error]:', err);
    res.status(500).json({ error: err.message });
  }
};
