/**
 * Scoring algorithm that converts metrics into a 0–100 score and rank.
 */
export const calculateScore = (data) => {
  const { stats, profile, languages } = data;

  // Individual score components (each capped at its max weight)
  const starScore = Math.min(stats.totalStars / 100, 1) * 30;
  const repoScore = Math.min(stats.totalRepos / 50, 1) * 15;
  const activityScore = (stats.activeRepos / (stats.totalRepos || 1)) * 20;
  const diversityScore = Math.min(Object.keys(languages).length / 5, 1) * 15;
  const followerScore = Math.min(profile.followers / 500, 1) * 10;
  const ageScore = Math.min(profile.accountAgeYears / 5, 1) * 10;
  const contributionScore = Math.min(stats.totalContributions / 1000, 1) * 10;
  const streakBonus = stats.currentStreak >= 7 ? 5 : 0;

  let totalScore = Math.round(
    starScore +
      repoScore +
      activityScore +
      diversityScore +
      followerScore +
      ageScore +
      contributionScore +
      streakBonus
  );

  // Clamp to 100
  totalScore = Math.min(totalScore, 100);

  // Rank thresholds
  let rank = 'D';
  if (totalScore >= 90) rank = 'SSS';
  else if (totalScore >= 80) rank = 'S';
  else if (totalScore >= 70) rank = 'A';
  else if (totalScore >= 55) rank = 'B';
  else if (totalScore >= 40) rank = 'C';

  return { score: totalScore, rank };
};
