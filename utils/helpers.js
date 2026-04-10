/**
 * Utility functions for date calculations, formatting, and validation.
 */

/**
 * Calculate days between a past date and now.
 * @param {string|Date} dateInput - ISO date string or Date object
 * @returns {number} Days since the given date (rounded down)
 */
export const daysSince = (dateInput) => {
  const then = new Date(dateInput);
  if (isNaN(then.getTime())) return 0;
  const now = new Date();
  const diffMs = now - then;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Calculate account age in years.
 * @param {string} createdAt - ISO date string
 * @returns {number} Account age in years (rounded down)
 */
export const getAgeInYears = (createdAt) => {
  return Math.floor(daysSince(createdAt) / 365);
};

/**
 * Format a number with K/M/B suffixes.
 * @param {number} num - Number to format
 * @returns {string} Formatted string (e.g., "1.2K")
 */
export const formatNumber = (num) => {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
};

/**
 * Validate GitHub username format.
 * @param {string} username - Username to validate
 * @returns {boolean} True if valid
 */
export const isValidGitHubUsername = (username) => {
  if (!username || typeof username !== 'string') return false;
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(username);
};

/**
 * Safely parse JSON with fallback.
 * @param {string} str - JSON string
 * @param {any} fallback - Fallback value
 * @returns {any} Parsed object or fallback
 */
export const safeJsonParse = (str, fallback = null) => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

/**
 * Sleep for a given number of milliseconds.
 * @param {number} ms - Milliseconds
 * @returns {Promise} Promise that resolves after ms
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
