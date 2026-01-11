/**
 * eZeePayments Webhook Handler
 * Receives payment notifications (postbacks) from eZeePayments
 * Updates payment and subscription status in database
 */
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Parse form data from request
 */
async function parseFormData(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    const params = new URLSearchParams(text);
    const data = {};

    for (const [key, value] of params.entries()) {
      data[key] = value;
    }

    return data;
  } else if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const data = {};

    for (const [key, value] of formData.entries()) {
      data[key] = value;
    }

    return data;
  }

  // Try to parse as JSON if no form data
  try {
    return await request.json();
  } catch {
    throw new Error('Unable to parse request body');
  }
}

/**
 * Main webhook handler
 */
export default async function handler(request) {
  // Only accept POST requests
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    console.log('=== Webhook received ===');

    // Parse the webhook data
    const webhookData = await parseFormData(request);

    console.log('Webhook data:', {
      ResponseCode: webhookData.ResponseCode,
      ResponseDescription: webhookData.ResponseDescription,
      TransactionNumber: webhookData.TransactionNumber,
      order_id: webhookData.order_id,
    });

    const {
      ResponseCode,
      ResponseDescription,
      TransactionNumber,
      order_id,
    } = webhookData;

    // Validate required fields
    if (!ResponseCode || !TransactionNumber) {
      console.error('Missing required webhook fields');
      return new Response('Missing required fields', { status: 400 });
    }

    // Determine payment success
    const isSuccess = ResponseCode === '1';
    const paymentStatus = isSuccess ? 'completed' : 'failed';

    console.log(`Payment status: ${paymentStatus}`);

    // Find the payment record by order_id or transaction_number
    let payment;
    if (order_id) {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', order_id)
        .single();
      payment = data;
    }

    if (!payment && TransactionNumber) {
      const { data } = await supabase
        .from('payments')
        .select('*')
        .eq('transaction_number', TransactionNumber)
        .single();
      payment = data;
    }

    if (!payment) {
      console.error('Payment record not found for order_id:', order_id);
      // Still return 200 to acknowledge receipt
      return new Response('Payment record not found', { status: 200 });
    }

    // Check for idempotency - if already processed, return success
    if (payment.status === 'completed' && payment.transaction_number === TransactionNumber) {
      console.log('Payment already processed, returning success');
      return new Response('OK', { status: 200 });
    }

    // Update payment record
    console.log('Updating payment record...');
    const { error: paymentUpdateError } = await supabase
      .from('payments')
      .update({
        status: paymentStatus,
        transaction_number: TransactionNumber,
        response_code: ResponseCode,
        response_description: ResponseDescription,
        processed_at: new Date().toISOString(),
      })
      .eq('id', payment.id);

    if (paymentUpdateError) {
      console.error('Error updating payment:', paymentUpdateError);
      throw paymentUpdateError;
    }

    console.log('Payment updated successfully');

    // If payment successful and subscription exists, the database trigger will handle tier upgrade
    // But we also need to update subscription with transaction number
    if (isSuccess && payment.subscription_id) {
      console.log('Updating subscription with transaction number...');

      const { error: subUpdateError } = await supabase
        .from('subscriptions')
        .update({
          ezee_transaction_number: TransactionNumber,
        })
        .eq('id', payment.subscription_id);

      if (subUpdateError) {
        console.error('Error updating subscription:', subUpdateError);
      } else {
        console.log('Subscription updated successfully');
      }
    }

    console.log('=== Webhook processed successfully ===');

    // Always return 200 to acknowledge receipt
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Webhook error:', error);

    // Still return 200 to prevent retries for errors we can't handle
    return new Response('Error processed', { status: 200 });
  }
}

// Configure for Vercel edge runtime (optional, for better performance)
export const config = {
  runtime: 'edge',
};
