# 🔍 GitHubAPI  
### *Smart GitHub Profile Analyzer & Scoring Engine*

Analyze any GitHub user – get a **developer score (0–100)**, **rank (D to SSS)**, contribution streaks, language insights, and optional **AI‑powered summaries**. Built for recruiters, open‑source maintainers, and developers who love metrics.

---

## 📊 Badges

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)
![Stars](https://img.shields.io/github/stars/Shineii86/GitHubAPI?style=social)
![Forks](https://img.shields.io/github/forks/Shineii86/GitHubAPI?style=social)
![Issues](https://img.shields.io/github/issues/Shineii86/GitHubAPI)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)
![Deploy on Vercel](https://img.shields.io/badge/deploy-vercel-black)

---

## 🧠 Overview

**GitHubAPI** transforms raw GitHub data into actionable insights.  
It combines **REST + GraphQL** endpoints, calculates a weighted **developer score**, and provides **AI‑generated feedback** (optional). Perfect for:

- 📈 Portfolio reviews  
- 🧑‍💻 Candidate screening  
- 🏆 Developer leaderboards  
- 🖼️ Dynamic GitHub README badges

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🧮 **Advanced Scoring** | 8 metrics (stars, repos, activity, languages, followers, age, contributions, streak) → 0–100 score + rank (D–SSS) |
| 🔥 **Contribution Streak** | Real current & longest streak from GraphQL calendar |
| 🤖 **AI Summaries** | GPT‑4o mini strengths/weaknesses analysis (optional) |
| ⚖️ **Compare Users** | Side‑by‑side comparison of two developers |
| 🖼️ **SVG Badge** | Embeddable badge for GitHub profiles / READMEs |
| 🗄️ **Redis Caching** | 5‑minute cache to reduce API calls (optional) |
| 🌐 **Serverless Ready** | Deploy to Vercel in one click |

---

## 🎥 Demo / Preview

**Live API endpoint:**  
`https://githubapi.vercel.app/api/user/octocat`

**Example badge:**  
![octocat badge](https://img.shields.io/badge/dynamic/json?label=octocat&query=rank&url=https%3A%2F%2Fgithubapi.vercel.app%2Fapi%2Fuser%2Foctocat&color=ffcc00)  

---

## 📸 Screenshots

| API Response | Badge Embed |
|--------------|-------------|
| ![API screenshot](https://via.placeholder.com/400x200?text=API+JSON+Response) | ![Badge example](https://via.placeholder.com/280x40?text=octocat+S+85) |

---

## 🧰 Tech Stack

| Category       | Technology |
|----------------|------------|
| Runtime        | Node.js (ES Modules) |
| Framework      | Express.js |
| API Clients    | Axios (REST) + GraphQL |
| AI Integration | OpenAI (GPT‑4o mini) |
| Caching        | Redis (ioredis) |
| Deployment     | Vercel (serverless) / Any Node.js host |
| Language       | JavaScript |

---

## 📦 Installation

### Prerequisites

- Node.js 18+  
- GitHub [Personal Access Token](https://github.com/settings/tokens) (classic) with `repo` and `user` scopes  
- (Optional) Redis server / Upstash account  
- (Optional) OpenAI API key

### Steps

```bash
# Clone the repository
git clone https://github.com/Shineii86/GitHubAPI.git
cd GitHubAPI

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your tokens
nano .env   # or use your editor

# Start development server
npm run dev
```

The API will run at `http://localhost:3000`.

---

## 🚀 Usage

### Local development

```bash
npm start         # production mode
npm run dev       # watch mode (auto‑restart)
```

### Example requests

```bash
# Get full analysis for a user
curl http://localhost:3000/api/user/octocat

# Compare two users
curl http://localhost:3000/api/compare/octocat/gaearon

# Get SVG badge
curl http://localhost:3000/api/badge/octocat --output badge.svg
```

---

## 📡 API Documentation

### `GET /api/user/:username`

Returns complete profile analysis.

**Path parameter:**  
- `username` – GitHub username

**Response example:**

```json
{
  "username": "octocat",
  "score": 68,
  "rank": "B",
  "profile": {
    "followers": 5,
    "publicRepos": 8,
    "accountAgeYears": 12
  },
  "stats": {
    "totalStars": 12,
    "totalRepos": 8,
    "activeRepos": 3,
    "totalContributions": 243,
    "currentStreak": 2,
    "longestStreak": 7
  },
  "topLanguages": {
    "JavaScript": 4,
    "Ruby": 1
  },
  "aiSummary": "Moderate activity...",
  "fetchedAt": "2026-04-04T12:00:00.000Z",
  "cached": false
}
```

### `GET /api/compare/:user1/:user2`

Returns side‑by‑side comparison of two users.

**Response structure:**  
```json
{
  "user1": { "username": "...", ...metrics },
  "user2": { "username": "...", ...metrics }
}
```

### `GET /api/badge/:username`

Returns an SVG badge with username, rank, and score.  
**Content‑Type:** `image/svg+xml`

**Embed in GitHub Markdown:**

```markdown
![GitHubAPI score](https://your-deployment.vercel.app/api/badge/octocat)
```

---

## 📁 Project Structure

```
GitHubAPI/
├── api/
│   └── index.js               # Vercel serverless entry
├── src/
│   ├── app.js                 # Express app (local + export)
│   ├── config/
│   │   └── env.js             # Environment variables
│   ├── controllers/
│   │   └── user.controller.js
│   ├── routes/
│   │   └── user.routes.js
│   ├── services/
│   │   ├── ai.service.js
│   │   ├── analysis.service.js
│   │   ├── cache.service.js
│   │   ├── github.service.js
│   │   └── scoring.service.js
│   └── utils/
│       └── helpers.js
├── .env.example
├── .gitignore
├── package.json
├── vercel.json
└── README.md
```

---

## ⚙️ Configuration

### `.env.example`

```ini
# Server
PORT=3000

# GitHub (required)
GITHUB_TOKEN=your_github_personal_access_token

# OpenAI (optional – removes AI summary if missing)
OPENAI_API_KEY=your_openai_api_key

# Redis (optional – caching disabled if missing)
REDIS_URL=redis://localhost:6379
```

---

## ☁️ Deployment Guide

### Deploy to Vercel (recommended)

1. Push your code to a GitHub repository.
2. Go to [Vercel](https://vercel.com) → **Import Project**.
3. Select the repository.
4. Add environment variables (same as `.env`).
5. Click **Deploy** – done.

Your API will be available at `https://your-app.vercel.app`.

### Deploy with Docker (self‑hosted)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/app.js"]
```

Build and run:

```bash
docker build -t githubapi .
docker run -p 3000:3000 --env-file .env githubapi
```

---

## 🤝 Contributing

Contributions are welcome!  
Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).

1. **Fork** the repository.
2. Create a **feature branch**: `git checkout -b feat/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feat/amazing-feature`
5. Open a **Pull Request**.

See the [open issues](https://github.com/Shineii86/GitHubAPI/issues) for ideas.

---

## 🗺️ Roadmap

- [ ] GraphQL contribution **heatmap** endpoint
- [ ] **Leaderboard** API (global / by language)
- [ ] **Webhook** support for profile change events
- [ ] GitHub Action for automated scoring
- [ ] **Documentation website** (Next.js + OpenAPI)

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 👤 Author

**Shinei Nouzen** – [@Shineii86](https://github.com/Shineii86)

---

## 🙏 Acknowledgements

- [GitHub REST API](https://docs.github.com/en/rest)
- [GitHub GraphQL API](https://docs.github.com/en/graphql)
- [OpenAI](https://openai.com)
- [Vercel](https://vercel.com)
- [ioredis](https://github.com/luin/ioredis)
- [Express.js](https://expressjs.com)

---

## 📬 Support / Contact

- **Issues:** [GitHub Issues](https://github.com/Shineii86/GitHubAPI/issues)

---

## ⭐ Star the Repo

If this project helped you, please **star** the repository on GitHub.  
It motivates us to build more features!

[![Star on GitHub](https://img.shields.io/github/stars/Shineii86/GitHubAPI?style=social)](https://github.com/Shineii86/GitHubAPI)

---

*Built with ❤️ for the open‑source community.*
