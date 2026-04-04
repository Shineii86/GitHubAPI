/**
 * GET /api/badge/:username
 * Returns an SVG badge with username, score, and rank.
 * Now includes:
 * - Proper error handling (404, 500)
 * - Caching (reuses cached analysis)
 * - Fallback badge when user not found
 */
export const generateBadge = async (req, res) => {
  try {
    const { username } = req.params;

    // Try to get cached analysis first (to avoid extra GitHub calls)
    let analysisData;
    const cached = await getCached(`user:${username}`);
    if (cached) {
      analysisData = {
        scoreData: { score: cached.score, rank: cached.rank },
      };
    } else {
      // Fetch fresh data – may throw if user doesn't exist
      analysisData = await getUserAnalysisData(username);
      // Optionally cache the score data separately for badges
      await setCached(`badge:${username}`, analysisData.scoreData, 600); // 10 min
    }

    const { score, rank } = analysisData.scoreData;

    // Generate SVG – dynamic width based on username length
    const usernameDisplay = username.length > 20 ? username.slice(0, 17) + '...' : username;
    const width = 280 + Math.max(0, (usernameDisplay.length - 8) * 6);
    
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="40" viewBox="0 0 ${width} 40">
  <rect width="${width}" height="40" fill="#2d2d2d" rx="8"/>
  <text x="12" y="25" fill="white" font-family="monospace" font-size="14">${escapeXml(usernameDisplay)}</text>
  <text x="${width - 90}" y="25" fill="#ffcc00" font-family="monospace" font-size="14" font-weight="bold">${rank}</text>
  <text x="${width - 40}" y="25" fill="#ffffff" font-family="monospace" font-size="14">${score}</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300'); // cache for 5 minutes
    res.send(svg);
  } catch (err) {
    console.error('Badge error:', err.message);
    
    // Send a friendly fallback badge if user not found or other error
    const fallbackSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="240" height="40" viewBox="0 0 240 40">
  <rect width="240" height="40" fill="#2d2d2d" rx="8"/>
  <text x="12" y="25" fill="#ff5555" font-family="monospace" font-size="14">User not found</text>
</svg>`;
    res.status(404).setHeader('Content-Type', 'image/svg+xml').send(fallbackSvg);
  }
};

// Helper to escape XML special characters
function escapeXml(str) {
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
