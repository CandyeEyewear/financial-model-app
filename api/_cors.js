// Shared CORS utility for Vercel Serverless Functions
// This handles CORS preflight (OPTIONS) requests

export const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
};

/**
 * Handle CORS preflight request
 * @param {Request} req - Vercel request object
 * @param {Response} res - Vercel response object
 * @returns {boolean} - Returns true if this was an OPTIONS request (handled)
 */
export function handleCors(req, res) {
  // Set CORS headers on all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }

  return false;
}
