/**
 * Create Checkout Session API
 * Handles subscription creation and payment token generation for eZeePayments
 */
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// eZeePayments configuration
const EZEE_BASE_URL = process.env.EZEE_PAYMENTS_BASE_URL || 'https://api-test.ezeepayments.com';
const EZEE_SECURE_URL = process.env.EZEE_PAYMENTS_SECURE_URL || 'https://secure-test.ezeepayments.com';
const EZEE_LICENCE_KEY = process.env.EZEE_LICENCE_KEY;
const EZEE_SITE = process.env.EZEE_SITE;
const APP_BASE_URL = process.env.APP_BASE_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

// Plan pricing configuration
const PLAN_CONFIG = {
  professional: {
    monthly: 99,
    annual: 79,
    frequency: 'monthly',
    description: 'Professional Plan - Credit Analysis & AI Tools',
  },
  business: {
    monthly: 299,
    annual: 249,
    frequency: 'monthly',
    description: 'Business Plan - Team Collaboration & Advanced Features',
  },
};

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
    const { planKey, billingCycle } = await request.json();

    // Validate plan
    if (!PLAN_CONFIG[planKey]) {
      throw new Error('Invalid plan selected');
    }

    // Validate billing cycle
    if (!['monthly', 'annual'].includes(billingCycle)) {
      throw new Error('Invalid billing cycle');
    }

    const plan = PLAN_CONFIG[planKey];
    const amount = billingCycle === 'monthly' ? plan.monthly : plan.annual;
    const currency = 'USD'; // Can also support JMD

    // Determine frequency for eZeePayments
    const frequency = billingCycle === 'monthly' ? 'monthly' : 'annually';

    // Step 1: Create subscription in eZeePayments
    console.log('Creating subscription in eZeePayments...');
    const subscriptionResponse = await ezeePaymentsRequest('/v1/subscription/create/', {
      amount,
      currency,
      frequency,
      description: plan.description,
    });

    if (subscriptionResponse.result.status !== 1) {
      console.error('Subscription creation failed:', subscriptionResponse);
      throw new Error(
        typeof subscriptionResponse.result.message === 'string'
          ? subscriptionResponse.result.message
          : JSON.stringify(subscriptionResponse.result.message)
      );
    }

    const ezeeSubscriptionId = subscriptionResponse.result.subscription_id;
    console.log('Subscription created:', ezeeSubscriptionId);

    // Generate unique order ID
    const orderId = `SUB-${user.id.substring(0, 8)}-${Date.now()}`;

    // Step 2: Create subscription record in database
    const { data: subscription, error: dbError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        tier_id: planKey,
        ezee_subscription_id: ezeeSubscriptionId,
        amount,
        currency,
        frequency,
        status: 'pending_payment',
        description: plan.description,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to create subscription record');
    }

    // Step 3: Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        subscription_id: subscription.id,
        order_id: orderId,
        amount,
        currency,
        status: 'pending',
        customer_email: user.email,
        description: plan.description,
      })
      .select()
      .single();

    if (paymentError) {
      console.error('Payment record error:', paymentError);
      throw new Error('Failed to create payment record');
    }

    // Step 4: Get payment token from eZeePayments
    console.log('Getting payment token...');
    const tokenResponse = await ezeePaymentsRequest('/v1/custom_token/', {
      amount,
      currency,
      order_id: orderId,
      post_back_url: `${APP_BASE_URL}/api/payments/webhook`,
      return_url: `${APP_BASE_URL}/payment/success?order_id=${orderId}`,
      cancel_url: `${APP_BASE_URL}/payment/cancelled?order_id=${orderId}`,
    });

    if (tokenResponse.result.status !== 1) {
      console.error('Token generation failed:', tokenResponse);
      throw new Error(tokenResponse.result.message || 'Failed to generate payment token');
    }

    const token = tokenResponse.result.token;
    console.log('Payment token generated');

    // Return checkout session data
    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl: EZEE_SECURE_URL,
        token,
        amount,
        currency,
        orderId,
        subscriptionId: ezeeSubscriptionId,
        recurring: true,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Checkout error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to create checkout session',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
