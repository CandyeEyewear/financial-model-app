/**
 * ================================================================================
 * ⚠️  DEPRECATED - DO NOT USE IN PRODUCTION
 * ================================================================================
 * 
 * This Express server file was used with the old DigitalOcean/MongoDB/Auth0 setup.
 * It has been replaced by Vercel Serverless Functions under /api/*.js
 * 
 * The backend functionality is now handled by:
 * - /api/ai/analyze.js    - AI analysis endpoint (was /api/ai/analyze)
 * - /api/ai/usage.js      - Usage stats endpoint (was /api/ai/usage)
 * - /api/models/save.js   - Save models (new)
 * - /api/models/list.js   - List models (new)
 * - /api/models/[id].js   - Get/Delete model (new)
 * - /api/health.js        - Health check (was /health)
 * 
 * Authentication is now handled by Supabase Auth (replaced Auth0)
 * Database is now Supabase PostgreSQL (replaced MongoDB)
 * 
 * This file is kept for reference only. Delete it when no longer needed.
 * 
 * For local development, use: vercel dev
 * For production, deploy to Vercel which automatically uses /api/*.js
 * 
 * ================================================================================
 */

// require('dotenv').config();
// const express = require('express');
// const cors = require('cors');
// const mongoose = require('mongoose');
// const aiRoutes = require('./routes/ai');

// const app = express();

// app.use(cors());
// app.use(express.json());

// app.get('/', (req, res) => {
//   res.send('✅ FinSight API is running securely via HTTPS!');
// });

// app.get('/health', (req, res) => {
//   res.json({ 
//     status: 'OK',
//     message: 'Backend is running',
//     mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
//     timestamp: new Date().toISOString()
//   });
// });

// app.use('/api/ai', aiRoutes);

// mongoose.connect(process.env.MONGODB_URI)
//   .then(() => console.log('✅ Connected to MongoDB'))
//   .catch(err => console.error('❌ MongoDB connection error:', err));

// const PORT = process.env.PORT || 5000;
// app.listen(PORT, '0.0.0.0', () => {
//   console.log(`🚀 FinSight API running on port ${PORT}`);
// });

console.warn(`
================================================================================
⚠️  DEPRECATED: This backend server is no longer used.
================================================================================

The application now uses Vercel Serverless Functions.
Please use 'vercel dev' for local development instead.

For more information, see:
- /api/*.js files for serverless function implementations
- README.md for development instructions
- MIGRATION_GUIDE.md for migration details
================================================================================
`);

// Export nothing - this file is deprecated
module.exports = {};
