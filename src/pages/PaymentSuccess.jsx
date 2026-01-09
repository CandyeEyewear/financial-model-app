import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, ArrowRight, Loader } from "lucide-react";

export function PaymentSuccess() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          navigate('/profile');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-white" />
        </div>
        
        <h1 className="text-3xl font-bold text-slate-800 mb-3">
          Payment Successful! 🎉
        </h1>
        
        <p className="text-lg text-slate-600 mb-6">
          Your account has been upgraded. You now have access to all premium features!
        </p>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <Loader className="w-4 h-4 inline animate-spin mr-2" />
            Redirecting to your profile in {countdown} seconds...
          </p>
        </div>

        <button
          onClick={() => navigate('/profile')}
          className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg flex items-center justify-center gap-2"
        >
          Go to Profile Now
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default PaymentSuccess;