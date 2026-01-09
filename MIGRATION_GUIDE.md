# FinSight Migration Guide: Supabase + Vercel

This guide documents the complete migration from the previous MongoDB + DigitalOcean + Auth0 architecture to Supabase + Vercel.

## ✅ Migration Status: COMPLETE

The migration has been completed. All backend functionality now runs as Vercel Serverless Functions.

## Architecture Overview

### Previous Architecture (Deprecated)
- **Frontend**: React (Create React App) on static hosting
- **Backend**: Express.js on DigitalOcean droplet
- **Database**: MongoDB (MongoDB Atlas or self-hosted)
- **Authentication**: Auth0
- **AI API**: DeepSeek (called from backend)

### Current Architecture
- **Frontend + API**: Vercel (React + Serverless Functions)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI API**: DeepSeek (called from Vercel API routes)

## What Changed

### 1. Authentication
- **Before**: Auth0 JWT tokens with `express-jwt` middleware
- **After**: Supabase Auth with native PostgreSQL integration

### 2. Database
- **Before**: MongoDB with Mongoose models (`backend/Models/User.js`)
- **After**: PostgreSQL via Supabase (`supabase/schema.sql`)

### 3. Backend API
- **Before**: Express.js server (`backend/server.js`, `backend/routes/ai.js`)
- **After**: Vercel Serverless Functions (`api/*.js`)

### 4. Deployment
- **Before**: Manual deployment to DigitalOcean droplet
- **After**: Automatic deployment via Vercel (git push)

## File Structure

### Active Files
```
/api/                          # Vercel Serverless Functions
├── _cors.js                   # Shared CORS utility
├── ai/
│   ├── analyze.js             # AI analysis endpoint
│   └── usage.js               # Usage stats endpoint
├── models/
│   ├── save.js                # Save financial model
│   ├── list.js                # List saved models
│   └── [id].js                # Get/Delete model by ID
└── health.js                  # Health check

/src/
├── lib/
│   └── supabase.js            # Supabase client & helpers
├── contexts/
│   └── AuthContext.js         # Supabase Auth provider
└── components/
    └── AuthPage.jsx           # Login/Register UI

/supabase/
└── schema.sql                 # Database schema

vercel.json                    # Vercel configuration
.env.example                   # Environment template
```

### Deprecated Files (kept for reference)
```
/backend/                      # ⚠️ DEPRECATED
├── server.js                  # Old Express server
├── package.json               # Old dependencies
├── routes/
│   └── ai.js                  # Old Express routes
├── models/
│   └── User.js                # Old Mongoose model
└── services/
    └── aiPrompts.js           # Old prompt utilities
```

## API Endpoints

### Current Endpoints (Vercel Serverless)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/analyze` | AI-powered financial analysis |
| GET | `/api/ai/usage` | Get user's AI usage stats |
| POST | `/api/models/save` | Save a financial model |
| GET | `/api/models/list` | List user's saved models |
| GET | `/api/models/:id` | Get a specific model |
| DELETE | `/api/models/:id` | Delete a model |
| GET | `/api/health` | Health check |

### Authentication

All endpoints except `/api/health` require a Supabase JWT token:

```javascript
const { session } = await supabase.auth.getSession();
const response = await fetch('/api/ai/analyze', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({ prompt: '...' })
});
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,           -- Supabase auth user ID
  email TEXT NOT NULL,
  name TEXT,
  tier TEXT DEFAULT 'free',      -- free, professional, business, enterprise
  ai_queries_this_month INTEGER DEFAULT 0,
  reports_this_month INTEGER DEFAULT 0,
  last_reset_date TIMESTAMPTZ,
  subscription_status TEXT,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Saved Models Table
```sql
CREATE TABLE saved_models (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  model_data JSONB NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## vercel.json Configuration

The configuration uses the new Vercel routing system (no legacy `routes` array):

```json
{
  "version": 2,
  "framework": "create-react-app",
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,OPTIONS,PATCH,DELETE,POST,PUT" }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/((?!api/).*)",
      "destination": "/index.html"
    }
  ],
  "functions": {
    "api/**/*.js": {
      "maxDuration": 30
    }
  }
}
```

## Local Development

### Option 1: Frontend Only
```bash
npm start
```
This runs just the React app. API calls will fail without backend.

### Option 2: Full Stack (Recommended)
```bash
npm run dev
# or
vercel dev
```
This runs both frontend and serverless functions locally.

## Vercel Deployment

1. Push to your repository
2. Vercel automatically deploys
3. Environment variables are read from Vercel project settings

### Required Environment Variables

Set these in Vercel Dashboard > Project Settings > Environment Variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `REACT_APP_SUPABASE_URL` | Supabase project URL (frontend) |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase anon key (frontend) |
| `DEEPSEEK_API_KEY` | DeepSeek API key |

## Cleanup

Once you've verified everything works, you can delete the deprecated `backend/` folder:

```bash
rm -rf backend/
```

The files are kept only for reference during the transition period.

## Troubleshooting

### "Missing Supabase credentials"
- Ensure environment variables are set in `.env.local` (local) or Vercel dashboard (production)
- Restart the dev server after changing env vars

### "Invalid token" errors
- Check that the user is logged in
- Verify the token hasn't expired
- Ensure the Supabase project URL matches

### API returns 405 Method Not Allowed
- Check that the API function handles the HTTP method
- Ensure CORS preflight (OPTIONS) is handled

### Database errors
- Run the schema SQL in Supabase SQL Editor
- Check Row Level Security policies
- Verify the trigger for new user creation exists

## Cost Comparison

| Service | Before | After |
|---------|--------|-------|
| Hosting | DigitalOcean ~$6-24/mo | Vercel Free-$20/mo |
| Database | MongoDB Atlas ~$0-57/mo | Supabase Free-$25/mo |
| Auth | Auth0 Free-$23/mo | Supabase (included) |
| **Total** | **$6-104/mo** | **$0-45/mo** |

## Support

For issues with:
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)
- **Vercel**: [vercel.com/docs](https://vercel.com/docs)
- **DeepSeek API**: [platform.deepseek.com](https://platform.deepseek.com)
