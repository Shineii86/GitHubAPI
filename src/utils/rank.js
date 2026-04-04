/**
 * Rank utilities – game‑style rank titles based on level (score).
 * @param {number} score - Developer score (0–100)
 * @returns {string} Rank title with level, e.g., "MYTHIC (LV90)"
 */
export function getRankFromLevel(score) {
  const level = Math.floor(score);

  if (level >= 100) return 'GODLIKE (LV100)';
  if (level >= 90) return 'MYTHIC (LV90)';
  if (level >= 80) return 'LEGEND (LV80)';
  if (level >= 70) return 'GRANDMASTER (LV70)';
  if (level >= 60) return 'MASTER (LV60)';
  if (level >= 50) return 'ELITE (LV50)';
  if (level >= 40) return 'EXPERT (LV40)';
  if (level >= 30) return 'DEVELOPER (LV30)';
  if (level >= 20) return 'APPRENTICE (LV20)';
  if (level >= 10) return 'NOVICE (LV10)';
  return 'BEGINNER (LV1)';
}
