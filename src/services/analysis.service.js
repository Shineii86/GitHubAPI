/**
 * Transforms raw GitHub data into structured developer metrics.
 */
import { daysSince } from '../utils/helpers.js';

/**
 * Analyse user profile and repositories.
 * @param {object} githubData - { user, repos }
 * @param {object} contributions - { totalContributions, currentStreak, longestStreak }
 * @returns {object} - Aggregated metrics (profile, stats, languages)
 */
export const analyzeUser = ({ user, repos }, contributions) => {
  // Total stars across all repos
  const totalStars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);

  // Language frequency (top languages by repo count)
  const languages = {};
  repos.forEach((repo) => {
    if (repo.language) {
      languages[repo.language] = (languages[repo.language] || 0) + 1;
    }
  });

  // Repos updated in the last 90 days
  const activeRepos = repos.filter((r) => daysSince(r.updated_at) < 90);

  return {
    profile: {
      followers: user.followers,
      publicRepos: user.public_repos,
      accountAgeYears: Math.floor(daysSince(user.created_at) / 365),
    },
    stats: {
      totalStars,
      totalRepos: repos.length,
      activeRepos: activeRepos.length,
      totalContributions: contributions.totalContributions,
      currentStreak: contributions.currentStreak,
      longestStreak: contributions.longestStreak,
    },
    languages,
  };
};
