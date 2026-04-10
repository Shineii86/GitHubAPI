/**
 * GitHub API service – REST + GraphQL (minimal for scoring)
 */
import axios from 'axios';
import { config } from '../config/env.js';

const restHeaders = {
  Authorization: `Bearer ${config.githubToken}`,
  Accept: 'application/vnd.github.v3+json',
};

const graphqlHeaders = {
  Authorization: `Bearer ${config.githubToken}`,
  'Content-Type': 'application/json',
};

export const fetchGitHubData = async (username) => {
  const [userRes, reposRes] = await Promise.all([
    axios.get(`https://api.github.com/users/${username}`, { headers: restHeaders }),
    axios.get(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, {
      headers: restHeaders,
    }),
  ]);
  return { user: userRes.data, repos: reposRes.data };
};

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

    // Calculate streak
    const days = calendar.weeks.flatMap((w) => w.contributionDays).reverse();
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    for (const day of days) {
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
    console.error('GraphQL error:', err.message);
    return { totalContributions: 0, currentStreak: 0, longestStreak: 0 };
  }
};
