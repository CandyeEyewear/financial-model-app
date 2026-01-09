/**
 * PaymentCancelled Page
 * Displayed when user cancels EzeePay payment
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../components/Card";
import { Button } from "../components/Button";
import { XCircle, ArrowLeft, CreditCard } from "lucide-react";

export function PaymentCancelled() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-danger-50 via-warning-50 to-neutral-50 dark:from-danger-950 dark:via-warning-950 dark:to-neutral-900 flex items-center justify-center p-4 sm:p-6">
      <Card variant="elevated" className="max-w-md w-full text-center">
        <CardContent padding="lg">
          {/* Cancel Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-warning-400 to-danger-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <XCircle className="w-12 h-12 text-white" />
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
            Payment Cancelled
          </h1>

          {/* Description */}
          <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-8">
            Your payment was cancelled. No charges were made to your account.
          </p>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => navigate("/pricing")}
              fullWidth
              size="lg"
              leftIcon={CreditCard}
            >
              Try Again
            </Button>

            <Button
              onClick={() => navigate("/")}
              variant="secondary"
              fullWidth
              size="lg"
              leftIcon={ArrowLeft}
            >
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PaymentCancelled;
