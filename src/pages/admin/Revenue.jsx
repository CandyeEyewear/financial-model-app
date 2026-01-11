import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOutletContext } from 'react-router-dom';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  Calendar,
  AlertCircle
} from 'lucide-react';

export default function AdminRevenue() {
  const { session } = useAuth();
  const { adminRole } = useOutletContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRevenue();
  }, [period]);

  const fetchRevenue = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/revenue?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch revenue');

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `J$${(amount || 0).toLocaleString()}`;
  };

  if (adminRole !== 'super_admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Super admin access required</p>
        </div>
      </div>
    );
  }

  const { summary, subscriptions, charts } = data || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Revenue Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">Financial overview and analytics</p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Revenue Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(summary?.grossRevenue)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Gross Revenue</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(summary?.totalCosts)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Costs</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(summary?.netRevenue)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Net Revenue</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <PieChart className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
                {summary?.profitMargin || 0}%
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Profit Margin</p>
            </div>
          </div>

          {/* MRR Card */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100">Monthly Recurring Revenue (MRR)</p>
                <p className="text-4xl font-bold mt-2">{formatCurrency(summary?.mrr)}</p>
              </div>
              <div className="text-right">
                <p className="text-blue-100">Active Subscriptions</p>
                <p className="text-3xl font-bold mt-2">{subscriptions?.total || 0}</p>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue Trend</h2>
              <div className="h-64 flex items-end gap-1">
                {(charts?.revenueByDay || []).slice(-14).map((day, i) => {
                  const maxRevenue = Math.max(...(charts?.revenueByDay || []).map(d => d.amount || 0), 1);
                  const height = maxRevenue > 0 ? ((day.amount || 0) / maxRevenue) * 100 : 0;

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div
                        className="w-full bg-blue-500 dark:bg-blue-600 rounded-t transition-all hover:bg-blue-600 dark:hover:bg-blue-500"
                        style={{ height: `${Math.max(height, 2)}%`, minHeight: '4px' }}
                        title={`${day.date}: ${formatCurrency(day.amount)}`}
                      />
                      <span className="text-xs text-gray-400 mt-1 rotate-45 origin-left">
                        {day.date?.slice(-2)}
                      </span>
                    </div>
                  );
                })}
                {(!charts?.revenueByDay || charts.revenueByDay.length === 0) && (
                  <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                    No revenue data for this period
                  </div>
                )}
              </div>
            </div>

            {/* Costs Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Costs Breakdown</h2>
              <div className="space-y-4">
                {(charts?.costsByType || []).length > 0 ? (
                  charts.costsByType.map((cost, i) => {
                    const total = summary?.totalCosts || 1;
                    const percentage = ((cost.amount / total) * 100).toFixed(1);

                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium capitalize text-gray-700 dark:text-gray-300">
                            {(cost.type || cost.category || 'other').replace(/_/g, ' ')}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400">
                            {formatCurrency(cost.amount)} ({percentage}%)
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-400 dark:bg-red-500 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p>No cost data recorded</p>
                    <p className="text-sm mt-1">Add costs in the Costs page to track expenses</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Subscription Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Subscription Distribution</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(subscriptions?.distribution || {}).map(([tier, count]) => (
                <div key={tier} className="text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{count}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{tier}</p>
                </div>
              ))}
              {Object.keys(subscriptions?.distribution || {}).length === 0 && (
                <div className="col-span-4 text-center py-8 text-gray-500 dark:text-gray-400">
                  No subscription data available
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
