<!-- Improved Header with Animated Badges -->
<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:6EE7B7,100:3B82F6&height=200&section=header&text=GitHubAPI&fontSize=70&fontColor=ffffff&animation=fadeIn" width="100%"/>
  
*Smart GitHub Profile Analyzer & Scoring Engine*
  
[![Version](https://img.shields.io/badge/version-2.0.0-blue?style=for-the-badge&logo=github)](https://github.com/Shineii86/GitHubAPI)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen?style=for-the-badge&logo=vercel)](https://vercel.com)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=for-the-badge&logo=git)](https://github.com/Shineii86/GitHubAPI/pulls)
[![Deploy on Vercel](https://img.shields.io/badge/deploy-vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/new/clone?repository-url=https://github.com/Shineii86/GitHubAPI)
[![Open in GitHub Codespaces](https://img.shields.io/badge/Open%20in-Codespaces-181717?style=for-the-badge&logo=github)](https://github.com/codespaces/new?repo=Shineii86/GitHubAPI)

[![Live Preview](https://img.shields.io/badge/🚀_Live_API-Preview-FF6B6B?style=for-the-badge)](https://githubsmartapi.vercel.app/)
  
[![GitHub Stars](https://img.shields.io/github/stars/Shineii86/GitHubAPI?style=for-the-badge)](https://github.com/Shineii86/GitHubAPI/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/Shineii86/GitHubAPI?style=for-the-badge)](https://github.com/Shineii86/GitHubAPI/fork)
[![Issues](https://img.shields.io/github/issues/Shineii86/GitHubAPI?style=for-the-badge)](https://github.com/Shineii86/GitHubAPI/issues)
</div>

---

## 📖 Table of Contents

- [🧠 Overview](#-overview)
- [✨ Features](#-features)
- [🎥 Live API Preview](#-live-api-preview)
- [📊 Scoring System](#-scoring-system)
- [🚀 Quick Start](#-quick-start)
- [📡 API Documentation](#-api-documentation)
  - [Get User Analysis](#get-apiuserusername)
  - [Compare Users](#get-apicompareuser1user2)
  - [SVG Badge](#get-apibadgeusername)
  - [Profile Card](#get-apicardusername)
- [💻 Code Examples](#-code-examples)
- [🛠️ Tech Stack](#️-tech-stack)
- [🏗️ Architecture](#️-architecture)
- [⚙️ Configuration](#️-configuration)
- [☁️ Deployment](#️-deployment)
- [🤝 Contributing](#-contributing)
- [💳 Support](#-support--sponsorship)
- [📄 License](#-license)

---

## 🧠 Overview

**GitHubAPI** transforms raw GitHub data into actionable developer insights. It combines **REST + GraphQL** endpoints, calculates a weighted **developer score (0–100)**, assigns a **game‑style rank** (GODLIKE down to BEGINNER), tracks contribution streaks, analyzes languages, and optionally provides **AI‑powered summaries**.

Perfect for:
- 📈 Portfolio reviews & resume boosting
- 🧑‍💻 Candidate screening & technical recruiting
- 🏆 Developer leaderboards & gamification
- 🖼️ Dynamic GitHub README badges & profile cards

---

## ✨ Features

| Feature | Description | Emoji |
|---------|-------------|-------|
| **Advanced Scoring** | 8 metrics → 0–100 score + game rank (GODLIKE → BEGINNER) | 🧮 |
| **Contribution Streak** | Real current & longest streak from GraphQL calendar | 🔥 |
| **AI Summaries** | GPT‑4o mini strengths/weaknesses analysis (optional) | 🤖 |
| **Compare Users** | Side‑by‑side comparison of two developers | ⚖️ |
| **SVG Badge** | Embeddable badge with avatar, rank & level – **no animation** | 🖼️ |
| **Profile Card** | Beautiful animated SVG card (500×350) with **custom backgrounds**, theme overlays & Google Sans font | 🃏 |
| **Redis Caching** | 5‑minute cache to reduce API calls (optional) | 🗄️ |
| **Serverless Ready** | Deploy to Vercel in one click | 🌐 |
| **Interactive Web UI** | Built‑in frontend to test the API live | 🌍 |

---

## 🎥 Live API Preview

> **Try the API instantly without writing any code!**  
> 👉 [**Launch Interactive API Preview**](https://githubsmartapi.vercel.app)

The built‑in web UI (included in this repo at `/public/index.html`) lets you:
- Enter any GitHub username and see the full JSON response
- Compare two users side‑by‑side
- Toggle light/dark theme for the profile card
- Select custom backgrounds (1–6) for the card
- Copy cURL commands

---

## 📊 Scoring System

The developer score is calculated using 8 weighted metrics. Below is the scoring flow and the rank mapping:

```mermaid
flowchart TD
    A[Fetch GitHub User Data] --> B{REST + GraphQL}
    B --> C[Total Stars<br/>Weight: 25%]
    B --> D[Total Forks<br/>Weight: 15%]
    B --> E[Followers<br/>Weight: 15%]
    B --> F[Account Age<br/>Weight: 10%]
    B --> G[Public Repos<br/>Weight: 10%]
    B --> H[Language Diversity<br/>Weight: 10%]
    B --> I[Contribution Streak<br/>Weight: 10%]
    B --> J[Commit Frequency<br/>Weight: 5%]
    
    C & D & E & F & G & H & I & J --> K[Normalize each metric 0-100]
    K --> L[Apply weights & sum]
    L --> M[Final Score 0-100]
    M --> N{Rank Mapping}
    N --> O[100: GODLIKE]
    N --> P[90-99: MYTHIC]
    N --> Q[80-89: LEGEND]
    N --> R[70-79: GRANDMASTER]
    N --> S[60-69: MASTER]
    N --> T[50-59: ELITE]
    N --> U[40-49: EXPERT]
    N --> V[30-39: DEVELOPER]
    N --> W[20-29: APPRENTICE]
    N --> X[10-19: NOVICE]
    N --> Y[0-9: BEGINNER]
```

### Rank Details Table

| Score Range | Rank Name | Level Display |
|-------------|-----------|----------------|
| 100 | GODLIKE | LV100 |
| 90–99 | MYTHIC | LV90–99 |
| 80–89 | LEGEND | LV80–89 |
| 70–79 | GRANDMASTER | LV70–79 |
| 60–69 | MASTER | LV60–69 |
| 50–59 | ELITE | LV50–59 |
| 40–49 | EXPERT | LV40–49 |
| 30–39 | DEVELOPER | LV30–39 |
| 20–29 | APPRENTICE | LV20–29 |
| 10–19 | NOVICE | LV10–19 |
| 0–9 | BEGINNER | LV0–9 |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+  
- GitHub [Personal Access Token](https://github.com/settings/tokens) (classic) with `repo` and `user` scopes  
- (Optional) Redis server / Upstash account  
- (Optional) OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/Shineii86/GitHubAPI.git
cd GitHubAPI

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your tokens
nano .env

# Start development server
npm run dev
```

The API will run at `http://localhost:3000` and the frontend will be served at the same address.

---

## 📡 API Documentation

All endpoints return JSON unless specified otherwise.

### `GET /api/user/:username`

Returns complete profile analysis with score, rank, stats, and optional AI summary.

**Path parameter:**  
- `username` – GitHub username (e.g., `octocat`)

**Example request:**
```bash
curl https://githubsmartapi.vercel.app/api/user/octocat
```

**Example response:**
```json
{
  "username": "octocat",
  "score": 68,
  "rank": "MASTER",
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
  "aiSummary": "Moderate activity with room for growth. Good language diversity.",
  "fetchedAt": "2026-04-05T12:00:00.000Z",
  "cached": false
}
```

### `GET /api/compare/:user1/:user2`

Returns side‑by‑side comparison of two users.

**Example:**
```bash
curl https://githubsmartapi.vercel.app/api/compare/octocat/gaearon
```

### `GET /api/badge/:username`

Returns an SVG badge with **profile photo, username, rank and level** (e.g., `MYTHIC • LV90`).  
**Animation has been removed** – the badge renders instantly.

| Query param | Values | Default | Description |
|-------------|--------|---------|-------------|
| `theme` | `dark`, `light` | `dark` | Colour scheme (light = grey background, dark = dark background) |

> ⚠️ The `animated` parameter is **no longer supported** – the badge appears immediately.

**Example usage in Markdown:**
```markdown
![GitHubAPI Badge](https://githubsmartapi.vercel.app/api/badge/octocat?theme=light)
```

### `GET /api/card/:username`

Returns a **large animated SVG profile card** (500×350) with avatar, stats, rank, score, and **custom background support**.

| Query param | Values | Default | Description |
|-------------|--------|---------|-------------|
| `theme` | `dark`, `light` | `dark` | Colour scheme for text & overlay |
| `bgImage` | `1`, `2`, `3`, … | (none) | Use one of the pre‑configured custom backgrounds (up to 6 images) |
| `animated` | `true`, `false` | `false` | Fade‑in + scale animation for the whole card |

> 💡 **Custom backgrounds** are automatically overlaid with a semi‑transparent color (white for light theme, black for dark theme) to keep text readable. No extra parameters needed – the overlay adapts to your `theme`.

**Example usage in Markdown:**
```markdown
<!-- Default gradient card (dark theme, animated) -->
![Profile Card](https://githubsmartapi.vercel.app/api/card/octocat?theme=dark&animated=true)

<!-- Custom background #3 with light theme -->
![Profile Card](https://githubsmartapi.vercel.app/api/card/octocat?bgImage=3&theme=light)
```

---

## 💻 Code Examples

### JavaScript (fetch)

```javascript
async function getUserAnalysis(username) {
  const response = await fetch(`https://githubsmartapi.vercel.app/api/user/${username}`);
  const data = await response.json();
  console.log(`${data.username} has score ${data.score} (rank ${data.rank})`);
}
getUserAnalysis('octocat');
```

### Python

```python
import requests

def get_github_score(username):
    url = f"https://githubsmartapi.vercel.app/api/user/{username}"
    response = requests.get(url)
    data = response.json()
    print(f"{data['username']}: {data['score']} points - Rank {data['rank']}")

get_github_score('octocat')
```

### cURL with jq

```bash
curl -s https://githubsmartapi.vercel.app/api/user/octocat | jq '.score, .rank'
```

---

## 🛠️ Tech Stack

| Category       | Technology | Badge |
|----------------|------------|-------|
| Runtime        | Node.js 18+ | ![Node.js](https://img.shields.io/badge/Node.js-18.x-339933?logo=nodedotjs) |
| Framework      | Express.js | ![Express](https://img.shields.io/badge/Express.js-4.x-000000?logo=express) |
| API Clients    | Axios + GraphQL | ![Axios](https://img.shields.io/badge/Axios-1.x-5A29E4?logo=axios) |
| AI Integration | OpenAI (GPT‑4o mini) | ![OpenAI](https://img.shields.io/badge/OpenAI-GPT4o-412991?logo=openai) |
| Caching        | Redis (ioredis) | ![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D?logo=redis) |
| Fonts          | Google Sans | ![Google Sans](https://img.shields.io/badge/Font-Google_Sans-4285F4?logo=googlefonts) |
| Deployment     | Vercel / Docker | ![Vercel](https://img.shields.io/badge/Vercel-Serverless-000000?logo=vercel) |

---

## 🏗️ Architecture

```mermaid
graph LR
    Client[Client<br/>Browser/App] -->|HTTP Request| Gateway[API Gateway<br/>Express.js]
    Gateway -->|Route| Controller[User Controller]
    Controller -->|Check| Cache[Redis Cache]
    Cache -->|Miss| GH[GitHub Service]
    GH -->|REST + GraphQL| GitHubAPI[GitHub API]
    GH -->|Raw Data| Scoring[Scoring Engine]
    Scoring -->|Score & Rank| AI[AI Service<br/>Optional]
    AI -->|Summary| Controller
    Controller -->|JSON Response| Client
    Controller -->|SVG| Badge[Badge Generator<br/>No Animation]
    Controller -->|SVG| Card[Profile Card<br/>Custom Backgrounds]
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

## ☁️ Deployment

### Deploy to Vercel (one click)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Shineii86/GitHubAPI)

### Deploy with Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "src/app.js"]
```

```bash
docker build -t githubapi .
docker run -p 3000:3000 --env-file .env githubapi
```

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

1. **Fork** the repo
2. Create a **feature branch**: `git checkout -b feat/amazing-feature`
3. **Commit** changes: `git commit -m 'Add amazing feature'`
4. **Push** to branch: `git push origin feat/amazing-feature`
5. Open a **Pull Request**

---

## 💳 Support & Sponsorship

If you find this project useful, consider supporting it. Your contribution helps maintain servers, add new features, and keep the API free.

**GitHub Sponsors** | [Sponsor on GitHub](https://github.com/sponsors/Shineii86)

> Your support is greatly appreciated!

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 💕 Loved My Work?

🚨 [Follow me on GitHub](https://github.com/Shineii86)

⭐ [Give a star to this project](https://github.com/Shineii86/GitHubAPI)

<div align="center">

<a href="https://github.com/Shineii86/GitHubAPI">
<img src="https://github.com/Shineii86/AniPay/blob/main/Source/Banner6.png" alt="Banner" width="600">
</a>
  
  *For inquiries or collaborations*
     
[![Telegram Badge](https://img.shields.io/badge/-Telegram-2CA5E0?style=flat&logo=Telegram&logoColor=white)](https://telegram.me/Shineii86 "Contact on Telegram")
[![Instagram Badge](https://img.shields.io/badge/-Instagram-C13584?style=flat&logo=Instagram&logoColor=white)](https://instagram.com/ikx7.a "Follow on Instagram")
[![Pinterest Badge](https://img.shields.io/badge/-Pinterest-E60023?style=flat&logo=Pinterest&logoColor=white)](https://pinterest.com/ikx7a "Follow on Pinterest")
[![Gmail Badge](https://img.shields.io/badge/-Gmail-D14836?style=flat&logo=Gmail&logoColor=white)](mailto:ikx7a@hotmail.com "Send an Email")

  <sup><b>Copyright © 2026 <a href="https://telegram.me/Shineii86">Shinei Nouzen</a> All Rights Reserved</b></sup>

![Last Commit](https://img.shields.io/github/last-commit/Shineii86/GitHubAPI?style=for-the-badge)

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:6EE7B9,100:3B82F6&height=100&section=footer" width="100%"/>
  
</div>
