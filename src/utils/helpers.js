/**
 * Utility functions for date calculations and formatting.
 */

/**
 * Calculate days between a past date and now.
 * @param {string} dateString - ISO date string (e.g., user.created_at)
 * @returns {number} - Number of days since the given date
 */
export const daysSince = (dateString) => {
  const then = new Date(dateString);
  const now = new Date();
  const diffMs = now - then;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Convert days to years (approximate).
 * @param {string} createdAt - ISO date string
 * @returns {number} - Account age in years (rounded down)
 */
export const getAgeInYears = (createdAt) => {
  return Math.floor(daysSince(createdAt) / 365);
};
