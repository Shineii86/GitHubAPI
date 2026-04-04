import axios from 'axios';

/**
 * Convert an image URL to base64 data URI.
 * Useful for embedding avatars directly into SVGs (bypasses external image blocking).
 * @param {string} url - Image URL (e.g., GitHub avatar)
 * @returns {Promise<string>} Base64 data URI
 */
export async function getBase64Image(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 5000 });
    const base64 = Buffer.from(res.data, 'binary').toString('base64');
    const contentType = res.headers['content-type'] || 'image/png';
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.error('Failed to fetch image:', err.message);
    // Fallback to a transparent pixel or return original URL
    return url;
  }
}
