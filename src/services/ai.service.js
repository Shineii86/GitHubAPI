/**
 * OpenAI integration for generating natural‑language insights.
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
 * @param {object} scoreData - { score, breakdown }
 * @returns {Promise<string>}
 */
export const generateAISummary = async (analysis, scoreData) => {
  if (!openai) {
    return 'AI summary not available (OpenAI API key not configured).';
  }

  const { profile, stats, languages } = analysis;
  const topLangs = languages.slice(0, 3).map(l => l.name).join(', ');

  const prompt = `You are a friendly GitHub profile analyst. Summarize this developer in 2-3 sentences:

- Username: ${profile.username}
- Score: ${scoreData.score}/100
- Stars: ${stats.totalStars}
- Forks: ${stats.totalForks}
- Followers: ${profile.followers}
- Repositories: ${stats.totalRepos} (${stats.activeRepos} active)
- Total contributions: ${stats.totalContributions}
- Current streak: ${stats.currentStreak} days
- Longest streak: ${stats.longestStreak} days
- Top languages: ${topLangs || 'none'}
- Account age: ${profile.accountAgeYears} years

Be concise and encouraging. Mention one strength and one area for growth if applicable.`;

  try {
    const response = await openai.chat.completions.create({
      model: config.openAiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.7,
    });
    return response.choices[0].message.content.trim();
  } catch (err) {
    console.error('OpenAI error:', err.message);
    return 'AI summary temporarily unavailable.';
  }
};
