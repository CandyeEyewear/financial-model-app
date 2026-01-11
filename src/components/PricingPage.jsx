/**
 * PricingPage Component
 * Subscription plans with EzeePay integration
 * Uses Supabase authentication via AuthContext
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Card, CardContent } from "./Card";
import { Button } from "./Button";
import {
  Check,
  X,
  Zap,
  TrendingUp,
  Building2,
  Crown,
  FileText,
  Mail,
  Phone,
  ArrowRight,
  Sparkles,
  Star,
  ArrowLeft,
  User,
  Loader2,
  Shield,
} from "lucide-react";

/**
 * Pricing plans configuration
 */
const PLANS = {
  free: {
    name: "Free",
    icon: FileText,
    color: "neutral",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Perfect for trying out FinSight",
    features: [
      { text: "1 user", included: true },
      { text: "3 reports per month", included: true },
      { text: "4 statement uploads per month", included: true },
      { text: "100 MB storage (total)", included: true },
      { text: "Basic financial projections", included: true },
      { text: "PDF exports (watermarked)", included: true },
      { text: "AI analysis", included: false },
      { text: "Custom branding", included: false },
      { text: "Excel exports", included: false },
      { text: "Priority support", included: false },
    ],
    cta: "Get Started Free",
    popular: false,
  },
  professional: {
    name: "Professional",
    icon: TrendingUp,
    color: "primary",
    monthlyPrice: 99,
    annualPrice: 79,
    description: "For solo analysts and consultants",
    features: [
      { text: "1 user", included: true },
      { text: "25 reports per month", included: true },
      { text: "50 statement uploads per month", included: true },
      { text: "1 GB storage (total)", included: true },
      { text: "Full financial modeling", included: true },
      { text: "AI credit analysis (100 queries/month)", included: true },
      { text: "Custom branding (logo + colors)", included: true },
      { text: "PDF + Excel exports", included: true },
      { text: "Priority email support", included: true },
    ],
    cta: "Get Started",
    popular: true,
    badge: "Most Popular",
  },
  business: {
    name: "Business",
    icon: Building2,
    color: "info",
    monthlyPrice: 299,
    annualPrice: 249,
    description: "For teams and growing firms",
    features: [
      { text: "5 users included", included: true, highlight: true },
      { text: "Additional users at $35/month each", included: true },
      { text: "400 reports per month", included: true, highlight: true },
      { text: "200 statement uploads per month", included: true },
      { text: "2 GB storage (total)", included: true },
      { text: "500 AI queries per month", included: true, highlight: true },
      { text: "Team collaboration", included: true },
      { text: "Shared report templates", included: true },
      { text: "Company-wide branding", included: true },
      { text: "Priority support + API access", included: true },
    ],
    cta: "Get Started",
    popular: false,
  },
  enterprise: {
    name: "Enterprise",
    icon: Crown,
    color: "warning",
    monthlyPrice: null,
    annualPrice: null,
    description: "For large institutions",
    features: [
      { text: "Unlimited users", included: true, highlight: true },
      { text: "Unlimited reports per month", included: true },
      { text: "Unlimited statement uploads per month", included: true },
      { text: "5 GB storage (total)", included: true },
      { text: "Unlimited AI queries per month", included: true },
      { text: "Dedicated account manager", included: true },
      { text: "Custom integrations", included: true },
      { text: "White-label option", included: true },
      { text: "SSO / SAML authentication", included: true },
      { text: "On-premise deployment", included: true },
      { text: "SLA guarantees + training", included: true },
    ],
    cta: "Contact Sales",
    popular: false,
    badge: "Premium",
  },
};

/**
 * Get color classes for plan cards
 */
function getColorClasses(color) {
  const colors = {
    neutral: {
      bg: "from-neutral-500 to-neutral-600",
      border: "border-neutral-200 dark:border-neutral-700",
      text: "text-neutral-700 dark:text-neutral-300",
      badge: "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300",
      ring: "ring-neutral-400",
    },
    primary: {
      bg: "from-primary-500 to-primary-600",
      border: "border-primary-300 dark:border-primary-700",
      text: "text-primary-700 dark:text-primary-300",
      badge: "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300",
      ring: "ring-primary-500",
    },
    info: {
      bg: "from-info-500 to-info-600",
      border: "border-info-300 dark:border-info-700",
      text: "text-info-700 dark:text-info-300",
      badge: "bg-info-100 dark:bg-info-900/30 text-info-700 dark:text-info-300",
      ring: "ring-info-500",
    },
    warning: {
      bg: "from-warning-500 to-warning-600",
      border: "border-warning-300 dark:border-warning-700",
      text: "text-warning-700 dark:text-warning-300",
      badge: "bg-warning-100 dark:bg-warning-900/30 text-warning-700 dark:text-warning-300",
      ring: "ring-warning-500",
    },
  };
  return colors[color] || colors.primary;
}

/**
 * Calculate savings for annual billing
 */
function getSavings(plan) {
  if (!plan.monthlyPrice || !plan.annualPrice) return null;
  const monthlyCost = plan.monthlyPrice * 12;
  const annualCost = plan.annualPrice * 12;
  const savings = monthlyCost - annualCost;
  const percentage = Math.round((savings / monthlyCost) * 100);
  return { amount: savings, percentage };
}

/**
 * Comparison table row component
 */
function ComparisonRow({ feature, values }) {
  return (
    <tr className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
      <td className="px-6 py-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {feature}
      </td>
      {values.map((value, idx) => (
        <td key={idx} className="px-6 py-4 text-center">
          {typeof value === "boolean" ? (
            value ? (
              <Check className="w-5 h-5 text-success-600 dark:text-success-400 mx-auto" />
            ) : (
              <X className="w-5 h-5 text-neutral-300 dark:text-neutral-600 mx-auto" />
            )
          ) : (
            <span className="text-sm text-neutral-700 dark:text-neutral-300">{value}</span>
          )}
        </td>
      ))}
    </tr>
  );
}

/**
 * FAQ item component
 */
function FAQItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-neutral-900 dark:text-neutral-100">{question}</span>
        <ArrowRight
          className={`w-5 h-5 text-neutral-400 dark:text-neutral-500 transition-transform ${
            isOpen ? "rotate-90" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-6 pb-4 text-neutral-600 dark:text-neutral-400">{answer}</div>
      )}
    </Card>
  );
}

/**
 * Main PricingPage Component
 */
export function PricingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, userProfile, session, signIn } = useAuth();
  const [billingCycle, setBillingCycle] = useState("annual");
  const [processingPlan, setProcessingPlan] = useState(null);

  // Current user's plan
  const currentPlan = userProfile?.tier || "free";

  /**
   * Handle plan selection with EzeePay integration
   */
  const handleSelectPlan = async (planKey) => {
    // Free plan - just navigate
    if (planKey === "free") {
      if (!isAuthenticated) {
        navigate("/auth");
      } else {
        navigate("/");
      }
      return;
    }

    // Enterprise - contact sales
    if (planKey === "enterprise") {
      window.location.href = "mailto:sales@finsight.com?subject=Enterprise Plan Inquiry";
      return;
    }

    // If not authenticated, redirect to auth first
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }

    // If already on this plan, go to profile
    if (currentPlan === planKey) {
      navigate("/profile");
      return;
    }

    setProcessingPlan(planKey);

    try {
      const accessToken = session?.access_token;

      if (!accessToken) {
        throw new Error("No access token available. Please sign in again.");
      }

      const apiUrl = process.env.REACT_APP_API_URL || "";

      const response = await fetch(`${apiUrl}/api/payments/create-checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          planKey,
          billingCycle,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create checkout session");
      }

      const data = await response.json();

      // Validate payment URL for security
      if (!data.paymentUrl || !data.paymentUrl.includes("ezeepayments")) {
        throw new Error("Invalid payment URL received");
      }

      // Create form and submit to EzeePayments
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.paymentUrl;

      const fields = {
        platform: "custom",
        token: data.token,
        amount: data.amount,
        currency: data.currency || "USD",
        order_id: data.orderId,
        email_address: user?.email || "",
        customer_name: userProfile?.name || user?.email?.split("@")[0] || "",
        recurring: data.recurring ? "true" : "false",
        subscription_id: data.subscriptionId || "",
      };

      Object.entries(fields).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      console.error("Checkout error:", error);
      setProcessingPlan(null);
      alert(error.message || "Something went wrong. Please try again or contact support.");
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <header className="sticky top-0 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-md border-b border-neutral-200 dark:border-neutral-700 z-sticky">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} leftIcon={ArrowLeft}>
              Back
            </Button>
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                FinSight
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
                  Dashboard
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/profile")} leftIcon={User}>
                  Profile
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate("/auth")} leftIcon={User}>
                Sign In
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-semibold mb-6">
          <Star className="w-4 h-4" />
          Trusted by 500+ financial professionals
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-neutral-900 dark:text-neutral-100 mb-6">
          Choose Your{" "}
          <span className="bg-gradient-to-r from-primary-600 to-info-600 text-transparent bg-clip-text">
            Perfect Plan
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-neutral-600 dark:text-neutral-400 max-w-3xl mx-auto mb-8">
          Professional credit analysis and financial modeling tools designed for analysts, firms,
          and institutions. Start free, upgrade anytime.
        </p>

        {/* Current Plan Badge (if authenticated) */}
        {isAuthenticated && currentPlan && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 rounded-full text-sm font-semibold mb-8">
            <Shield className="w-4 h-4" />
            Current Plan: {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
          </div>
        )}

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span
            className={`text-sm font-semibold ${
              billingCycle === "monthly"
                ? "text-neutral-900 dark:text-neutral-100"
                : "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            Monthly
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
            className="relative w-16 h-8 bg-gradient-to-r from-primary-500 to-info-600 rounded-full transition-all shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            aria-label={`Switch to ${billingCycle === "monthly" ? "annual" : "monthly"} billing`}
          >
            <div
              className={`absolute top-1 ${
                billingCycle === "annual" ? "left-9" : "left-1"
              } w-6 h-6 bg-white rounded-full transition-all shadow-md`}
            />
          </button>
          <span
            className={`text-sm font-semibold ${
              billingCycle === "annual"
                ? "text-neutral-900 dark:text-neutral-100"
                : "text-neutral-500 dark:text-neutral-400"
            }`}
          >
            Annual
          </span>
          <span className="px-3 py-1 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-300 text-xs font-bold rounded-full">
            Save up to 20%
          </span>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(PLANS).map(([key, plan]) => {
            const colors = getColorClasses(plan.color);
            const savings = getSavings(plan);
            const price = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
            const Icon = plan.icon;
            const isProcessing = processingPlan === key;
            const anyProcessing = processingPlan !== null;
            const isCurrentPlan = currentPlan === key;

            return (
              <Card
                key={key}
                className={`relative overflow-visible ${
                  plan.popular
                    ? "ring-2 ring-primary-500 dark:ring-primary-400 transform lg:scale-105 z-10"
                    : ""
                } ${isCurrentPlan ? "ring-2 ring-success-500 dark:ring-success-400" : ""}`}
              >
                {/* Badge */}
                {(plan.badge || isCurrentPlan) && (
                  <div
                    className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold ${
                      isCurrentPlan
                        ? "bg-success-100 dark:bg-success-900/50 text-success-700 dark:text-success-300 border border-success-300 dark:border-success-700"
                        : colors.badge + " border " + colors.border
                    }`}
                  >
                    {isCurrentPlan ? "Current Plan" : plan.badge}
                  </div>
                )}

                <CardContent padding="lg">
                  {/* Icon & Name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-12 h-12 bg-gradient-to-br ${colors.bg} rounded-xl flex items-center justify-center shadow-md`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                        {plan.name}
                      </h3>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
                    {plan.description}
                  </p>

                  {/* Price */}
                  <div className="mb-6">
                    {price !== null ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-neutral-900 dark:text-neutral-100">
                            ${price}
                          </span>
                          <span className="text-neutral-600 dark:text-neutral-400">/month</span>
                        </div>
                        {billingCycle === "annual" && price > 0 && (
                          <>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                              ${price * 12}/year billed annually
                            </p>
                            {savings && (
                              <p className="text-sm text-success-600 dark:text-success-400 font-semibold mt-1">
                                Save ${savings.amount}/year ({savings.percentage}% off)
                              </p>
                            )}
                          </>
                        )}
                        {billingCycle === "monthly" && price > 0 && (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            Billed monthly
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
                        Custom
                      </div>
                    )}
                  </div>

                  {/* CTA Button */}
                  <Button
                    onClick={() => handleSelectPlan(key)}
                    disabled={anyProcessing || isCurrentPlan}
                    loading={isProcessing}
                    variant={plan.popular ? "primary" : "secondary"}
                    fullWidth
                    rightIcon={!isProcessing && !isCurrentPlan ? ArrowRight : undefined}
                  >
                    {isCurrentPlan ? "Current Plan" : plan.cta}
                  </Button>

                  {/* Features List */}
                  <div className="mt-6 space-y-3">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        {feature.included ? (
                          <Check
                            className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                              feature.highlight
                                ? "text-success-600 dark:text-success-400"
                                : "text-primary-600 dark:text-primary-400"
                            }`}
                          />
                        ) : (
                          <X className="w-5 h-5 text-neutral-300 dark:text-neutral-600 flex-shrink-0 mt-0.5" />
                        )}
                        <span
                          className={`text-sm ${
                            feature.included
                              ? feature.highlight
                                ? "text-neutral-900 dark:text-neutral-100 font-semibold"
                                : "text-neutral-700 dark:text-neutral-300"
                              : "text-neutral-400 dark:text-neutral-500"
                          }`}
                        >
                          {feature.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 text-center mb-12">
          Detailed Feature Comparison
        </h2>
        <Card variant="elevated" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-primary-50 to-info-50 dark:from-primary-900/20 dark:to-info-900/20">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    Features
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    Free
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-primary-700 dark:text-primary-400">
                    Professional
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-info-700 dark:text-info-400">
                    Business
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-warning-700 dark:text-warning-400">
                    Enterprise
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                <ComparisonRow feature="Users" values={["1", "1", "5 (+$35 per extra)", "Unlimited"]} />
                <ComparisonRow feature="Reports per month" values={["3", "25", "400", "Unlimited"]} />
                <ComparisonRow
                  feature="Statement uploads per month"
                  values={["4", "50", "200", "Unlimited"]}
                />
                <ComparisonRow feature="Storage (total)" values={["100 MB", "1 GB", "2 GB", "5 GB"]} />
                <ComparisonRow
                  feature="AI Analysis"
                  values={[false, "100 queries/month", "500 queries/month", "Unlimited"]}
                />
                <ComparisonRow feature="Custom Branding" values={[false, true, true, true]} />
                <ComparisonRow feature="Excel Exports" values={[false, true, true, true]} />
                <ComparisonRow feature="Team Collaboration" values={[false, false, true, true]} />
                <ComparisonRow feature="API Access" values={[false, false, true, true]} />
                <ComparisonRow feature="SSO / SAML" values={[false, false, false, true]} />
                <ComparisonRow
                  feature="Dedicated Account Manager"
                  values={[false, false, false, true]}
                />
                <ComparisonRow feature="SLA Guarantee" values={[false, false, false, true]} />
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 text-center mb-12">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          <FAQItem
            question="Can I try before I buy?"
            answer="Yes! Start with our Free plan to explore FinSight. It includes 3 reports per month, 4 statement uploads, and all basic features. Upgrade anytime when you're ready for more."
          />
          <FAQItem
            question="Can I change plans later?"
            answer="Absolutely! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle."
          />
          <FAQItem
            question="What happens if I exceed my limits?"
            answer="On the Free plan, you'll need to upgrade to continue. Professional and Business users will receive a notification when approaching their limits and can upgrade as needed."
          />
          <FAQItem
            question="How does team billing work?"
            answer="Business plans include 5 users. Additional team members are $35/month each (or $420/year if on annual billing), prorated to your billing cycle."
          />
          <FAQItem
            question="Do you offer refunds?"
            answer="Yes! We offer a 30-day money-back guarantee on all paid plans. If you're not satisfied within 30 days of purchase, contact us for a full refund—no questions asked."
          />
          <FAQItem
            question="Is my data secure?"
            answer="Absolutely. We use bank-level encryption, secure AWS hosting, and never share your data with third parties. Enterprise plans include additional security features like SSO and on-premise deployment."
          />
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-primary-600 to-info-600 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Transform Your Credit Analysis?
          </h2>
          <p className="text-lg sm:text-xl text-primary-100 mb-8">
            Join hundreds of analysts who've accelerated their workflow by 10x
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => handleSelectPlan("professional")}
              disabled={processingPlan !== null}
              loading={processingPlan === "professional"}
              variant="secondary"
              size="lg"
              className="bg-white text-primary-600 hover:bg-primary-50"
            >
              Get Started
            </Button>
            <Button
              onClick={() =>
                (window.location.href = "mailto:sales@finsight.com?subject=Enterprise Inquiry")
              }
              variant="ghost"
              size="lg"
              className="text-white border-2 border-white hover:bg-white/10"
            >
              Contact Sales
            </Button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-neutral-900 text-neutral-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-info-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">FinSight</span>
              </div>
              <p className="text-sm text-neutral-400">
                Professional credit analysis and financial modeling for modern analysts.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button
                    onClick={() => navigate("/")}
                    className="hover:text-white transition-colors"
                  >
                    Features
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate("/pricing")}
                    className="hover:text-white transition-colors"
                  >
                    Pricing
                  </button>
                </li>
                <li>
                  <button className="hover:text-white transition-colors">Security</button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <button className="hover:text-white transition-colors">About</button>
                </li>
                <li>
                  <button className="hover:text-white transition-colors">Blog</button>
                </li>
                <li>
                  <button className="hover:text-white transition-colors">Careers</button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Contact</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  sales@finsight.com
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  +1 (876) 555-0100
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-neutral-800 mt-8 pt-8 text-center text-sm text-neutral-400">
            © {new Date().getFullYear()} FinSight. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default PricingPage;
