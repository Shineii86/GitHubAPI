/**
 * GitHub API Service v3.0
 * Enhanced with pagination, rate limit handling, and resilience
 */
import axios from 'axios';
import { config } from '../config/env.js';

// Axios instances with defaults
const githubRest = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Authorization: `Bearer ${config.githubToken}`,
    Accept: 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28'
  },
  timeout: 10000
});

const githubGraphQL = axios.create({
  baseURL: 'https://api.github.com/graphql',
  headers: {
    Authorization: `Bearer ${config.githubToken}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000
});

// Rate limit tracking
let rateLimitRemaining = 5000;
let rateLimitReset = Date.now();

githubRest.interceptors.response.use(
  (response) => {
    rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining'] || rateLimitRemaining);
    rateLimitReset = parseInt(response.headers['x-ratelimit-reset'] || rateLimitReset) * 1000;
    return response;
  },
  (error) => {
    if (error.response?.status === 403 && error.response?.data?.message?.includes('rate limit')) {
      const resetTime = new Date(rateLimitReset).toLocaleTimeString();
      console.error(`⛔ Rate limit hit. Resets at ${resetTime}`);
    }
    return Promise.reject(error);
  }
);

/**
 * Fetch all repos with pagination (up to 1000 repos)
 */
export const fetchGitHubData = async (username) => {
  try {
    // Fetch user profile
    const userRes = await githubRest.get(`/users/${username}`);
    
    // Fetch repos with pagination (handle power users)
    let allRepos = [];
    let page = 1;
    const perPage = 100;
    let hasMore = true;

    while (hasMore && page <= 10) { // Max 1000 repos for performance
      const reposRes = await githubRest.get(
        `/users/${username}/repos?per_page=${perPage}&page=${page}&sort=updated&direction=desc`
      );
      
      allRepos = allRepos.concat(reposRes.data);
      hasMore = reposRes.data.length === perPage;
      page++;
    }

    // Calculate aggregated stats
    const totalForks = allRepos.reduce((sum, r) => sum + (r.forks_count || 0), 0);
    const totalWatchers = allRepos.reduce((sum, r) => sum + (r.watchers_count || 0), 0);
    const totalOpenIssues = allRepos.reduce((sum, r) => sum + (r.open_issues_count || 0), 0);

    return { 
      user: userRes.data, 
      repos: allRepos,
      meta: {
        totalFetched: allRepos.length,
        hasMore: hasMore,
        aggregated: { totalForks, totalWatchers, totalOpenIssues }
      }
    };
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error('USER_NOT_FOUND');
    }
    if (err.response?.status === 403) {
      throw new Error('RATE_LIMITED');
    }
    throw new Error(`GITHUB_API_ERROR: ${err.message}`);
  }
};

/**
 * Enhanced contributions with better error handling
 */
export const fetchContributions = async (username) => {
  const query = `
    query($username: String!) {
      user(login: $username) {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                color
              }
            }
          }
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
          totalRepositoryContributions
        }
      }
    }
  `;

  try {
    const response = await githubGraphQL.post('', { query, variables: { username } });
    
    if (response.data?.errors) {
      console.warn('GraphQL Errors:', response.data.errors);
      throw new Error('GRAPHQL_ERROR');
    }

    const collection = response.data?.data?.user?.contributionsCollection;
    if (!collection) {
      return getDefaultContributions();
    }

    const calendar = collection.contributionCalendar;
    const days = calendar.weeks.flatMap((w) => w.contributionDays);
    
    // Calculate streaks with better logic
    const { currentStreak, longestStreak } = calculateStreaks(days);
    
    // Calculate weekly averages
    const activeDays = days.filter(d => d.contributionCount > 0).length;
    const averagePerDay = calendar.totalContributions / 365;

    return {
      totalContributions: calendar.totalContributions,
      currentStreak,
      longestStreak,
      activeDays,
      averagePerDay: Math.round(averagePerDay * 10) / 10,
      pullRequests: collection.totalPullRequestContributions || 0,
      issues: collection.totalIssueContributions || 0,
      reposContributedTo: collection.totalRepositoryContributions || 0,
      commitContributions: collection.totalCommitContributions || 0
    };
  } catch (err) {
    console.error('Contributions fetch failed:', err.message);
    return getDefaultContributions();
  }
};

function calculateStreaks(days) {
  // Sort by date descending
  const sortedDays = [...days].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let checkedToday = false;

  for (const day of sortedDays) {
    const isToday = day.date === new Date().toISOString().split('T')[0];
    
    if (day.contributionCount > 0) {
      tempStreak++;
      if (!checkedToday || !isToday) {
        if (currentStreak === 0 && !checkedToday) {
          currentStreak = tempStreak;
        }
      }
    } else {
      if (!checkedToday && isToday) {
        // Today has no contributions yet, don't break streak
        checkedToday = true;
        continue;
      }
      currentStreak = currentStreak || tempStreak;
      tempStreak = 0;
    }
    
    longestStreak = Math.max(longestStreak, tempStreak);
  }
  
  longestStreak = Math.max(longestStreak, tempStreak);
  if (currentStreak === 0) currentStreak = tempStreak;

  return { currentStreak, longestStreak };
}

function getDefaultContributions() {
  return {
    totalContributions: 0,
    currentStreak: 0,
    longestStreak: 0,
    activeDays: 0,
    averagePerDay: 0,
    pullRequests: 0,
    issues: 0,
    reposContributedTo: 0,
    commitContributions: 0
  };
}
