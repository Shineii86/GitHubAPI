/**
 * OpenAI integration for generating natural‑language insights.
 * If no API key is provided, returns a placeholder message.
 */
import OpenAI from 'openai';
import { config } from '../config/env.js';

let openai = null;
if (config.openAiKey) {
  openai = new OpenAI({ apiKey: config.openAiKey });
  console.log('✅ OpenAI service enabled');
} else {
  console.log('ℹ️ OpenAI API key missing – AI summaries disabled');
}

/**
 * Generate a short AI summary of the developer's profile.
 * @param {object} analysis - Output from analyzeUser()
 * @param {object} scoreData - { score, rank }
 * @returns {Promise<string>}
 */
export const generateAISummary = async (analysis, scoreData) => {
  if (!openai) {
    return 'AI summary not available (OpenAI API key not configured).';
  }

  const languagesList = Object.keys(analysis.languages).join(', ') || 'none';

  const prompt = `
    You are a GitHub developer analyst. Evaluate the following profile:
    - Score: ${scoreData.score}/100 (Rank ${scoreData.rank})
    - Stars: ${analysis.stats.totalStars}
    - Repos: ${analysis.stats.totalRepos}
    - Active repos (last 90d): ${analysis.stats.activeRepos}
    - Followers: ${analysis.profile.followers}
    - Languages: ${languagesList}
    - Total contributions: ${analysis.stats.totalContributions}
    - Current streak: ${analysis.stats.currentStreak} days
    - Longest streak: ${analysis.stats.longestStreak} days

    Write one short paragraph (max 100 words) covering strengths, weaknesses, and overall summary. Be constructive.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 250,
      temperature: 0.7,
    });
    return response.choices[0].message.content;
  } catch (err) {
    console.error('OpenAI error:', err.message);
    return 'AI summary temporarily unavailable.';
  }
};
