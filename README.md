# FinSight

A professional financial modeling and stress testing platform built with React, Supabase, and Vercel.

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

- **Frontend**: React 18, TailwindCSS, Recharts
- **Backend**: Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI**: DeepSeek API
- **PDF Generation**: jsPDF, html2canvas

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Vercel account (for deployment)
- DeepSeek API key (for AI features)

### Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd finsight
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` with your credentials:
   ```env
   REACT_APP_SUPABASE_URL=https://your-project.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   DEEPSEEK_API_KEY=your-deepseek-key
   ```

4. **Set up Supabase database**
   - Go to your Supabase project
   - Open SQL Editor
   - Run the schema from `supabase/schema.sql`

5. **Start development server**
   ```bash
   npm start
   ```
   
   For full API testing with Vercel:
   ```bash
   vercel dev
   ```

### Deployment

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Deploy**
   ```bash
   vercel --prod
   ```

3. **Set environment variables in Vercel dashboard**
   - Go to Project Settings > Environment Variables
   - Add all required variables from `.env.example`

## Project Structure

```
finsight/
├── api/                    # Vercel Serverless Functions
│   ├── ai/
│   │   ├── analyze.js      # AI analysis endpoint
│   │   └── usage.js        # Usage statistics
│   ├── models/
│   │   ├── save.js         # Save models
│   │   ├── list.js         # List models
│   │   └── [id].js         # Get/Delete model
│   └── health.js           # Health check
├── public/                 # Static assets
├── src/
│   ├── components/         # React components
│   ├── contexts/           # React contexts (Auth)
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Libraries (Supabase client)
│   └── utils/              # Utility functions
├── supabase/
│   └── schema.sql          # Database schema
├── vercel.json             # Vercel configuration
└── package.json
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/analyze` | AI-powered financial analysis |
| GET | `/api/ai/usage` | Get user's AI usage stats |
| POST | `/api/models/save` | Save a financial model |
| GET | `/api/models/list` | List user's saved models |
| GET | `/api/models/[id]` | Get a specific model |
| DELETE | `/api/models/[id]` | Delete a model |
| GET | `/api/health` | Health check |

## Subscription Tiers

| Tier | AI Queries/Month | Features |
|------|------------------|----------|
| Free | 10 | Basic modeling, manual export |
| Professional | 100 | AI assistant, saved models |
| Business | 500 | Advanced reports, priority support |
| Enterprise | Unlimited | Custom features, dedicated support |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_SUPABASE_URL` | Yes | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `SUPABASE_URL` | Yes | Supabase URL (for API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `DEEPSEEK_API_KEY` | Yes | DeepSeek API key |

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
