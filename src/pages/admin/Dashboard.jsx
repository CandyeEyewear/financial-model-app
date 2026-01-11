import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  Users,
  CreditCard,
  DollarSign,
  TrendingUp,
  Activity,
  AlertCircle,
  ArrowRight
} from 'lucide-react';

export default function AdminDashboard() {
  const { session } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await fetch('/api/admin/dashboard', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch dashboard');

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-500" />
        <span className="text-red-700 dark:text-red-400">{error}</span>
      </div>
    );
  }

  const { overview, subscriptions, usage } = data || {};

  const formatCurrency = (amount) => `J$${(amount || 0).toLocaleString()}`;

  const statCards = [
    {
      name: 'Total Users',
      value: overview?.totalUsers || 0,
      change: `+${overview?.newUsersThisMonth || 0} this month`,
      icon: Users,
      color: 'blue',
      link: '/admin/users'
    },
    {
      name: 'Active Subscriptions',
      value: overview?.activeSubscriptions || 0,
      change: `${subscriptions?.distribution?.professional || 0} Pro, ${subscriptions?.distribution?.business || 0} Business`,
      icon: CreditCard,
      color: 'green',
      link: '/admin/subscriptions'
    },
    {
      name: 'Monthly Revenue',
      value: formatCurrency(overview?.grossRevenue),
      change: `MRR: ${formatCurrency(overview?.mrr)}`,
      icon: DollarSign,
      color: 'emerald',
      link: '/admin/revenue'
    },
    {
      name: 'Net Revenue',
      value: formatCurrency(overview?.netRevenue),
      change: `Costs: ${formatCurrency(overview?.estimatedCosts)}`,
      icon: TrendingUp,
      color: 'purple',
      link: '/admin/revenue'
    },
    {
      name: 'AI Queries',
      value: overview?.totalQueries || 0,
      change: `${overview?.activeUsersThisMonth || 0} active users`,
      icon: Activity,
      color: 'orange'
    }
  ];

  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">Overview of your FinSight platform</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <div key={stat.name} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-lg ${colorClasses[stat.color]}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              {stat.link && (
                <Link to={stat.link} className="text-gray-400 hover:text-blue-500">
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{stat.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{stat.change}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Subscription Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Subscriptions by Tier</h2>
          <div className="space-y-3">
            {(subscriptions?.packages || []).map((pkg) => {
              const count = subscriptions?.distribution?.[pkg.tier_id] || 0;
              const total = overview?.totalUsers || 1;
              const percentage = ((count / total) * 100).toFixed(1);

              return (
                <div key={pkg.tier_id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{pkg.name}</span>
                    <span className="text-gray-500 dark:text-gray-400">{count} users ({percentage}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Admin Activity</h2>
            <Link to="/admin/audit-logs" className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {(data?.recentActivity || []).slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 mt-2 rounded-full bg-blue-500" />
                <div>
                  <p className="text-gray-900 dark:text-gray-100 capitalize">
                    {activity.action.replace(/_/g, ' ')}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">
                    {new Date(activity.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {(!data?.recentActivity || data.recentActivity.length === 0) && (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No recent activity</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/admin/users"
            className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <Users className="w-8 h-8 text-blue-500 mb-2" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Manage Users</span>
          </Link>
          <Link
            to="/admin/subscriptions"
            className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <CreditCard className="w-8 h-8 text-green-500 mb-2" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Subscriptions</span>
          </Link>
          <Link
            to="/admin/costs"
            className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <DollarSign className="w-8 h-8 text-red-500 mb-2" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Add Costs</span>
          </Link>
          <Link
            to="/admin/revenue"
            className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <TrendingUp className="w-8 h-8 text-purple-500 mb-2" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">View Revenue</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
