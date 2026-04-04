/**
 * GitHub API service – REST + GraphQL.
 * Fetches user profile, repositories, contribution streak, and heatmap grid.
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
 * Convert contribution calendar into a 7×7 grid (last 7 weeks × 7 days)
 * @param {object} calendar - from GitHub GraphQL
 * @returns {number[][]} grid[week][day] = contribution count
 */
export const getContributionGrid = (calendar) => {
  if (!calendar || !calendar.weeks) return Array(7).fill(Array(7).fill(0));
  
  const weeks = calendar.weeks.slice(-7); // last 7 weeks
  const grid = [];
  
  for (const week of weeks) {
    const weekData = week.contributionDays.map(day => day.contributionCount);
    while (weekData.length < 7) weekData.push(0);
    grid.push(weekData);
  }
  
  while (grid.length < 7) grid.unshift(Array(7).fill(0));
  
  return grid;
};

/**
 * Fetch contribution calendar and calculate streak + heatmap grid (GraphQL).
 * @param {string} username
 * @returns {Promise<{totalContributions: number, currentStreak: number, longestStreak: number, contributionGrid: number[][]}>}
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
      console.warn(`No contribution calendar for ${username}`);
      return {
        totalContributions: 0,
        currentStreak: 0,
        longestStreak: 0,
        contributionGrid: [],
      };
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

    const contributionGrid = getContributionGrid(calendar);

    return {
      totalContributions: calendar.totalContributions,
      currentStreak,
      longestStreak,
      contributionGrid,
    };
  } catch (err) {
    console.error('GraphQL error:', err.message);
    return {
      totalContributions: 0,
      currentStreak: 0,
      longestStreak: 0,
      contributionGrid: [],
    };
  }
};
