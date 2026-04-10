/**
 * Transforms raw GitHub data into structured developer metrics.
 */
import { daysSince, getAgeInYears } from '../utils/helpers.js';

/**
 * Analyse user profile and repositories.
 * @param {object} githubData - { user, repos }
 * @param {object} contributions - { totalContributions, currentStreak, longestStreak }
 * @returns {object} Aggregated metrics
 */
export const analyzeUser = ({ user, repos }, contributions) => {
  // Filter out forks and archived repos for activity metrics
  const sourceRepos = repos.filter(r => !r.fork && !r.archived);
  const allRepos = repos;

  // Stars, forks, watchers
  const totalStars = allRepos.reduce((sum, r) => sum + r.stargazers_count, 0);
  const totalForks = allRepos.reduce((sum, r) => sum + r.forks_count, 0);
  const totalWatchers = allRepos.reduce((sum, r) => sum + r.watchers_count, 0);

  // Language frequency (by repo count)
  const languageCount = {};
  allRepos.forEach(repo => {
    if (repo.language) {
      languageCount[repo.language] = (languageCount[repo.language] || 0) + 1;
    }
  });

  // Calculate percentages
  const totalLangRepos = Object.values(languageCount).reduce((a, b) => a + b, 0);
  const languages = Object.entries(languageCount)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / totalLangRepos) * 100),
      color: getLanguageColor(name),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Active repos (updated in last 90 days)
  const activeRepos = sourceRepos.filter(r => daysSince(r.updated_at) < 90);

  // Estimate PRs and issues (from repo counts – GitHub API doesn't provide totals easily)
  const openIssuesCount = allRepos.reduce((sum, r) => sum + r.open_issues_count, 0);

  return {
    profile: {
      username: user.login,
      name: user.name,
      bio: user.bio,
      avatarUrl: user.avatar_url,
      followers: user.followers,
      following: user.following,
      publicRepos: user.public_repos,
      publicGists: user.public_gists,
      accountAgeYears: getAgeInYears(user.created_at),
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      hireable: user.hireable || false,
      location: user.location,
      company: user.company,
      blog: user.blog,
    },
    stats: {
      totalStars,
      totalForks,
      totalWatchers,
      totalRepos: allRepos.length,
      sourceRepos: sourceRepos.length,
      activeRepos: activeRepos.length,
      totalContributions: contributions.totalContributions,
      currentStreak: contributions.currentStreak,
      longestStreak: contributions.longestStreak,
      openIssues: openIssuesCount,
      // These would require additional API calls; set to 0 for now
      pullRequests: 0,
      issuesOpened: 0,
    },
    languages,
    // Raw data for advanced visualizations
    _raw: { repos: allRepos },
  };
};

/**
 * Map language name to a representative color.
 */
function getLanguageColor(lang) {
  const colors = {
    JavaScript: '#f1e05a',
    TypeScript: '#3178c6',
    Python: '#3572A5',
    Java: '#b07219',
    Go: '#00ADD8',
    Rust: '#dea584',
    Ruby: '#701516',
    PHP: '#4F5D95',
    'C++': '#f34b7d',
    'C#': '#178600',
    Swift: '#F05138',
    Kotlin: '#A97BFF',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Shell: '#89e051',
  };
  return colors[lang] || '#8b8b8b';
}
