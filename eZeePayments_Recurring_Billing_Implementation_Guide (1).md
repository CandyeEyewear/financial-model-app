# eZeePayments Recurring Billing API - Implementation Guide

> **Purpose**: This guide provides detailed instructions for implementing eZeePayments recurring billing functionality. Designed for use with AI coding assistants (Cursor, Claude Code) and developers.

---

## Table of Contents

1. [Overview & Authentication](#1-overview--authentication)
2. [API Endpoints Summary](#2-api-endpoints-summary)
3. [Implementation Flow](#3-implementation-flow)
4. [Step 1: Create Subscription](#4-step-1-create-subscription)
5. [Step 2: Obtain Transaction Token](#5-step-2-obtain-transaction-token)
6. [Step 3: Process Payment](#6-step-3-process-payment)
7. [Step 4: Handle Postback (Webhook)](#7-step-4-handle-postback-webhook)
8. [Subscription Management](#8-subscription-management)
9. [TypeScript/JavaScript Implementation](#9-typescriptjavascript-implementation)
10. [Supabase Edge Function Examples](#10-supabase-edge-function-examples)
11. [React Native Integration](#11-react-native-integration)
12. [Error Handling](#12-error-handling)
13. [Testing Checklist](#13-testing-checklist)

---

## 1. Overview & Authentication

### Base URLs

| Environment | Base URL |
|-------------|----------|
| **Test/Sandbox** | `https://api-test.ezeepayments.com` |
| **Production** | `https://api.ezeepayments.com` |
| **Payment Page (Test)** | `https://secure-test.ezeepayments.com` |
| **Payment Page (Production)** | `https://secure.ezeepayments.com` |

### Required Headers (ALL Requests)

Every API request to eZeePayments **MUST** include these headers:

```
licence_key: YOUR_LICENCE_KEY
site: https://your-registered-domain.com
```

**Important Notes:**
- `licence_key` is provided by eZeePayments upon merchant registration
- `site` must match the domain registered with eZeePayments
- Both headers are **mandatory** for all API calls
- Currently only `JMD` (Jamaican Dollar) currency is supported

---

## 2. API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/subscription/create/` | POST | Create a new recurring subscription |
| `/v1/custom_token/` | POST | Obtain payment token before each transaction |
| `/v1/subscription/status/` | POST | Check subscription status |
| `/v1/subscription/cancel/` | POST | Cancel an active subscription |

---

## 3. Implementation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    RECURRING PAYMENT IMPLEMENTATION FLOW                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  1. CREATE       │     │  2. GET TOKEN    │     │  3. REDIRECT TO  │
│  SUBSCRIPTION    │────▶│  (Before each    │────▶│  PAYMENT PAGE    │
│  (One-time)      │     │   payment)       │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        │                                                   │
        │ Returns:                                          │ User enters
        │ subscription_id                                   │ card details
        │ (Save this!)                                      │
        ▼                                                   ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Store           │     │  5. USER         │◀────│  4. POSTBACK     │
│  subscription_id │     │  REDIRECTED      │     │  (Webhook)       │
│  in database     │     │  to return_url   │     │  Sent to your    │
└──────────────────┘     └──────────────────┘     │  post_back_url   │
                                                  └──────────────────┘
                                                          │
                                                          │ Contains:
                                                          │ - ResponseCode
                                                          │ - TransactionNumber
                                                          ▼
                                                  ┌──────────────────┐
                                                  │  Update payment  │
                                                  │  status in DB    │
                                                  └──────────────────┘
```

---

## 4. Step 1: Create Subscription

**When to call:** Once when user first subscribes to a recurring plan.

### Endpoint
```
POST https://api-test.ezeepayments.com/v1/subscription/create/
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | decimal/integer | **Yes** | Subscription amount (e.g., 5000 for $5,000 JMD) |
| `currency` | string | **Yes** | Must be `"JMD"` |
| `frequency` | string | **Yes** | One of: `"daily"`, `"weekly"`, `"monthly"`, `"quarterly"`, `"annually"` |
| `end_date` | string | No | Future date in `d/m/Y` format (e.g., "31/12/2025") |
| `description` | string | No | Description of the subscription |
| `post_back_url` | string | No | HTTPS URL for webhook notifications |

### Response

**Success (status: 1):**
```json
{
  "result": {
    "status": 1,
    "subscription_id": "39"
  }
}
```

**Failure (status: 0):**
```json
{
  "result": {
    "status": 0,
    "message": {
      "frequency": "The Frequency can only be one of the following: daily, weekly, monthly, quarterly, annually"
    }
  }
}
```

### Critical: Save the `subscription_id`
The `subscription_id` returned must be stored in your database. You will need it for:
- Processing recurring payments
- Checking subscription status
- Cancelling subscriptions

---

## 5. Step 2: Obtain Transaction Token

**When to call:** Before EVERY payment transaction (both initial and recurring).

### Endpoint
```
POST https://api-test.ezeepayments.com/v1/custom_token/
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | decimal/integer | **Yes** | Transaction amount |
| `currency` | string | **Yes** | Must be `"JMD"` |
| `order_id` | string | **Yes** | Your internal order/reference ID (not unique) |
| `post_back_url` | string | **Yes** | HTTPS URL - receives transaction details before redirect |
| `return_url` | string | **Yes** | HTTPS URL - user redirected here after payment |
| `cancel_url` | string | **Yes** | HTTPS URL - user redirected here if they cancel |

### Response

**Success:**
```json
{
  "result": {
    "status": 1,
    "token": "016115c4e18dc15c07114d663b1c1c70e902a408"
  }
}
```

**Failure:**
```json
{
  "result": {
    "status": 0,
    "message": "Request missing required parameters"
  }
}
```

---

## 6. Step 3: Process Payment

After obtaining the token, redirect the user to the eZeePayments secure payment page.

### Payment Page URL
```
POST https://secure-test.ezeepayments.com
```

### Form Data to Submit

| Parameter | Type | Length | Required | Description |
|-----------|------|--------|----------|-------------|
| `platform` | string | 6 | **Yes** | Must always be `"custom"` |
| `token` | string | 10 | **Yes** | Token from Step 2 |
| `amount` | decimal/integer | 10,2 | **Yes** | Transaction amount |
| `currency` | string | 3 | **Yes** | Must be `"JMD"` |
| `order_id` | string | 50 | **Yes** | Your internal order ID |
| `email_address` | string | 150 | **Yes** | Customer's email |
| `customer_name` | string | 150 | No | Customer's name |
| `leave_note` | integer | 1 | No | `1` or `0` - Allow customer to leave note |
| `request_address` | integer | 1 | No | `1` or `0` - Request customer address |
| `request_phone` | integer | 1 | No | `1` or `0` - Request customer phone |
| `description` | string | 512 | No | Payment description |
| `recurring` | string | 5 | No | `"true"` or `"false"` for recurring payments |
| `subscription_id` | integer | 11 | No* | **Required if `recurring: "true"`** - From Step 1 |

**Note:** For recurring payments, both `recurring: "true"` and `subscription_id` must be provided.

---

## 7. Step 4: Handle Postback (Webhook)

After the user completes payment, eZeePayments sends a POST request to your `post_back_url`.

### Postback Data Received

| Parameter | Description |
|-----------|-------------|
| `ResponseCode` | `1` = Success, any other number = Failure |
| `ResponseDescription` | `"Transaction is approved"` if success, otherwise error reason |
| `TransactionNumber` | Reference number for reconciliation with eZeePayments |

### Important Webhook Handling Rules

1. **Always verify `ResponseCode === 1`** before marking payment as successful
2. **Store `TransactionNumber`** for future reference and support inquiries
3. **Respond with HTTP 200** to acknowledge receipt
4. **Implement idempotency** - same transaction may be posted multiple times
5. **Update your database** with payment status before user redirect

---

## 8. Subscription Management

### Check Subscription Status

```
POST https://api-test.ezeepayments.com/v1/subscription/status/
```

**Request:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `TransactionNumber` | string | **Yes** | The transaction reference number |

**Response Messages:**
- `"Active"` - Subscription is active
- `"Cancelled by user"` - User cancelled the subscription
- `"Ended"` - Subscription has expired

### Cancel Subscription

```
POST https://api-test.ezeepayments.com/v1/subscription/cancel/
```

**Request:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `TransactionNumber` | string | **Yes** | The transaction reference number |

**Success Response:**
```json
{
  "result": {
    "status": 1,
    "message": "Cancel subscription was successful."
  }
}
```

---

## 9. TypeScript/JavaScript Implementation

### Types Definition

```typescript
// types/ezee-payments.ts

export interface EzeePaymentHeaders {
  licence_key: string;
  site: string;
}

export type SubscriptionFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';

export interface CreateSubscriptionRequest {
  amount: number;
  currency: 'JMD';
  frequency: SubscriptionFrequency;
  end_date?: string; // d/m/Y format
  description?: string;
  post_back_url?: string;
}

export interface CreateSubscriptionResponse {
  result: {
    status: 0 | 1;
    subscription_id?: string;
    message?: string | Record<string, string>;
  };
}

export interface GetTokenRequest {
  amount: number;
  currency: 'JMD';
  order_id: string;
  post_back_url: string;
  return_url: string;
  cancel_url: string;
}

export interface GetTokenResponse {
  result: {
    status: 0 | 1;
    token?: string;
    message?: string;
  };
}

export interface PaymentFormData {
  platform: 'custom';
  token: string;
  amount: number;
  currency: 'JMD';
  order_id: string;
  email_address: string;
  customer_name?: string;
  leave_note?: 0 | 1;
  request_address?: 0 | 1;
  request_phone?: 0 | 1;
  description?: string;
  recurring?: 'true' | 'false';
  subscription_id?: number;
}

export interface PostbackData {
  ResponseCode: string;
  ResponseDescription: string;
  TransactionNumber: string;
}

export interface SubscriptionStatusResponse {
  result: {
    status: 0 | 1;
    message: 'Active' | 'Cancelled by user' | 'Ended' | string;
  };
}
```

### API Client Class

```typescript
// lib/ezee-payments-client.ts

const EZEE_BASE_URL = process.env.EZEE_PAYMENTS_BASE_URL || 'https://api-test.ezeepayments.com';
const EZEE_SECURE_URL = process.env.EZEE_PAYMENTS_SECURE_URL || 'https://secure-test.ezeepayments.com';

export class EzeePaymentsClient {
  private headers: HeadersInit;

  constructor(licenceKey: string, site: string) {
    this.headers = {
      'licence_key': licenceKey,
      'site': site,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  private async request<T>(endpoint: string, data: Record<string, any>): Promise<T> {
    const formData = new URLSearchParams();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    const response = await fetch(`${EZEE_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: this.headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`eZeePayments API error: ${response.status}`);
    }

    return response.json();
  }

  // Step 1: Create Subscription
  async createSubscription(params: CreateSubscriptionRequest): Promise<CreateSubscriptionResponse> {
    return this.request('/v1/subscription/create/', params);
  }

  // Step 2: Get Payment Token
  async getToken(params: GetTokenRequest): Promise<GetTokenResponse> {
    return this.request('/v1/custom_token/', params);
  }

  // Check Subscription Status
  async getSubscriptionStatus(transactionNumber: string): Promise<SubscriptionStatusResponse> {
    return this.request('/v1/subscription/status/', { TransactionNumber: transactionNumber });
  }

  // Cancel Subscription
  async cancelSubscription(transactionNumber: string): Promise<SubscriptionStatusResponse> {
    return this.request('/v1/subscription/cancel/', { TransactionNumber: transactionNumber });
  }

  // Generate payment page URL with form data
  getPaymentPageUrl(): string {
    return EZEE_SECURE_URL;
  }
}
```

---

## 10. Supabase Edge Function Examples

### Create Subscription Edge Function

```typescript
// supabase/functions/ezee-create-subscription/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { amount, frequency, description, user_id, tier_id } = await req.json();

    // Validate frequency
    const validFrequencies = ['daily', 'weekly', 'monthly', 'quarterly', 'annually'];
    if (!validFrequencies.includes(frequency)) {
      throw new Error('Invalid frequency');
    }

    // Create subscription with eZeePayments
    const formData = new URLSearchParams({
      amount: String(amount),
      currency: 'JMD',
      frequency,
      description: description || '',
    });

    const response = await fetch('https://api-test.ezeepayments.com/v1/subscription/create/', {
      method: 'POST',
      headers: {
        'licence_key': Deno.env.get('EZEE_LICENCE_KEY')!,
        'site': Deno.env.get('EZEE_SITE')!,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const result = await response.json();

    if (result.result.status !== 1) {
      throw new Error(JSON.stringify(result.result.message));
    }

    // Store subscription in database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: dbError } = await supabase.from('subscriptions').insert({
      user_id,
      tier_id,
      ezee_subscription_id: result.result.subscription_id,
      amount,
      frequency,
      status: 'pending_payment',
    });

    if (dbError) throw dbError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        subscription_id: result.result.subscription_id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### Get Payment Token Edge Function

```typescript
// supabase/functions/ezee-get-token/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { amount, order_id } = await req.json();
    
    const baseUrl = Deno.env.get('APP_BASE_URL')!; // Your app's base URL

    const formData = new URLSearchParams({
      amount: String(amount),
      currency: 'JMD',
      order_id,
      post_back_url: `${baseUrl}/api/ezee-webhook`,
      return_url: `${baseUrl}/payment/success?order_id=${order_id}`,
      cancel_url: `${baseUrl}/payment/cancelled?order_id=${order_id}`,
    });

    const response = await fetch('https://api-test.ezeepayments.com/v1/custom_token/', {
      method: 'POST',
      headers: {
        'licence_key': Deno.env.get('EZEE_LICENCE_KEY')!,
        'site': Deno.env.get('EZEE_SITE')!,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const result = await response.json();

    if (result.result.status !== 1) {
      throw new Error(result.result.message);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        token: result.result.token,
        payment_url: 'https://secure-test.ezeepayments.com'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### Webhook Handler Edge Function

```typescript
// supabase/functions/ezee-webhook/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    // Parse form data from eZeePayments
    const formData = await req.formData();
    
    const responseCode = formData.get('ResponseCode');
    const responseDescription = formData.get('ResponseDescription');
    const transactionNumber = formData.get('TransactionNumber');
    const orderId = formData.get('order_id'); // If passed through

    console.log('Webhook received:', {
      responseCode,
      responseDescription,
      transactionNumber,
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const isSuccess = responseCode === '1';

    // Update payment record
    const { error } = await supabase
      .from('payments')
      .update({
        status: isSuccess ? 'completed' : 'failed',
        transaction_number: transactionNumber,
        response_description: responseDescription,
        processed_at: new Date().toISOString(),
      })
      .eq('order_id', orderId);

    if (error) {
      console.error('Database update error:', error);
    }

    // If recurring payment, update subscription status
    if (isSuccess) {
      await supabase
        .from('subscriptions')
        .update({ 
          status: 'active',
          last_payment_at: new Date().toISOString(),
        })
        .eq('order_id', orderId);
    }

    // Return 200 to acknowledge receipt
    return new Response('OK', { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Error', { status: 500 });
  }
});
```

---

## 11. React Native Integration

### Payment Form Component

```tsx
// components/EzeePaymentForm.tsx

import React, { useState } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { supabase } from '@/lib/supabase';

interface EzeePaymentFormProps {
  amount: number;
  orderId: string;
  email: string;
  customerName?: string;
  description?: string;
  recurring?: boolean;
  subscriptionId?: string;
  onSuccess: (transactionNumber: string) => void;
  onCancel: () => void;
  onError: (error: string) => void;
}

export function EzeePaymentForm({
  amount,
  orderId,
  email,
  customerName,
  description,
  recurring = false,
  subscriptionId,
  onSuccess,
  onCancel,
  onError,
}: EzeePaymentFormProps) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  React.useEffect(() => {
    initializePayment();
  }, []);

  const initializePayment = async () => {
    try {
      // Get token from your edge function
      const { data, error } = await supabase.functions.invoke('ezee-get-token', {
        body: { amount, order_id: orderId },
      });

      if (error || !data.success) {
        throw new Error(data?.error || 'Failed to initialize payment');
      }

      setToken(data.token);
      setPaymentUrl(data.payment_url);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePaymentHTML = () => {
    if (!token || !paymentUrl) return '';

    const formData: Record<string, string> = {
      platform: 'custom',
      token,
      amount: String(amount),
      currency: 'JMD',
      order_id: orderId,
      email_address: email,
    };

    if (customerName) formData.customer_name = customerName;
    if (description) formData.description = description;
    if (recurring) {
      formData.recurring = 'true';
      if (subscriptionId) formData.subscription_id = subscriptionId;
    }

    const formFields = Object.entries(formData)
      .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}" />`)
      .join('\n');

    return `
      <!DOCTYPE html>
      <html>
        <body onload="document.getElementById('paymentForm').submit()">
          <form id="paymentForm" method="POST" action="${paymentUrl}">
            ${formFields}
          </form>
          <p>Redirecting to payment page...</p>
        </body>
      </html>
    `;
  };

  const handleNavigationChange = (navState: any) => {
    const { url } = navState;
    
    // Check for success redirect
    if (url.includes('/payment/success')) {
      const urlParams = new URLSearchParams(url.split('?')[1]);
      const txnNumber = urlParams.get('transaction_number');
      onSuccess(txnNumber || '');
    }
    
    // Check for cancel redirect
    if (url.includes('/payment/cancelled')) {
      onCancel();
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <WebView
      source={{ html: generatePaymentHTML() }}
      onNavigationStateChange={handleNavigationChange}
      style={{ flex: 1 }}
      javaScriptEnabled={true}
      domStorageEnabled={true}
    />
  );
}
```

### Usage Example

```tsx
// screens/SubscriptionPaymentScreen.tsx

import React from 'react';
import { EzeePaymentForm } from '@/components/EzeePaymentForm';
import { router } from 'expo-router';

export default function SubscriptionPaymentScreen() {
  const handleSuccess = (transactionNumber: string) => {
    Alert.alert('Success', 'Payment completed successfully!');
    router.replace('/subscription/active');
  };

  const handleCancel = () => {
    Alert.alert('Cancelled', 'Payment was cancelled');
    router.back();
  };

  const handleError = (error: string) => {
    Alert.alert('Error', error);
  };

  return (
    <EzeePaymentForm
      amount={5000}
      orderId={`SUB-${Date.now()}`}
      email="user@example.com"
      customerName="John Doe"
      description="Monthly Premium Subscription"
      recurring={true}
      subscriptionId="39"
      onSuccess={handleSuccess}
      onCancel={handleCancel}
      onError={handleError}
    />
  );
}
```

---

## 12. Error Handling

### Common Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `"Request missing required parameters"` | Missing required field | Check all required fields are included |
| `"The Frequency can only be one of..."` | Invalid frequency value | Use: daily, weekly, monthly, quarterly, annually |
| `"Invalid licence_key"` | Wrong or missing licence key | Verify licence_key in headers |
| `"Site not registered"` | Site header mismatch | Ensure site matches registered domain |
| `ResponseCode !== 1` | Payment failed | Check ResponseDescription for details |

### Implementing Retry Logic

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      console.log(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  throw lastError!;
}

// Usage
const result = await withRetry(() => ezeeClient.createSubscription({
  amount: 5000,
  currency: 'JMD',
  frequency: 'monthly',
}));
```

---

## 13. Testing Checklist

### Before Going Live

- [ ] **Subscription Creation**
  - [ ] Create subscription with all frequency types
  - [ ] Verify subscription_id is returned and saved
  - [ ] Test with optional parameters (end_date, description)

- [ ] **Token Generation**
  - [ ] Generate token successfully
  - [ ] Verify all URLs are HTTPS
  - [ ] Test with missing parameters (expect error)

- [ ] **Payment Flow**
  - [ ] Complete successful payment
  - [ ] Test payment cancellation
  - [ ] Verify redirect to correct URLs

- [ ] **Webhook Handling**
  - [ ] Receive postback successfully
  - [ ] Handle ResponseCode = 1 (success)
  - [ ] Handle ResponseCode ≠ 1 (failure)
  - [ ] Store TransactionNumber correctly
  - [ ] Test idempotency (duplicate postbacks)

- [ ] **Subscription Management**
  - [ ] Check subscription status
  - [ ] Cancel subscription successfully
  - [ ] Handle already-cancelled subscription

- [ ] **Error Handling**
  - [ ] Invalid frequency error
  - [ ] Missing parameters error
  - [ ] Invalid credentials error
  - [ ] Network timeout handling

### Production Checklist

- [ ] Switch to production URLs:
  - [ ] `https://api.ezeepayments.com` (API)
  - [ ] `https://secure.ezeepayments.com` (Payment page)
- [ ] Use production licence_key
- [ ] Verify production site domain is registered
- [ ] Update all webhook URLs to production
- [ ] Remove test data from database
- [ ] Enable error alerting/monitoring

---

## Environment Variables Required

```env
# eZeePayments Configuration
EZEE_LICENCE_KEY=your_licence_key_here
EZEE_SITE=https://your-registered-domain.com
EZEE_PAYMENTS_BASE_URL=https://api-test.ezeepayments.com  # Change for production
EZEE_PAYMENTS_SECURE_URL=https://secure-test.ezeepayments.com  # Change for production

# Application URLs
APP_BASE_URL=https://your-app-domain.com

# Supabase (if using)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

---

## Quick Reference Card

```
┌────────────────────────────────────────────────────────────────┐
│                  eZeePayments Quick Reference                   │
├────────────────────────────────────────────────────────────────┤
│ HEADERS (Required for ALL requests):                           │
│   licence_key: YOUR_KEY                                        │
│   site: https://your-domain.com                                │
├────────────────────────────────────────────────────────────────┤
│ ENDPOINTS:                                                     │
│   Create Subscription: POST /v1/subscription/create/           │
│   Get Token:           POST /v1/custom_token/                  │
│   Payment Page:        POST https://secure-test.ezeepayments.com│
│   Check Status:        POST /v1/subscription/status/           │
│   Cancel:              POST /v1/subscription/cancel/           │
├────────────────────────────────────────────────────────────────┤
│ FREQUENCIES: daily | weekly | monthly | quarterly | annually   │
├────────────────────────────────────────────────────────────────┤
│ CURRENCY: JMD (only supported currency)                        │
├────────────────────────────────────────────────────────────────┤
│ WEBHOOK RESPONSE:                                              │
│   ResponseCode = 1 → Success                                   │
│   ResponseCode ≠ 1 → Failure (check ResponseDescription)       │
└────────────────────────────────────────────────────────────────┘
```

---

*Last Updated: Based on eZeePayments API Documentation - April 2024*
