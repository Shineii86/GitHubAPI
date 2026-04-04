/**
 * GitHub API service – REST + GraphQL.
 * Fetches user profile, repositories, and contribution streak.
 */
import axios from 'axios';
import { config } from '../config/env.js';

// REST API headers
const restHeaders = {
  Authorization: `Bearer ${config.githubToken}`,
  Accept: 'application/vnd.github.v3+json',
};

// GraphQL API headers
const graphqlHeaders = {
  Authorization: `Bearer ${config.githubToken}`,
  'Content-Type': 'application/json',
};

/**
 * Fetch user profile and repositories (REST).
 * @param {string} username - GitHub username
 * @returns {Promise<{user: object, repos: array}>}
 */
export const fetchGitHubData = async (username) => {
  const [userRes, reposRes] = await Promise.all([
    axios.get(`https://api.github.com/users/${username}`, { headers: restHeaders }),
    axios.get(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, {
      headers: restHeaders,
    }),
  ]);
  return { user: userRes.data, repos: reposRes.data };
};

/**
 * Fetch contribution calendar and calculate streak (GraphQL).
 * @param {string} username
 * @returns {Promise<{totalContributions: number, currentStreak: number, longestStreak: number}>}
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
    const response = await axios.post(
      'https://api.github.com/graphql',
      { query, variables: { username } },
      { headers: graphqlHeaders }
    );

    const calendar = response.data?.data?.user?.contributionsCollection?.contributionCalendar;
    if (!calendar) {
      return { totalContributions: 0, currentStreak: 0, longestStreak: 0 };
    }

    // Flatten all contribution days (most recent first)
    const days = calendar.weeks.flatMap((w) => w.contributionDays).reverse();

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    for (const day of days) {
      if (day.contributionCount > 0) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        // When we hit the first zero, that's the end of the current streak
        if (currentStreak === 0) currentStreak = tempStreak;
        tempStreak = 0;
      }
    }
    // If the user has contributed every day (no zero), currentStreak equals tempStreak
    if (currentStreak === 0) currentStreak = tempStreak;

    return {
      totalContributions: calendar.totalContributions,
      currentStreak,
      longestStreak,
    };
  } catch (err) {
    console.error('GraphQL error:', err.message);
    // Fallback to empty contributions
    return { totalContributions: 0, currentStreak: 0, longestStreak: 0 };
  }
};
