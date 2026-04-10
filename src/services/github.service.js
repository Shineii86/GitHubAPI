/**
 * GitHub API service – REST + GraphQL.
 */
import axios from 'axios';
import { config } from '../config/env.js';

const restClient = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Authorization: `Bearer ${config.githubToken}`,
    Accept: 'application/vnd.github.v3+json',
  },
  timeout: config.githubApiTimeout,
});

const graphqlClient = axios.create({
  baseURL: 'https://api.github.com/graphql',
  headers: {
    Authorization: `Bearer ${config.githubToken}`,
    'Content-Type': 'application/json',
  },
  timeout: config.githubApiTimeout,
});

/**
 * Fetch user profile and repositories.
 * @param {string} username
 * @returns {Promise<{ user: object, repos: object[] }>}
 */
export const fetchGitHubData = async (username) => {
  try {
    const [userRes, reposRes] = await Promise.all([
      restClient.get(`/users/${username}`),
      restClient.get(`/users/${username}/repos`, {
        params: { per_page: 100, sort: 'updated' },
      }),
    ]);
    return { user: userRes.data, repos: reposRes.data };
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error(`GitHub user '${username}' not found`);
    }
    if (err.response?.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Please try again later.');
    }
    throw new Error(`GitHub API error: ${err.message}`);
  }
};

/**
 * Fetch contribution data via GraphQL (streaks, total contributions).
 * Falls back to estimated values if GraphQL fails.
 * @param {string} username
 * @returns {Promise<{ totalContributions: number, currentStreak: number, longestStreak: number }>}
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
                contributionCount
                date
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await graphqlClient.post('', { query, variables: { username } });
    const calendar = response.data?.data?.user?.contributionsCollection?.contributionCalendar;

    if (!calendar) {
      throw new Error('No contribution data');
    }

    // Flatten all days in chronological order (oldest first)
    const days = calendar.weeks
      .flatMap(w => w.contributionDays)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    // Process from most recent to oldest
    for (let i = days.length - 1; i >= 0; i--) {
      const day = days[i];
      if (day.contributionCount > 0) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        if (currentStreak === 0) currentStreak = tempStreak;
        tempStreak = 0;
      }
    }
    if (currentStreak === 0) currentStreak = tempStreak;

    return {
      totalContributions: calendar.totalContributions,
      currentStreak,
      longestStreak,
    };
  } catch (err) {
    console.warn(`[GitHub] GraphQL failed for ${username}: ${err.message}`);
    // Fallback: return zero values
    return {
      totalContributions: 0,
      currentStreak: 0,
      longestStreak: 0,
    };
  }
};
