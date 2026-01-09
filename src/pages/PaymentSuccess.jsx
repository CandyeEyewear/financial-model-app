/**
 * PaymentSuccess Page
 * Displayed after successful EzeePay payment
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "../components/Card";
import { Button } from "../components/Button";
import { CheckCircle, ArrowRight, Loader2, Sparkles } from "lucide-react";

export function PaymentSuccess() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          navigate("/profile");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-success-50 via-primary-50 to-neutral-50 dark:from-success-950 dark:via-primary-950 dark:to-neutral-900 flex items-center justify-center p-4 sm:p-6">
      <Card variant="elevated" className="max-w-md w-full text-center">
        <CardContent padding="lg">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-gradient-to-br from-success-400 to-success-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <CheckCircle className="w-12 h-12 text-white" />
          </div>

          {/* Title */}
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center justify-center gap-2">
            Payment Successful!
            <Sparkles className="w-6 h-6 text-warning-500" />
          </h1>

          {/* Description */}
          <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-6">
            Your account has been upgraded. You now have access to all premium features!
          </p>

          {/* Countdown */}
          <div className="bg-primary-50 dark:bg-primary-900/30 border-2 border-primary-200 dark:border-primary-800 rounded-card p-4 mb-6">
            <p className="text-sm text-primary-800 dark:text-primary-200 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirecting to your profile in {countdown} seconds...
            </p>
          </div>

          {/* CTA Button */}
          <Button
            onClick={() => navigate("/profile")}
            fullWidth
            size="lg"
            rightIcon={ArrowRight}
          >
            Go to Profile Now
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default PaymentSuccess;
