/**
 * Achievements Service - Fetches GitHub achievement badges from user profiles
 * 
 * Note: GitHub doesn't provide a public API for achievements yet.
 * This service scrapes the profile page HTML to extract achievement data.
 * 
 * @author Shinei Nouzen (@Shineii86)
 */

import axios from 'axios';

/**
 * Fetch achievement badges for a GitHub user
 * @param {string} username - GitHub username
 * @returns {Promise<Array>} Array of achievement objects { name, iconUrl }
 */
export const fetchAchievements = async (username) => {
  try {
    const response = await axios.get(`https://github.com/${username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GitHubAPIBot/1.0; +https://github.com/Shineii86/GitHubAPI)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
      },
      timeout: 8000,
      maxRedirects: 3
    });

    const html = response.data;
    const achievements = [];
    
    // Pattern 1: Extract from data-tooltip or aria-label attributes
    // GitHub achievement links contain aria-label="Achievement: [Name]"
    const achievementRegex = /<a[^>]*aria-label="Achievement:\s*([^"]+)"[^>]*>(?:[^<]*<img[^>]*src="([^"]+\.svg)"[^>]*>)?/gi;
    let match;
    
    while ((match = achievementRegex.exec(html)) !== null) {
      const name = match[1]?.trim();
      let iconUrl = match[2]?.trim();
      
      if (name && iconUrl) {
        // Convert relative URLs to absolute
        if (iconUrl.startsWith('/')) {
          iconUrl = `https://github.com${iconUrl}`;
        }
        // Only add if it's a valid GitHub assets URL
        if (iconUrl.includes('github.githubassets.com') || iconUrl.includes('github.com')) {
          achievements.push({ name, iconUrl });
        }
      }
    }

    // Pattern 2: Fallback - look for achievement SVGs in profile-contribution-calendar
    if (achievements.length === 0) {
      const fallbackRegex = /src="([^"]*achievement[^"]*\.svg)"[^>]*title="([^"]+)"/gi;
      while ((match = fallbackRegex.exec(html)) !== null) {
        let iconUrl = match[1];
        const name = match[2];
        if (iconUrl && name) {
          if (iconUrl.startsWith('/')) iconUrl = `https://github.com${iconUrl}`;
          if (!iconUrl.startsWith('http')) continue;
          // Avoid duplicates
          if (!achievements.find(a => a.name === name)) {
            achievements.push({ name, iconUrl });
          }
        }
      }
    }

    // Pattern 3: Last resort - common achievement names with standard icon paths
    if (achievements.length === 0) {
      const commonAchievements = [
        { name: 'Arctic Code Vault Contributor', path: '/images/modules/profile/icons/achievement-arctic-vault.svg' },
        { name: 'Pair Extraordinaire', path: '/images/modules/profile/icons/achievement-pair-extraordinaire.svg' },
        { name: 'Quickdraw', path: '/images/modules/profile/icons/achievement-quickdraw.svg' },
        { name: 'YOLO', path: '/images/modules/profile/icons/achievement-yolo.svg' },
        { name: 'Public Sponsor', path: '/images/modules/profile/icons/achievement-public-sponsor.svg' },
        { name: 'Galaxy Brain', path: '/images/modules/profile/icons/achievement-galaxy-brain.svg' },
        { name: 'Heart on Your Sleeve', path: '/images/modules/profile/icons/achievement-heart.svg' },
        { name: 'Starstruck', path: '/images/modules/profile/icons/achievement-starstruck.svg' },
      ];
      
      for (const ach of commonAchievements) {
        if (html.includes(ach.name)) {
          achievements.push({
            name: ach.name,
            iconUrl: `https://github.com${ach.path}`
          });
        }
      }
    }

    // Remove duplicates by name and limit to 6 for card layout
    const unique = achievements.filter((ach, index, self) =>
      index === self.findIndex(a => a.name === ach.name)
    );
    
    return unique.slice(0, 6);

  } catch (error) {
    // Graceful degradation - return empty array on error
    if (error.response?.status === 404) {
      console.warn(`User ${username} not found for achievements`);
    } else if (error.code === 'ECONNABORTED') {
      console.warn(`Timeout fetching achievements for ${username}`);
    } else {
      console.warn(`Achievements fetch warning for ${username}:`, error.message);
    }
    return [];
  }
};

/**
 * Convert achievement icon URL to base64 for SVG embedding
 * @param {string} url - Icon URL
 * @returns {Promise<string|null>} Base64 data URL or null on failure
 */
export const getAchievementIconBase64 = async (url) => {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GitHubAPIBot/1.0)'
      }
    });
    
    const contentType = response.headers['content-type'] || 'image/svg+xml';
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.warn(`Failed to fetch achievement icon: ${url}`, err.message);
    return null;
  }
};
