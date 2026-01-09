# FinSight

A professional financial modeling and stress testing platform built with React, Supabase, and Vercel Serverless Functions.

![FinSight](https://img.shields.io/badge/FinSight-v2.0.0-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e)
![Vercel](https://img.shields.io/badge/Vercel-Serverless-black)

## Features

- 📊 **Financial Modeling**: Build comprehensive financial projections with customizable parameters
- 📈 **Stress Testing**: Run scenario analysis across multiple stress cases
- 🤖 **AI-Powered Analysis**: Get intelligent insights with DeepSeek AI integration
- 💳 **Credit Dashboard**: Monitor debt coverage, leverage, and covenant compliance
- 📑 **Report Generation**: Export professional PDF reports for stakeholders
- 🔐 **Secure Authentication**: Supabase Auth with email, Google, and GitHub OAuth
- 💾 **Cloud Storage**: Save and manage multiple financial models

## Tech Stack

- **Frontend**: React 18 (Create React App), TailwindCSS, Recharts
- **Backend**: Vercel Serverless Functions (`/api/*.js`)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI**: DeepSeek API
- **PDF Generation**: jsPDF, html2canvas

## Project Structure

```
finsight/
├── api/                        # Vercel Serverless Functions
│   ├── _cors.js                # Shared CORS utility
│   ├── ai/
│   │   ├── analyze.js          # POST /api/ai/analyze - AI analysis
│   │   └── usage.js            # GET /api/ai/usage - Usage stats
│   ├── models/
│   │   ├── save.js             # POST /api/models/save
│   │   ├── list.js             # GET /api/models/list
│   │   └── [id].js             # GET/DELETE /api/models/:id
│   └── health.js               # GET /api/health
├── public/                     # Static assets
├── src/
│   ├── components/             # React components
│   ├── contexts/               # React contexts (AuthContext)
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Libraries (Supabase client)
│   └── utils/                  # Utility functions
├── supabase/
│   └── schema.sql              # Database schema
├── backend/                    # ⚠️ DEPRECATED - Old Express server
├── vercel.json                 # Vercel configuration
└── package.json                # Dependencies and scripts
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Vercel account (for deployment)
- DeepSeek API key (for AI features)

### 1. Clone and Install

```bash
git clone <repository-url>
cd finsight
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Supabase (Frontend)
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key

# Supabase (API Functions)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI
DEEPSEEK_API_KEY=your-deepseek-key
```

### 3. Set Up Supabase Database

1. Go to your Supabase project
2. Open **SQL Editor**
3. Run the schema from `supabase/schema.sql`

### 4. Run Locally

**Option A: Frontend only (without API)**
```bash
npm start
```

**Option B: Full stack with API (recommended)**
```bash
npm run dev
# or
vercel dev
```

This runs both the CRA frontend and Vercel serverless functions.

## Deployment

### Deploy to Vercel

1. **Install Vercel CLI** (if not installed)
   ```bash
   npm i -g vercel
   ```

2. **Link project**
   ```bash
   vercel link
   ```

3. **Set environment variables in Vercel**
   
   Go to Project Settings > Environment Variables and add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
   - `DEEPSEEK_API_KEY`

4. **Deploy**
   ```bash
   vercel --prod
   ```

Vercel automatically:
- Builds the React app
- Deploys `/api/*.js` as serverless functions
- Sets up routing for SPA

## API Endpoints

All API endpoints require authentication via Supabase JWT token in the `Authorization` header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/analyze` | AI-powered financial analysis |
| GET | `/api/ai/usage` | Get user's AI usage stats |
| POST | `/api/models/save` | Save a financial model |
| GET | `/api/models/list` | List user's saved models |
| GET | `/api/models/:id` | Get a specific model |
| DELETE | `/api/models/:id` | Delete a model |
| GET | `/api/health` | Health check (no auth required) |

### Example API Call

```javascript
const response = await fetch('/api/ai/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({
    prompt: 'Analyze this financial data...',
    systemMessage: 'You are a financial analyst...'
  })
});
```

## Subscription Tiers

| Tier | AI Queries/Month | Features |
|------|------------------|----------|
| Free | 10 | Basic modeling, manual export |
| Professional | 100 | AI assistant, saved models |
| Business | 500 | Advanced reports, priority support |
| Enterprise | Unlimited | Custom features, dedicated support |

## Environment Variables Reference

| Variable | Required | Used By | Description |
|----------|----------|---------|-------------|
| `REACT_APP_SUPABASE_URL` | Yes | Frontend | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Yes | Frontend | Supabase anonymous key |
| `SUPABASE_URL` | Yes | API | Supabase URL (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | API | Supabase service role key |
| `DEEPSEEK_API_KEY` | Yes | API | DeepSeek API key |

## Architecture Notes

### Why Vercel Serverless Functions?

- **No server to manage**: Functions scale automatically
- **Cost-effective**: Pay only for what you use
- **Simple deployment**: Just push to git
- **Same codebase**: Frontend and API in one repo

### How It Works

1. **Frontend** (`src/`): Standard Create React App served as static files
2. **API** (`api/`): Each `.js` file becomes a serverless function
3. **Routing**: Vercel automatically routes `/api/*` to serverless functions
4. **SPA Fallback**: All other routes serve `index.html` for React Router

### Deprecated Files

The `backend/` folder contains the old Express/MongoDB/Auth0 setup. These files are:
- Marked as deprecated
- Kept for reference only
- Not used in production

You can safely delete the `backend/` folder once you've confirmed everything works.

## Development Tips

### Testing API Functions Locally

```bash
# Run full stack
vercel dev

# Test health endpoint
curl http://localhost:3000/api/health
```

### Debugging

- **Frontend**: Use React DevTools and browser console
- **API**: Check Vercel function logs in dashboard or use `vercel logs`
- **Database**: Use Supabase dashboard SQL editor

### Common Issues

**"Missing Supabase credentials"**
- Ensure `.env.local` has all required variables
- Restart the dev server after changing env vars

**"Invalid token" errors**
- Check that user is logged in
- Verify token hasn't expired
- Ensure Supabase project URL matches

**API returns 404**
- Ensure file is in `/api` folder
- Check file exports `default` function
- Run `vercel dev` (not `npm start`) for API testing

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is proprietary. All rights reserved.

## Support

For support, please contact the development team or open an issue in the repository.
