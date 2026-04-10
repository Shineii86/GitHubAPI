/**
 * Rank system with 11 tiers (GODLIKE to BEGINNER).
 * Thresholds align with the upgraded scoring algorithm.
 */

export const RANK_THRESHOLDS = [
  { min: 100, name: 'GODLIKE', color: '#FFD700' },
  { min: 90, name: 'MYTHIC', color: '#C0C0C0' },
  { min: 80, name: 'LEGEND', color: '#CD7F32' },
  { min: 70, name: 'GRANDMASTER', color: '#4ADE80' },
  { min: 60, name: 'MASTER', color: '#60A5FA' },
  { min: 50, name: 'ELITE', color: '#A78BFA' },
  { min: 40, name: 'EXPERT', color: '#FBBF24' },
  { min: 30, name: 'DEVELOPER', color: '#F87171' },
  { min: 20, name: 'APPRENTICE', color: '#EC4899' },
  { min: 10, name: 'NOVICE', color: '#06B6D4' },
  { min: 0, name: 'BEGINNER', color: '#9CA3AF' },
];

/**
 * Get full rank details for a given score.
 * @param {number} score - 0-100 score
 * @returns {{ name: string, level: number, color: string }}
 */
export function getRankDetails(score) {
  const level = Math.floor(score);
  const rank = RANK_THRESHOLDS.find(r => level >= r.min) || RANK_THRESHOLDS[RANK_THRESHOLDS.length - 1];
  return { name: rank.name, level, color: rank.color };
}

/**
 * Get rank name only.
 * @param {number} score
 * @returns {string}
 */
export function getRankName(score) {
  return getRankDetails(score).name;
}

/**
 * Get rank with bullet (e.g., "MASTER • LV69").
 * @param {number} score
 * @returns {string}
 */
export function getRankWithBullet(score) {
  const { name, level } = getRankDetails(score);
  return `${name} • LV${level}`;
}

/**
 * Get rank color for a score.
 * @param {number} score
 * @returns {string} Hex color code
 */
export function getRankColor(score) {
  return getRankDetails(score).color;
}
