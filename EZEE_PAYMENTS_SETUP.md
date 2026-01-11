# eZeePayments Integration Setup Guide

This document provides instructions for configuring eZeePayments integration for FinSight.

## Environment Variables

Add the following environment variables to your Vercel project settings:

### Required eZeePayments Variables

```bash
# eZeePayments API Credentials
EZEE_LICENCE_KEY=your_licence_key_here
EZEE_SITE=https://your-registered-domain.com

# eZeePayments API URLs
# For Testing/Sandbox:
EZEE_PAYMENTS_BASE_URL=https://api-test.ezeepayments.com
EZEE_PAYMENTS_SECURE_URL=https://secure-test.ezeepayments.com

# For Production:
# EZEE_PAYMENTS_BASE_URL=https://api.ezeepayments.com
# EZEE_PAYMENTS_SECURE_URL=https://secure.ezeepayments.com
```

### Required Supabase Variables

```bash
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Application URLs

```bash
# Application Base URL (auto-detected on Vercel)
APP_BASE_URL=https://your-app-domain.com
```

## Vercel Configuration Steps

### 1. Access Vercel Environment Variables

1. Go to your Vercel dashboard
2. Select your project (FinSight)
3. Click "Settings" tab
4. Click "Environment Variables" in the left sidebar

### 2. Add Each Variable

For each variable above:
1. Click "Add New"
2. Enter the variable name (e.g., `EZEE_LICENCE_KEY`)
3. Enter the value
4. Select environments: Production, Preview, Development (or as needed)
5. Click "Save"

### 3. Important Notes

- **EZEE_LICENCE_KEY**: Obtain from eZeePayments merchant portal
- **EZEE_SITE**: Must match exactly the domain registered with eZeePayments
- **SUPABASE_SERVICE_ROLE_KEY**: Use the service role key, NOT the anon key (for API endpoints)
- **APP_BASE_URL**: Your production domain (e.g., `https://finsight.com`)

### 4. Test vs Production

Use different values for test and production environments:

**Testing:**
- Use test API URLs (`api-test.ezeepayments.com`)
- Use test licence key provided by eZeePayments
- Use test Supabase project

**Production:**
- Use production API URLs (`api.ezeepayments.com`)
- Use production licence key
- Use production Supabase project

## Database Setup

Run the updated schema in your Supabase SQL Editor:

1. Go to Supabase Dashboard
2. Select your project
3. Click "SQL Editor" in the left sidebar
4. Open `supabase/schema.sql` from this repository
5. Copy the entire contents
6. Paste into the SQL Editor
7. Click "Run"

This will create:
- `subscriptions` table
- `payments` table
- Database triggers for automatic tier upgrades
- Necessary indexes and RLS policies

## Webhook Configuration

### Webhook URL

Your eZeePayments webhook (postback) URL is:
```
https://your-domain.com/api/payments/webhook
```

### Configure in eZeePayments

1. Log in to eZeePayments merchant portal
2. Go to Settings > Webhooks
3. Add webhook URL: `https://your-domain.com/api/payments/webhook`
4. Ensure webhook is enabled

### Testing Webhooks Locally

For local development, use a tool like [ngrok](https://ngrok.com/):

```bash
# Start your local server on port 3000
npm run dev

# In another terminal, start ngrok
ngrok http 3000

# Use the ngrok URL for webhook testing
# Example: https://abc123.ngrok.io/api/payments/webhook
```

## Payment Flow Overview

1. **User selects plan** → Frontend calls `/api/payments/create-checkout`
2. **API creates subscription** → Calls eZeePayments `/v1/subscription/create/`
3. **API gets payment token** → Calls eZeePayments `/v1/custom_token/`
4. **User redirected to payment page** → eZeePayments secure payment form
5. **User completes payment** → eZeePayments processes payment
6. **Webhook notification** → eZeePayments sends POST to `/api/payments/webhook`
7. **Database updated** → Payment status and user tier upgraded automatically
8. **User redirected** → Back to success/cancel page

## API Endpoints

All endpoints are located in `api/payments/`:

- `POST /api/payments/create-checkout` - Create subscription and get payment token
- `POST /api/payments/webhook` - Receive payment notifications
- `POST /api/payments/subscription-status` - Check subscription status
- `POST /api/payments/cancel-subscription` - Cancel active subscription

## Security Considerations

1. **Never commit credentials** - All keys are in Vercel environment variables
2. **HTTPS only** - eZeePayments requires HTTPS for all webhooks
3. **Webhook validation** - The webhook handler validates all incoming data
4. **RLS policies** - Supabase Row Level Security protects user data
5. **Authentication** - All API endpoints require valid JWT token

## Testing Checklist

- [ ] Environment variables set in Vercel
- [ ] Database schema deployed to Supabase
- [ ] Test payment with eZeePayments sandbox
- [ ] Webhook receives payment notification
- [ ] User tier upgraded after successful payment
- [ ] Subscription status can be checked
- [ ] Subscription can be cancelled

## Supported Currencies

Currently supported:
- **USD** (US Dollar)
- **JMD** (Jamaican Dollar)

The currency is automatically passed from the API to eZeePayments.

## Supported Billing Frequencies

- `monthly` - Monthly recurring billing
- `annually` - Annual recurring billing
- `weekly` - Weekly recurring (if needed)
- `quarterly` - Quarterly recurring (if needed)
- `daily` - Daily recurring (if needed)

## Troubleshooting

### Payments not completing

1. Check Vercel logs for API errors
2. Verify webhook URL is accessible
3. Check eZeePayments merchant portal for transaction status
4. Verify all environment variables are set correctly

### Webhook not receiving notifications

1. Ensure webhook URL is HTTPS
2. Verify webhook URL in eZeePayments portal
3. Check Vercel function logs
4. Test webhook with ngrok locally

### User tier not upgrading

1. Check payment status in database (`payments` table)
2. Verify subscription record exists (`subscriptions` table)
3. Check database trigger is working
4. Review Supabase logs

## Support

For eZeePayments API issues:
- Contact eZeePayments support
- Review API documentation

For integration issues:
- Check Vercel function logs
- Review Supabase logs
- Check GitHub issues
