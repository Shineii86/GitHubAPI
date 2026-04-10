/**
 * Advanced Scoring Algorithm v3.0
 * Uses logarithmic decay for natural distribution and prevents gaming
 */
export const calculateScore = (data) => {
  const { stats, profile, languages } = data;

  // Helper: Logarithmic scoring (diminishing returns after certain thresholds)
  const logScore = (value, threshold, maxWeight) => {
    if (value <= 0) return 0;
    const normalized = Math.min(value / threshold, 5); // Cap at 5x threshold
    return (Math.log10(1 + normalized * 9) / Math.log10(10)) * maxWeight;
  };

  // 1. Star Impact (30%) - Logarithmic: 1000 stars ≈ max weight
  const starScore = logScore(stats.totalStars, 1000, 30);
  
  // 2. Repository Quality (20%) - Based on stars per repo ratio + total count
  const avgStarsPerRepo = stats.totalRepos > 0 ? stats.totalStars / stats.totalRepos : 0;
  const qualityBonus = Math.min(avgStarsPerRepo / 10, 5); // Bonus for quality over quantity
  const repoScore = logScore(stats.totalRepos, 50, 15) + qualityBonus;

  // 3. Activity Score (15%) - Weighted by recent vs total
  const activityRatio = stats.totalRepos > 0 ? (stats.activeRepos / stats.totalRepos) : 0;
  const activityScore = activityRatio * 15;

  // 4. Language Diversity (10%) - Bonus for polyglots, cap at 8 languages
  const langCount = Object.keys(languages).length;
  const diversityScore = Math.min(langCount / 8, 1) * 10;

  // 5. Community Impact (10%) - Followers with diminishing returns
  const followerScore = logScore(profile.followers, 1000, 10);

  // 6. Account Maturity (5%) - Older accounts get slight bonus (prevents new account spam)
  const ageScore = Math.min(profile.accountAgeYears / 10, 1) * 5;

  // 7. Contribution Consistency (10%) - Streaks + total contributions
  const contributionBase = logScore(stats.totalContributions, 2000, 7);
  const streakBonus = stats.currentStreak >= 30 ? 3 : stats.currentStreak >= 7 ? 1.5 : 0;
  const consistencyScore = contributionBase + streakBonus;

  // Calculate total (0-100)
  let totalScore = Math.round(
    starScore + repoScore + activityScore + diversityScore + 
    followerScore + ageScore + consistencyScore
  );

  // Clamp between 0-100
  totalScore = Math.max(0, Math.min(100, totalScore));

  // Game-style rank tiers (Old: SSS/S/A/B/C → New: More granular)
  const getRank = (score) => {
    if (score >= 100) return { tier: 'SSS', title: 'GODLIKE', color: '#FFD700' };
    if (score >= 95) return { tier: 'SS', title: 'TRANSCENDENT', color: '#FF6B6B' };
    if (score >= 90) return { tier: 'S+', title: 'MYTHIC', color: '#C0C0C0' };
    if (score >= 85) return { tier: 'S', title: 'LEGEND', color: '#CD7F32' };
    if (score >= 80) return { tier: 'A+', title: 'GRANDMASTER', color: '#4ADE80' };
    if (score >= 70) return { tier: 'A', title: 'MASTER', color: '#60A5FA' };
    if (score >= 60) return { tier: 'B+', title: 'ELITE', color: '#A78BFA' };
    if (score >= 50) return { tier: 'B', title: 'EXPERT', color: '#FBBF24' };
    if (score >= 40) return { tier: 'C+', title: 'DEVELOPER', color: '#F87171' };
    if (score >= 30) return { tier: 'C', title: 'APPRENTICE', color: '#EC4899' };
    if (score >= 20) return { tier: 'D+', title: 'NOVICE', color: '#06B6D4' };
    return { tier: 'D', title: 'BEGINNER', color: '#9CA3AF' };
  };

  const rankData = getRank(totalScore);

  return {
    score: totalScore,
    ...rankData,
    breakdown: {
      starScore: Math.round(starScore),
      repoScore: Math.round(repoScore),
      activityScore: Math.round(activityScore),
      diversityScore: Math.round(diversityScore),
      followerScore: Math.round(followerScore),
      ageScore: Math.round(ageScore),
      consistencyScore: Math.round(consistencyScore)
    }
  };
};
