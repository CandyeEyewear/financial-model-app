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
 * Parse request body - handles both form data and JSON
 */
function parseBody(req) {
  const contentType = req.headers['content-type'] || '';

  // If body is already parsed (by Vercel), return it
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  // For form data that wasn't auto-parsed
  if (contentType.includes('application/x-www-form-urlencoded') && typeof req.body === 'string') {
    const params = new URLSearchParams(req.body);
    const data = {};
    for (const [key, value] of params.entries()) {
      data[key] = value;
    }
    return data;
  }

  return req.body || {};
}

/**
 * Main webhook handler
 */
export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    console.log('=== Webhook received ===');

    // Parse the webhook data
    const webhookData = parseBody(req);

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
      return res.status(400).send('Missing required fields');
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
      return res.status(200).send('Payment record not found');
    }

    // Check for idempotency - if already processed, return success
    if (payment.status === 'completed' && payment.transaction_number === TransactionNumber) {
      console.log('Payment already processed, returning success');
      return res.status(200).send('OK');
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
    return res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);

    // Still return 200 to prevent retries for errors we can't handle
    return res.status(200).send('Error processed');
  }
}

// Disable body parsing to handle raw form data if needed
export const config = {
  api: {
    bodyParser: true,
  },
};
