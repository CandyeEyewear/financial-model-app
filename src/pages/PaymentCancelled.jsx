import React from "react";
import { useNavigate } from "react-router-dom";
import { XCircle, ArrowLeft, CreditCard } from "lucide-react";

export function PaymentCancelled() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle className="w-12 h-12 text-white" />
        </div>
        
        <h1 className="text-3xl font-bold text-slate-800 mb-3">
          Payment Cancelled
        </h1>
        
        <p className="text-lg text-slate-600 mb-6">
          Your payment was cancelled. No charges were made to your account.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/pricing')}
            className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            Try Again
          </button>

          <button
            onClick={() => navigate('/')}
            className="w-full py-3 px-6 bg-white border-2 border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentCancelled;