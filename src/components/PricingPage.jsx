import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { 
  Check, X, Zap, TrendingUp, Building2, Crown, 
  Users, FileText, Bot, Palette, Mail, Phone,
  Shield, Clock, ArrowRight, Sparkles, Star, Upload
} from "lucide-react";

export function PricingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, loginWithRedirect, user, getAccessTokenSilently } = useAuth0();
  const [billingCycle, setBillingCycle] = useState("annual");
  const [processingPlan, setProcessingPlan] = useState(null);

  // Pricing data - All features consistent across cards and comparison table
  const plans = {
    free: {
      name: "Free",
      icon: FileText,
      color: "slate",
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
      popular: false
    },
    professional: {
      name: "Professional",
      icon: TrendingUp,
      color: "blue",
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
      badge: "Most Popular"
    },
    business: {
      name: "Business",
      icon: Building2,
      color: "purple",
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
      popular: false
    },
    enterprise: {
      name: "Enterprise",
      icon: Crown,
      color: "amber",
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
      badge: "Premium"
    }
  };

  // Calculate savings
  const getSavings = (plan) => {
    if (!plan.monthlyPrice || !plan.annualPrice) return null;
    const monthlyCost = plan.monthlyPrice * 12;
    const annualCost = plan.annualPrice * 12;
    const savings = monthlyCost - annualCost;
    const percentage = Math.round((savings / monthlyCost) * 100);
    return { amount: savings, percentage };
  };

  // Handle plan selection with per-plan processing state
  const handleSelectPlan = async (planKey) => {
    if (planKey === "free") {
      if (!isAuthenticated) {
        loginWithRedirect();
      } else {
        navigate('/');
      }
      return;
    }

    if (planKey === "enterprise") {
      window.location.href = "mailto:sales@finsight.com?subject=Enterprise Plan Inquiry";
      return;
    }

    setProcessingPlan(planKey);

    try {
      const token = await getAccessTokenSilently();
      
      const apiUrl = process.env.REACT_APP_API_URL || 'https://api.finsight.salesmasterjm.com';
      
      const response = await fetch(`${apiUrl}/api/payments/create-checkout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          planKey, 
          billingCycle
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await response.json();
      
      // Validate payment URL for security
      if (!data.paymentUrl || !data.paymentUrl.includes('ezeepayments')) {
        throw new Error('Invalid payment URL received');
      }
      
      // Create form and submit to EzeePayments
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = data.paymentUrl;
      
      const fields = {
        platform: 'custom',
        token: data.token,
        amount: data.amount,
        currency: 'USD',
        order_id: data.orderId,
        email_address: user?.email || '',
        customer_name: user?.name || '',
        recurring: 'false'
      };
      
      Object.entries(fields).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });
      
      document.body.appendChild(form);
      form.submit();
      
    } catch (error) {
      console.error("Checkout error:", error);
      setProcessingPlan(null);
      alert("Something went wrong. Please try again or contact support.");
    }
  };

  // Get color classes
  const getColorClasses = (color) => {
    const colors = {
      slate: {
        bg: "from-slate-500 to-slate-600",
        border: "border-slate-200",
        text: "text-slate-700",
        badge: "bg-slate-100 text-slate-700 border-slate-300"
      },
      blue: {
        bg: "from-blue-500 to-blue-600",
        border: "border-blue-300",
        text: "text-blue-700",
        badge: "bg-blue-100 text-blue-700 border-blue-300"
      },
      purple: {
        bg: "from-purple-500 to-purple-600",
        border: "border-purple-300",
        text: "text-purple-700",
        badge: "bg-purple-100 text-purple-700 border-purple-300"
      },
      amber: {
        bg: "from-amber-500 to-amber-600",
        border: "border-amber-300",
        text: "text-amber-700",
        badge: "bg-amber-100 text-amber-700 border-amber-300"
      }
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/favicon.ico" 
              alt="FinSight Logo" 
              className="w-10 h-10"
            />
            <span className="text-xl font-bold text-slate-800">FinSight</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold"
                >
                  Dashboard
                </button>
                <button
                  onClick={() => navigate('/profile')}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold"
                >
                  Profile
                </button>
              </>
            ) : (
              <button
                onClick={() => loginWithRedirect()}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-md"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold mb-6">
          <Star className="w-4 h-4" />
          Trusted by 500+ financial professionals
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-slate-800 mb-6">
          Choose Your <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-transparent bg-clip-text">Perfect Plan</span>
        </h1>
        <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-8">
          Professional credit analysis and financial modeling tools designed for analysts, firms, and institutions. Start free, upgrade anytime.
        </p>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm font-semibold ${billingCycle === 'monthly' ? 'text-slate-800' : 'text-slate-500'}`}>
            Monthly
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
            className="relative w-16 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all shadow-md"
            aria-label={`Switch to ${billingCycle === 'monthly' ? 'annual' : 'monthly'} billing`}
          >
            <div className={`absolute top-1 ${billingCycle === 'annual' ? 'left-9' : 'left-1'} w-6 h-6 bg-white rounded-full transition-all shadow-md`} />
          </button>
          <span className={`text-sm font-semibold ${billingCycle === 'annual' ? 'text-slate-800' : 'text-slate-500'}`}>
            Annual
          </span>
          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
            Save up to 20%
          </span>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.entries(plans).map(([key, plan]) => {
            const colors = getColorClasses(plan.color);
            const savings = getSavings(plan);
            const price = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
            const Icon = plan.icon;
            const isProcessing = processingPlan === key;
            const anyProcessing = processingPlan !== null;

            return (
              <div
                key={key}
                className={`relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 ${
                  plan.popular ? 'ring-2 ring-blue-500 transform lg:scale-105' : 'border border-slate-200'
                }`}
              >
                {/* Popular Badge */}
                {plan.badge && (
                  <div className={`absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold border-2 ${colors.badge}`}>
                    {plan.badge}
                  </div>
                )}

                <div className="p-6">
                  {/* Icon & Name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 bg-gradient-to-br ${colors.bg} rounded-xl flex items-center justify-center shadow-md`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">{plan.name}</h3>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-slate-600 mb-6">{plan.description}</p>

                  {/* Price */}
                  <div className="mb-6">
                    {price !== null ? (
                      <>
                        <div className="flex items-baseline gap-2">
                          <span className="text-4xl font-bold text-slate-800">${price}</span>
                          <span className="text-slate-600">/month</span>
                        </div>
                        {billingCycle === 'annual' && price > 0 && (
                          <>
                            <p className="text-xs text-slate-500 mt-1">
                              ${price * 12}/year billed annually
                            </p>
                            {savings && (
                              <p className="text-sm text-green-600 font-semibold mt-1">
                                Save ${savings.amount}/year ({savings.percentage}% off)
                              </p>
                            )}
                          </>
                        )}
                        {billingCycle === 'monthly' && price > 0 && (
                          <p className="text-xs text-slate-500 mt-1">
                            Billed monthly
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="text-3xl font-bold text-slate-800">Custom</div>
                    )}
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleSelectPlan(key)}
                    disabled={anyProcessing}
                    className={`w-full py-3 px-4 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                      plan.popular
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700'
                        : 'bg-white border-2 border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {isProcessing ? (
                      'Processing...'
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        {plan.cta}
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    )}
                  </button>

                  {/* Features List */}
                  <div className="mt-6 space-y-3">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        {feature.included ? (
                          <Check className={`w-5 h-5 flex-shrink-0 mt-0.5 ${feature.highlight ? 'text-green-600' : 'text-blue-600'}`} />
                        ) : (
                          <X className="w-5 h-5 text-slate-300 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={`text-sm ${feature.included ? (feature.highlight ? 'text-slate-800 font-semibold' : 'text-slate-700') : 'text-slate-400'}`}>
                          {feature.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="max-w-7xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-slate-800 text-center mb-12">
          Detailed Feature Comparison
        </h2>
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-blue-50 to-purple-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-bold text-slate-800">Features</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-slate-800">Free</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-blue-700">Professional</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-purple-700">Business</th>
                  <th className="px-6 py-4 text-center text-sm font-bold text-amber-700">Enterprise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <ComparisonRow feature="Users" values={["1", "1", "5 (+$35 per extra)", "Unlimited"]} />
                <ComparisonRow feature="Reports per month" values={["3", "25", "400", "Unlimited"]} />
                <ComparisonRow feature="Statement uploads per month" values={["4", "50", "200", "Unlimited"]} />
                <ComparisonRow feature="Storage (total)" values={["100 MB", "1 GB", "2 GB", "5 GB"]} />
                <ComparisonRow feature="AI Analysis" values={[false, "100 queries/month", "500 queries/month", "Unlimited"]} />
                <ComparisonRow feature="Custom Branding" values={[false, true, true, true]} />
                <ComparisonRow feature="Excel Exports" values={[false, true, true, true]} />
                <ComparisonRow feature="Team Collaboration" values={[false, false, true, true]} />
                <ComparisonRow feature="API Access" values={[false, false, true, true]} />
                <ComparisonRow feature="SSO / SAML" values={[false, false, false, true]} />
                <ComparisonRow feature="Dedicated Account Manager" values={[false, false, false, true]} />
                <ComparisonRow feature="SLA Guarantee" values={[false, false, false, true]} />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-3xl font-bold text-slate-800 text-center mb-12">
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
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Ready to Transform Your Credit Analysis?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join hundreds of analysts who've accelerated their workflow by 10x
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => handleSelectPlan('professional')}
              disabled={processingPlan !== null}
              className="px-8 py-4 bg-white text-blue-600 rounded-lg font-bold text-lg hover:bg-blue-50 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processingPlan === 'professional' ? 'Processing...' : 'Get Started'}
            </button>
            <button
              onClick={() => window.location.href = "mailto:sales@finsight.com?subject=Enterprise Inquiry"}
              className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-lg font-bold text-lg hover:bg-white/10 transition-all"
            >
              Contact Sales
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">FinSight</span>
              </div>
              <p className="text-sm text-slate-400">
                Professional credit analysis and financial modeling for modern analysts.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
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
          <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm text-slate-400">
            © 2025 FinSight. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function ComparisonRow({ feature, values }) {
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-6 py-4 text-sm font-medium text-slate-700">{feature}</td>
      {values.map((value, idx) => (
        <td key={idx} className="px-6 py-4 text-center">
          {typeof value === 'boolean' ? (
            value ? (
              <Check className="w-5 h-5 text-green-600 mx-auto" />
            ) : (
              <X className="w-5 h-5 text-slate-300 mx-auto" />
            )
          ) : (
            <span className="text-sm text-slate-700">{value}</span>
          )}
        </td>
      ))}
    </tr>
  );
}

function FAQItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-slate-800">{question}</span>
        <ArrowRight className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-6 pb-4 text-slate-600">
          {answer}
        </div>
      )}
    </div>
  );
}

export default PricingPage;