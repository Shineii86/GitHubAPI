/**
 * Analysis Service v3.0
 * Deeper insights and trend analysis
 */
import { daysSince } from '../utils/helpers.js';

export const analyzeUser = ({ user, repos, meta }, contributions) => {
  // Language frequency with percentages
  const languages = {};
  const languageBytes = {};
  
  repos.forEach((repo) => {
    if (repo.language) {
      languages[repo.language] = (languages[repo.language] || 0) + 1;
      languageBytes[repo.language] = (languageBytes[repo.language] || 0) + (repo.size || 0);
    }
  });

  // Calculate language percentages
  const totalRepos = repos.length;
  const languageStats = Object.entries(languages)
    .map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / totalRepos) * 100),
      bytes: languageBytes[name]
    }))
    .sort((a, b) => b.count - a.count);

  // Activity analysis (last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const activeRepos = repos.filter((r) => {
    const updated = new Date(r.updated_at);
    return updated > ninetyDaysAgo;
  });

  const recentlyCreated = repos.filter((r) => {
    const created = new Date(r.created_at);
    return created > ninetyDaysAgo;
  }).length;

  // Repository metrics
  const repoMetrics = {
    total: repos.length,
    public: repos.filter(r => !r.private).length,
    forks: repos.filter(r => r.fork).length,
    archived: repos.filter(r => r.archived).length,
    templates: repos.filter(r => r.is_template).length,
    averageSize: repos.length > 0 
      ? Math.round(repos.reduce((acc, r) => acc + (r.size || 0), 0) / repos.length) 
      : 0,
    totalSize: repos.reduce((acc, r) => acc + (r.size || 0), 0),
    withIssues: repos.filter(r => r.has_issues).length,
    withWiki: repos.filter(r => r.has_wiki).length,
    withPages: repos.filter(r => r.has_pages).length
  };

  // Engagement metrics
  const engagement = {
    totalStars: repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0),
    totalForks: meta?.aggregated?.totalForks || 0,
    totalWatchers: meta?.aggregated?.totalWatchers || 0,
    totalOpenIssues: meta?.aggregated?.totalOpenIssues || 0
  };

  // Account age
  const accountAgeDays = daysSince(user.created_at);
  const accountAgeYears = Math.floor(accountAgeDays / 365);

  return {
    profile: {
      username: user.login,
      name: user.name,
      bio: user.bio,
      company: user.company,
      location: user.location,
      blog: user.blog,
      twitter: user.twitter_username,
      followers: user.followers,
      following: user.following,
      publicRepos: user.public_repos,
      publicGists: user.public_gists,
      avatarUrl: user.avatar_url,
      profileUrl: user.html_url,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      accountAgeYears,
      accountAgeDays,
      isHireable: user.hireable
    },
    stats: {
      ...engagement,
      totalRepos: repoMetrics.total,
      activeRepos: activeRepos.length,
      recentlyCreated,
      repoMetrics,
      contributionStats: contributions,
      activityRatio: repoMetrics.total > 0 ? (activeRepos.length / repoMetrics.total) : 0
    },
    languages: languageStats,
    topLanguage: languageStats[0]?.name || 'Unknown',
    meta: {
      fetchedAt: new Date().toISOString(),
      hasMoreRepos: meta?.hasMore || false,
      totalReposAnalyzed: meta?.totalFetched || repos.length
    }
  };
};
