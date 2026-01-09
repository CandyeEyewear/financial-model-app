# FinSight Migration Guide: Supabase + Vercel

This guide documents the complete migration from the previous MongoDB + DigitalOcean + Auth0 architecture to Supabase + Vercel.

## Architecture Overview

### Previous Architecture (Deprecated)
- **Frontend**: React (Create React App) on static hosting
- **Backend**: Express.js on DigitalOcean droplet
- **Database**: MongoDB (MongoDB Atlas or self-hosted)
- **Authentication**: Auth0
- **AI API**: DeepSeek (called from backend)

### New Architecture
- **Frontend + API**: Vercel (React + Serverless Functions)
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI API**: DeepSeek (called from Vercel API routes)

## Migration Steps

### 1. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. Go to **SQL Editor** and run the schema from `supabase/schema.sql`:
   ```sql
   -- Copy and paste the entire contents of supabase/schema.sql
   ```

3. Configure Authentication Providers:
   - Go to **Authentication > Providers**
   - Enable **Email** (enabled by default)
   - Enable **Google** OAuth (optional):
     - Create credentials at [Google Cloud Console](https://console.cloud.google.com)
     - Add OAuth client ID and secret
     - Add callback URL: `https://your-project.supabase.co/auth/v1/callback`
   - Enable **GitHub** OAuth (optional):
     - Create OAuth app at [GitHub Developer Settings](https://github.com/settings/developers)
     - Add Client ID and Secret
     - Add callback URL: `https://your-project.supabase.co/auth/v1/callback`

4. Get your API keys:
   - Go to **Settings > API**
   - Copy `Project URL` → `SUPABASE_URL`
   - Copy `anon public` key → `REACT_APP_SUPABASE_ANON_KEY`
   - Copy `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 2. Vercel Setup

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Link your project:
   ```bash
   vercel link
   ```

3. Add environment variables:
   ```bash
   vercel env add SUPABASE_URL
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add REACT_APP_SUPABASE_URL
   vercel env add REACT_APP_SUPABASE_ANON_KEY
   vercel env add DEEPSEEK_API_KEY
   ```

4. Deploy:
   ```bash
   vercel --prod
   ```

### 3. Local Development

1. Copy environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Fill in your credentials in `.env.local`

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start development server:
   ```bash
   npm start
   ```

5. For API development with Vercel:
   ```bash
   vercel dev
   ```

## File Structure Changes

### New Files
```
/api/                          # Vercel Serverless Functions
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
│   └── AuthContext.js         # Auth provider (replaces Auth0)
└── components/
    └── AuthPage.jsx           # Login/Register UI

/supabase/
└── schema.sql                 # Database schema

vercel.json                    # Vercel configuration
.env.example                   # Environment template
```

### Deprecated Files (can be removed)
```
/backend/                      # Old Express backend
├── server.js
├── package.json
├── routes/
├── models/
└── services/

server.js                      # Old root server file (deleted)
```

## API Endpoints

### Authentication
Authentication is handled client-side via Supabase Auth. No backend endpoints needed.

### AI Analysis
```
POST /api/ai/analyze
Authorization: Bearer <supabase-access-token>
Body: {
  "prompt": "...",
  "systemMessage": "...",
  "messages": [...]
}
```

### Usage Stats
```
GET /api/ai/usage
Authorization: Bearer <supabase-access-token>
```

### Saved Models
```
POST /api/models/save
GET /api/models/list
GET /api/models/[id]
DELETE /api/models/[id]
```

### Health Check
```
GET /api/health
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

## Key Differences from Previous Setup

| Feature | Before (Auth0 + MongoDB) | After (Supabase) |
|---------|-------------------------|------------------|
| Auth Provider | Auth0 | Supabase Auth |
| Database | MongoDB | PostgreSQL |
| Backend | Express on DigitalOcean | Vercel Serverless |
| User Management | MongoDB document | PostgreSQL row |
| Session Handling | Auth0 tokens | Supabase JWT |
| Real-time | Not available | Supabase Realtime (available) |

## Troubleshooting

### "Missing Supabase credentials"
Ensure environment variables are set correctly:
- `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` for frontend
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for API routes

### "Invalid token" errors
- Check that the user is logged in
- Verify the token hasn't expired
- Ensure the Supabase project URL matches

### Database errors
- Run the schema SQL in Supabase SQL Editor
- Check Row Level Security policies are created
- Verify the trigger for new user creation exists

### OAuth not working
- Verify callback URLs in provider settings
- Check client ID and secret are correct
- Ensure the provider is enabled in Supabase Auth settings

## Cost Comparison

| Service | Before | After |
|---------|--------|-------|
| Hosting | DigitalOcean ~$6-24/mo | Vercel Free-$20/mo |
| Database | MongoDB Atlas ~$0-57/mo | Supabase Free-$25/mo |
| Auth | Auth0 Free-$23/mo | Supabase (included) |
| **Total** | **$6-104/mo** | **$0-45/mo** |

## Next Steps

1. **Test thoroughly** in development before deploying
2. **Migrate existing users** if you have them (export from Auth0, import to Supabase)
3. **Update DNS** if using custom domain
4. **Monitor logs** in Vercel dashboard after deployment
5. **Set up Stripe** integration if using paid plans

## Support

For issues with:
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)
- **Vercel**: [vercel.com/docs](https://vercel.com/docs)
- **DeepSeek API**: [platform.deepseek.com](https://platform.deepseek.com)
