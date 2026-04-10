import axios from 'axios';
import { config } from '../config/env.js';

/**
 * Convert an image URL to a Base64 data URL.
 * Falls back to a placeholder avatar if fetch fails.
 * @param {string} url - Image URL
 * @param {number} timeout - Request timeout in ms
 * @returns {Promise<string>} Base64 data URL
 */
export async function getBase64Image(url, timeout = 8000) {
  if (!url) {
    return getPlaceholderAvatar();
  }

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout,
      headers: {
        'User-Agent': 'GitHubSmartAPI/2.0',
      },
    });

    const contentType = response.headers['content-type'] || 'image/png';
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.warn(`[Image] Failed to fetch ${url}: ${err.message}`);
    return getPlaceholderAvatar();
  }
}

/**
 * Generate a simple SVG placeholder avatar.
 * @returns {string} Base64 SVG data URL
 */
function getPlaceholderAvatar() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#e2e8f0"/>
    <text x="50" y="65" font-family="Arial" font-size="40" fill="#94a3b8" text-anchor="middle">?</text>
  </svg>`;
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}
