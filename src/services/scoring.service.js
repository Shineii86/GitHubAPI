/**
 * Enhanced scoring algorithm – multi‑factor model with logarithmic scaling.
 * Converts GitHub metrics into a 0‑100 score and a corresponding rank.
 */
export const calculateScore = (data) => {
  const { stats, profile } = data;

  // --------------------------------------------------------------------
  // 1. IMPACT (max 30 points) – Stars, forks, watchers
  // --------------------------------------------------------------------
  const starLog = stats.totalStars > 0 ? Math.log2(stats.totalStars + 1) : 0;
  const starComponent = Math.min(starLog / 10, 1) * 20;

  const forkLog = stats.totalForks > 0 ? Math.log2(stats.totalForks + 1) : 0;
  const forkComponent = Math.min(forkLog / 8, 1) * 8;

  const watcherComponent = Math.min(stats.totalWatchers / 500, 1) * 2;

  const impactScore = starComponent + forkComponent + watcherComponent;

  // --------------------------------------------------------------------
  // 2. ACTIVITY (max 25 points) – Contributions, PRs, active repos
  // --------------------------------------------------------------------
  const commitScore = Math.min(stats.totalContributions / 500, 1) * 8;
  const prScore = Math.min((stats.pullRequests || 0) / 30, 1) * 7;
  const issueScore = Math.min((stats.issuesOpened || 0) / 20, 1) * 5;
  const activeRepoRatio = stats.activeRepos / (stats.sourceRepos || 1);
  const activeRepoScore = activeRepoRatio * 5;

  const activityScore = commitScore + prScore + issueScore + activeRepoScore;

  // --------------------------------------------------------------------
  // 3. COMMUNITY (max 20 points) – Followers, following ratio
  // --------------------------------------------------------------------
  const followerLog = profile.followers > 0 ? Math.log2(profile.followers + 1) : 0;
  const followerComponent = Math.min(followerLog / 12, 1) * 15;

  const followingRatio = profile.following > 0
    ? Math.min(profile.followers / (profile.following || 1), 2)
    : 0;
  const ratioComponent = Math.min(followingRatio, 1) * 5;

  const communityScore = followerComponent + ratioComponent;

  // --------------------------------------------------------------------
  // 4. CONSISTENCY (max 15 points) – Account age, streaks
  // --------------------------------------------------------------------
  const ageComponent = Math.min(profile.accountAgeYears / 8, 1) * 5;
  const streakComponent = Math.min(stats.currentStreak / 30, 1) * 5;
  const longestStreakComponent = Math.min(stats.longestStreak / 90, 1) * 5;

  const consistencyScore = ageComponent + streakComponent + longestStreakComponent;

  // --------------------------------------------------------------------
  // 5. DIVERSITY (max 10 points) – Languages used
  // --------------------------------------------------------------------
  const languageCount = (data.languages || []).length;
  const langComponent = Math.min(languageCount / 8, 1) * 10;

  const diversityScore = langComponent;

  // --------------------------------------------------------------------
  // BONUS (max 5 points)
  // --------------------------------------------------------------------
  let bonus = 0;
  if (stats.totalStars >= 5000) bonus += 2;
  if (stats.pullRequests >= 100) bonus += 1.5;
  if (profile.followers >= 10000) bonus += 1.5;

  let totalScore = impactScore + activityScore + communityScore + consistencyScore + diversityScore + bonus;
  totalScore = Math.min(Math.round(totalScore), 100);

  return {
    score: totalScore,
    breakdown: {
      impact: Math.round(impactScore * 10) / 10,
      activity: Math.round(activityScore * 10) / 10,
      community: Math.round(communityScore * 10) / 10,
      consistency: Math.round(consistencyScore * 10) / 10,
      diversity: Math.round(diversityScore * 10) / 10,
      bonus,
    },
  };
};
