/**
 * User Controller v3.0
 * Comprehensive error handling, validation, and enhanced SVG generation
 */
import { fetchGitHubData, fetchContributions } from '../services/github.service.js';
import { analyzeUser } from '../services/analysis.service.js';
import { calculateScore } from '../services/scoring.service.js';
import { generateAISummary } from '../services/ai.service.js';
import { cache } from '../services/cache.service.js';
import { getBase64Image } from '../utils/image.js';
import { config } from '../config/env.js';

// Custom background images
const CUSTOM_BG = [
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/main/images/BG1.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/main/images/BG2.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/main/images/BG3.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/main/images/BG4.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/main/images/BG5.png',
  'https://raw.githubusercontent.com/Shineii86/GitHubAPI/main/images/BG6.png',
];

// Validation helpers
const validateUsername = (username) => /^[a-zA-Z0-9-]{1,39}$/.test(username);
const sanitizeString = (str) => str ? String(str).replace(/[<>\"']/g, '') : '';

/**
 * GET /api/user/:username - Enhanced JSON Analysis
 */
export const getUserAnalysis = async (req, res) => {
  const startTime = Date.now();
  const { username } = req.params;
  
  try {
    // Validation
    if (!validateUsername(username)) {
      return res.status(400).json({
        error: 'INVALID_USERNAME',
        message: 'Username must be 1-39 alphanumeric characters or hyphens'
      });
    }

    // Check cache
    const cacheKey = `user:v3:${username.toLowerCase()}`;
    const cached = await cache.get(cacheKey);
    
    if (cached && !req.query.refresh) {
      return res.json({
        ...cached,
        cached: true,
        responseTime: Date.now() - startTime
      });
    }

    // Fetch data
    const [githubData, contributions] = await Promise.all([
      fetchGitHubData(username),
      fetchContributions(username)
    ]);

    const analysis = analyzeUser(githubData, contributions);
    const scoreData = calculateScore(analysis);

    // AI Summary (optional, non-blocking)
    let aiSummary = null;
    if (config.openAiKey && req.query.ai !== 'false') {
      try {
        aiSummary = await Promise.race([
          generateAISummary(analysis, scoreData),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI_TIMEOUT')), 5000)
          )
        ]);
      } catch (aiErr) {
        console.warn('AI Summary failed:', aiErr.message);
        aiSummary = 'AI analysis temporarily unavailable';
      }
    }

    const response = {
      username: analysis.profile.username,
      score: scoreData.score,
      rank: scoreData.tier,
      rankTitle: scoreData.title,
      rankColor: scoreData.color,
      level: scoreData.score, // Backwards compatibility
      breakdown: scoreData.breakdown,
      profile: analysis.profile,
      stats: analysis.stats,
      languages: analysis.languages.slice(0, 5), // Top 5 only
      topLanguage: analysis.topLanguage,
      aiSummary,
      meta: {
        ...analysis.meta,
        responseTime: Date.now() - startTime,
        apiVersion: '3.0.0'
      }
    };

    await cache.set(cacheKey, response, 300);
    
    // Security headers
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.json(response);

  } catch (err) {
    console.error(`Error analyzing ${username}:`, err);
    
    const errorResponses = {
      'USER_NOT_FOUND': { status: 404, message: 'GitHub user not found' },
      'RATE_LIMITED': { status: 429, message: 'GitHub API rate limit exceeded. Try again later.' },
      'GITHUB_API_ERROR': { status: 503, message: 'GitHub API temporarily unavailable' }
    };

    const error = errorResponses[err.message] || { status: 500, message: 'Internal server error' };
    
    res.status(error.status).json({
      error: err.message || 'UNKNOWN_ERROR',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * GET /api/vs/:user1/:user2 - Side by Side Comparison
 */
export const compareUsers = async (req, res) => {
  const { user1, user2 } = req.params;
  const startTime = Date.now();

  try {
    if (!validateUsername(user1) || !validateUsername(user2)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }

    const [data1, data2] = await Promise.all([
      getUserData(user1),
      getUserData(user2)
    ]);

    const comparison = {
      user1: data1,
      user2: data2,
      winner: data1.score > data2.score ? user1 : user2,
      diff: Math.abs(data1.score - data2.score),
      comparedAt: new Date().toISOString(),
      responseTime: Date.now() - startTime
    };

    res.json(comparison);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

async function getUserData(username) {
  const cacheKey = `user:v3:${username.toLowerCase()}`;
  const cached = await cache.get(cacheKey);
  
  if (cached) return cached;

  const [githubData, contributions] = await Promise.all([
    fetchGitHubData(username),
    fetchContributions(username)
  ]);

  const analysis = analyzeUser(githubData, contributions);
  const scoreData = calculateScore(analysis);

  return {
    username,
    score: scoreData.score,
    rank: scoreData.tier,
    rankTitle: scoreData.title,
    ...analysis
  };
}

/**
 * GET /api/card/:username - Enhanced SVG Card
 */
export const generateProfileCard = async (req, res) => {
  const { username } = req.params;
  
  try {
    if (!validateUsername(username)) {
      throw new Error('Invalid username');
    }

    const theme = req.query.theme === 'light' ? 'light' : 'dark';
    const bgImageIndex = parseInt(req.query.bgImage, 10);
    
    // Fetch data
    const [githubData, contributions] = await Promise.all([
      fetchGitHubData(username),
      fetchContributions(username)
    ]);

    const analysis = analyzeUser(githubData, contributions);
    const scoreData = calculateScore(analysis);
    
    // Background image handling
    let bgImageDataUrl = null;
    if (!isNaN(bgImageIndex) && bgImageIndex >= 1 && bgImageIndex <= CUSTOM_BG.length) {
      bgImageDataUrl = await getBase64Image(CUSTOM_BG[bgImageIndex - 1]);
    }

    // Generate SVG
    const svg = await createSVGCard(analysis, scoreData, theme, bgImageDataUrl, req.query);
    
    res.set('Content-Type', 'image/svg+xml');
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    res.set('X-Content-Type-Options', 'nosniff');
    res.send(svg);

  } catch (err) {
    console.error('Card generation error:', err);
    const errorSvg = createErrorCard(err.message, req.query.theme);
    
    res.status(500)
      .set('Content-Type', 'image/svg+xml')
      .send(errorSvg);
  }
};

async function createSVGCard(analysis, scoreData, theme, bgImage, options) {
  const { profile, stats } = analysis;
  const { score, title, color } = scoreData;
  
  const width = 800;
  const height = 400;
  
  // Theme colors
  const colors = theme === 'light' ? {
    bg: '#f8fafc',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
    card: '#ffffff',
    accent: color || '#3b82f6'
  } : {
    bg: '#0f172a',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    border: '#1e293b',
    card: '#1e293b',
    accent: color || '#60a5fa'
  };

  // Avatar handling
  const avatarBase64 = await getBase64Image(profile.avatarUrl);
  
  // Progress calculation
  const level = Math.floor(score);
  const nextLevel = level + 1;
  const progress = (score % 1) * 100;
  
  // Stats for display
  const displayStats = [
    { label: 'Repos', value: stats.totalRepos },
    { label: 'Stars', value: stats.totalStars },
    { label: 'Followers', value: profile.followers },
    { label: 'Contributions', value: stats.contributionStats?.totalContributions || 0 }
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${colors.bg}"/>
      <stop offset="100%" stop-color="${colors.card}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.15"/>
    </filter>
    <clipPath id="avatarClip">
      <circle cx="60" cy="60" r="50"/>
    </clipPath>
  </defs>

  ${bgImage ? `
    <image href="${bgImage}" width="100%" height="100%" preserveAspectRatio="cover"/>
    <rect width="100%" height="100%" fill="${colors.bg}" opacity="0.85"/>
  ` : `<rect width="100%" height="100%" fill="url(#bgGrad)"/>`}

  <!-- Main Card -->
  <rect x="20" y="20" width="${width-40}" height="${height-40}" rx="16" 
        fill="${colors.card}" stroke="${colors.border}" stroke-width="2" filter="url(#shadow)"/>

  <!-- Avatar -->
  <image href="${avatarBase64}" x="40" y="40" width="100" height="100" clip-path="url(#avatarClip)"/>
  <circle cx="90" cy="90" r="52" fill="none" stroke="${colors.accent}" stroke-width="3"/>

  <!-- User Info -->
  <text x="160" y="70" font-family="Segoe UI, system-ui, sans-serif" font-size="24" 
        font-weight="700" fill="${colors.text}">${sanitizeString(profile.name || profile.username)}</text>
  <text x="160" y="95" font-family="Segoe UI, system-ui, sans-serif" font-size="14" 
        fill="${colors.textMuted}">@${profile.username}</text>
  <text x="160" y="120" font-family="Segoe UI, system-ui, sans-serif" font-size="13" 
        fill="${colors.textMuted}" font-style="italic">${sanitizeString(profile.bio || 'GitHub Developer').substring(0, 60)}</text>

  <!-- Rank Badge -->
  <g transform="translate(650, 50)">
    <rect x="0" y="0" width="110" height="40" rx="20" fill="${colors.accent}" opacity="0.15"/>
    <text x="55" y="26" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" 
          font-size="16" font-weight="700" fill="${colors.accent}">${title}</text>
  </g>

  <!-- Level Progress -->
  <g transform="translate(160, 140)">
    <text font-family="Segoe UI, system-ui, sans-serif" font-size="12" fill="${colors.textMuted}">
      LEVEL ${level} <tspan fill="${colors.accent}">${Math.round(score * 10) / 10}</tspan>
    </text>
    <rect x="0" y="20" width="400" height="8" rx="4" fill="${colors.border}"/>
    <rect x="0" y="20" width="${progress * 4}" height="8" rx="4" fill="${colors.accent}"/>
    <text x="410" y="28" font-family="Segoe UI, system-ui, sans-serif" font-size="11" 
          fill="${colors.textMuted}">${Math.round(progress)}% to LVL ${nextLevel}</text>
  </g>

  <!-- Stats Grid -->
  <g transform="translate(40, 220)">
    ${displayStats.map((stat, i) => `
      <g transform="translate(${i * 180}, 0)">
        <rect width="160" height="80" rx="12" fill="${colors.bg}" stroke="${colors.border}" stroke-width="1"/>
        <text x="80" y="35" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" 
              font-size="24" font-weight="700" fill="${colors.text}">
          ${stat.value > 999 ? (stat.value/1000).toFixed(1) + 'k' : stat.value}
        </text>
        <text x="80" y="60" text-anchor="middle" font-family="Segoe UI, system-ui, sans-serif" 
              font-size="12" fill="${colors.textMuted}">${stat.label}</text>
      </g>
    `).join('')}
  </g>

  <!-- Languages -->
  <g transform="translate(40, 320)">
    <text font-family="Segoe UI, system-ui, sans-serif" font-size="12" font-weight="600" 
          fill="${colors.text}">Top Languages</text>
    ${analysis.languages.slice(0, 4).map((lang, i) => `
      <g transform="translate(${i * 120}, 25)">
        <circle cx="6" cy="6" r="6" fill="${getLangColor(lang.name)}"/>
        <text x="20" y="11" font-family="Segoe UI, system-ui, sans-serif" font-size="12" 
              fill="${colors.textMuted}">${lang.name} ${lang.percentage}%</text>
      </g>
    `).join('')}
  </g>

  <!-- Footer -->
  <text x="${width-40}" y="${height-30}" text-anchor="end" font-family="Segoe UI, system-ui, sans-serif" 
        font-size="10" fill="${colors.textMuted}" opacity="0.6">
    githubsmartapi.vercel.app • v3.0
  </text>
</svg>`;
}

function createErrorCard(message, theme) {
  const isLight = theme === 'light';
  const bg = isLight ? '#f8fafc' : '#0f172a';
  const text = isLight ? '#0f172a' : '#f8fafc';
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200" viewBox="0 0 600 200">
    <rect width="600" height="200" rx="12" fill="${bg}" stroke="#ef4444" stroke-width="2"/>
    <text x="300" y="90" text-anchor="middle" font-family="system-ui" font-size="16" fill="#ef4444">
      ⚠️ Error Generating Card
    </text>
    <text x="300" y="120" text-anchor="middle" font-family="system-ui" font-size="13" fill="${text}">
      ${sanitizeString(message)}
    </text>
  </svg>`;
}

function getLangColor(lang) {
  const colors = {
    JavaScript: '#f7df1e', TypeScript: '#3178c6', Python: '#3776ab',
    Java: '#b07219', Go: '#00add8', Rust: '#dea584',
    'C++': '#f34b7d', C: '#555555', 'C#': '#178600',
    Ruby: '#cc342d', PHP: '#4F5D95', Swift: '#ffac45'
  };
  return colors[lang] || '#8b949e';
}
