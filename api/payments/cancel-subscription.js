/**
 * Cancel Subscription API
 * Cancel an active subscription with eZeePayments
 */
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// eZeePayments configuration
const EZEE_BASE_URL = process.env.EZEE_PAYMENTS_BASE_URL || 'https://api-test.ezeepayments.com';
const EZEE_LICENCE_KEY = process.env.EZEE_LICENCE_KEY;
const EZEE_SITE = process.env.EZEE_SITE;

/**
 * Helper to make eZeePayments API requests
 */
async function ezeePaymentsRequest(endpoint, data) {
  const formData = new URLSearchParams();

  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, String(value));
    }
  });

  const response = await fetch(`${EZEE_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'licence_key': EZEE_LICENCE_KEY,
      'site': EZEE_SITE,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`eZeePayments API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Verify user authentication
 */
async function verifyAuth(request) {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error('Invalid authentication token');
  }

  return user;
}

/**
 * Main handler
 */
export default async function handler(request) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };

  // Handle OPTIONS request for CORS
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Verify authentication
    const user = await verifyAuth(request);

    // Parse request body
    const { subscriptionId } = await request.json();

    if (!subscriptionId) {
      throw new Error('Subscription ID is required');
    }

    // Get subscription from database
    const { data: subscription, error: dbError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('user_id', user.id)
      .single();

    if (dbError || !subscription) {
      throw new Error('Subscription not found');
    }

    // Check if subscription can be cancelled
    if (subscription.status === 'canceled' || subscription.status === 'ended') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Subscription is already cancelled or ended',
          status: subscription.status,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if we have a transaction number
    if (!subscription.ezee_transaction_number) {
      // No payment made yet, just update local status
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled' })
        .eq('id', subscriptionId);

      await supabase
        .from('users')
        .update({
          subscription_status: 'canceled',
          tier: 'free',
        })
        .eq('id', user.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Subscription cancelled successfully',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Cancel with eZeePayments
    const cancelResponse = await ezeePaymentsRequest('/v1/subscription/cancel/', {
      TransactionNumber: subscription.ezee_transaction_number,
    });

    if (cancelResponse.result.status !== 1) {
      throw new Error(cancelResponse.result.message || 'Failed to cancel subscription');
    }

    // Update local database
    await supabase
      .from('subscriptions')
      .update({ status: 'canceled' })
      .eq('id', subscriptionId);

    // Update user status
    await supabase
      .from('users')
      .update({
        subscription_status: 'canceled',
        tier: 'free', // Downgrade to free tier
      })
      .eq('id', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription cancelled successfully',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Cancel subscription error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to cancel subscription',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
