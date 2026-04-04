/**
 * GET /api/card/:username
 * Returns a professional SVG profile card with:
 * - Centered profile photo (avatar)
 * - Following & Followers counts
 * - Large GitHub rank letter
 * - GitHub score
 */
export const generateProfileCard = async (req, res) => {
  try {
    const { username } = req.params;

    // Fetch user data (we already have analysis + scoreData)
    const { analysis, scoreData } = await getUserAnalysisData(username);
    
    // Additional user data from GitHub (avatar, following, bio)
    // We need the raw user object – we can re-fetch or extend analysis.
    // For simplicity, we call GitHub REST again (but could be cached).
    const { data: rawUser } = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` },
    });

    const {
      avatar_url,
      followers,
      following,
      bio,
      name,
    } = rawUser;

    const { rank, score } = scoreData;
    const displayName = name || username;
    const shortBio = bio ? (bio.length > 60 ? bio.slice(0, 57) + '...' : bio) : 'GitHub Developer';

    // SVG dimensions
    const width = 480;
    const height = 320;
    const avatarSize = 80;
    const avatarX = width / 2 - avatarSize / 2;
    const avatarY = 40;

    // SVG markup – modern card with gradient background
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1f1f2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2a2a3b;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="rankGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#ffb347" />
      <stop offset="100%" style="stop-color:#ffcc33" />
    </linearGradient>
    <clipPath id="circleClip">
      <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2}" />
    </clipPath>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" rx="16" fill="url(#bgGrad)" filter="url(#shadow)"/>

  <!-- Avatar circle background (glow) -->
  <circle cx="${width/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2 + 4}" fill="#3a3a4e" />
  <image x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" href="${avatar_url}" clip-path="url(#circleClip)" />

  <!-- Username & name -->
  <text x="${width/2}" y="${avatarY + avatarSize + 25}" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="18" font-weight="bold">${escapeXml(displayName)}</text>
  <text x="${width/2}" y="${avatarY + avatarSize + 45}" text-anchor="middle" fill="#aaaaaa" font-family="Arial, sans-serif" font-size="13">@${escapeXml(username)}</text>
  <text x="${width/2}" y="${avatarY + avatarSize + 70}" text-anchor="middle" fill="#cccccc" font-family="Arial, sans-serif" font-size="12">${escapeXml(shortBio)}</text>

  <!-- Following & Followers (side by side) -->
  <g transform="translate(${width/2 - 120}, ${height - 90})">
    <text x="0" y="0" text-anchor="middle" fill="#ffffff" font-size="16" font-weight="bold">${following}</text>
    <text x="0" y="20" text-anchor="middle" fill="#aaaaaa" font-size="12">Following</text>
  </g>
  <g transform="translate(${width/2 + 120}, ${height - 90})">
    <text x="0" y="0" text-anchor="middle" fill="#ffffff" font-size="16" font-weight="bold">${followers}</text>
    <text x="0" y="20" text-anchor="middle" fill="#aaaaaa" font-size="12">Followers</text>
  </g>

  <!-- Rank (large letter) -->
  <g transform="translate(${width/2 - 70}, ${height - 100})">
    <text x="0" y="0" text-anchor="middle" fill="url(#rankGrad)" font-family="'Courier New', monospace" font-size="48" font-weight="bold">${rank}</text>
    <text x="0" y="20" text-anchor="middle" fill="#aaaaaa" font-size="10">RANK</text>
  </g>

  <!-- Score (numeric) -->
  <g transform="translate(${width/2 + 70}, ${height - 100})">
    <text x="0" y="0" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="36" font-weight="bold">${score}</text>
    <text x="0" y="20" text-anchor="middle" fill="#aaaaaa" font-size="10">SCORE</text>
  </g>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);
  } catch (err) {
    console.error('Card generation error:', err.message);
    // Fallback error SVG
    const errorSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">
  <rect width="400" height="200" fill="#2d2d2d" rx="12"/>
  <text x="200" y="110" text-anchor="middle" fill="#ff5555" font-family="monospace" font-size="16">User not found or API error</text>
</svg>`;
    res.status(404).setHeader('Content-Type', 'image/svg+xml').send(errorSvg);
  }
};

// Helper function to escape XML special characters (already defined above, but keep)
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
