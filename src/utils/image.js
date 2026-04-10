import axios from 'axios';

export async function getBase64Image(url) {
  try {
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
    const base64 = Buffer.from(res.data, 'binary').toString('base64');
    const contentType = res.headers['content-type'] || 'image/png';
    return `data:${contentType};base64,${base64}`;
  } catch (err) {
    console.error('Failed to fetch image:', err.message);
    return url; // fallback to original URL
  }
}
