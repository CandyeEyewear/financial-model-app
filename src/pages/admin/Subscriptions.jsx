import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOutletContext } from 'react-router-dom';
import {
  Search,
  Edit2,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CreditCard
} from 'lucide-react';

export default function AdminSubscriptions() {
  const { session } = useAuth();
  const { adminRole } = useOutletContext();
  const [subscriptions, setSubscriptions] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [formData, setFormData] = useState({ tier_id: '', subscription_status: '', notes: '' });

  useEffect(() => {
    fetchSubscriptions();
  }, [pagination.page, tierFilter, statusFilter]);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page,
        limit: 20,
        tier: tierFilter,
        status: statusFilter
      });

      const response = await fetch(`/api/admin/subscriptions?${params}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch subscriptions');

      const result = await response.json();
      setSubscriptions(result.data);
      setPackages(result.packages || []);
      setPagination(result.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSubscription = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const response = await fetch('/api/admin/subscriptions', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: editingSubscription.id,
          tier_id: formData.tier_id,
          subscription_status: formData.subscription_status,
          notes: formData.notes
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update subscription');
      }

      setShowModal(false);
      setEditingSubscription(null);
      fetchSubscriptions();
    } catch (err) {
      setError(err.message);
    }
  };

  const openEditModal = (subscription) => {
    setEditingSubscription(subscription);
    setFormData({
      tier_id: subscription.tier || 'free',
      subscription_status: subscription.subscription_status || 'none',
      notes: ''
    });
    setShowModal(true);
  };

  const getTierBadgeColor = (tier) => {
    const colors = {
      free: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
      professional: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      business: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      enterprise: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    };
    return colors[tier] || colors.free;
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      past_due: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      trialing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      pending_payment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    };
    return colors[status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  const formatCurrency = (amount) => `J$${(amount || 0).toLocaleString()}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subscriptions</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage user subscriptions and tiers</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700 dark:text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <select
          value={tierFilter}
          onChange={(e) => {
            setTierFilter(e.target.value);
            setPagination(p => ({ ...p, page: 1 }));
          }}
          className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">All Tiers</option>
          <option value="free">Free</option>
          <option value="professional">Professional</option>
          <option value="business">Business</option>
          <option value="enterprise">Enterprise</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPagination(p => ({ ...p, page: 1 }));
          }}
          className="border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
          <option value="past_due">Past Due</option>
          <option value="trialing">Trialing</option>
        </select>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tier</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Queries Used</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        No subscriptions found
                      </td>
                    </tr>
                  ) : (
                    subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                              <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{sub.name || 'No name'}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{sub.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTierBadgeColor(sub.tier)}`}>
                            {sub.tier || 'free'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(sub.subscription_status)}`}>
                            {sub.subscription_status || 'none'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {formatCurrency(sub.package?.price_monthly || 0)}/mo
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {sub.ai_queries_this_month || 0} / {sub.package?.query_limit === -1 ? '∞' : sub.package?.query_limit || 10}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {adminRole === 'super_admin' && (
                            <button
                              onClick={() => openEditModal(sub)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {((pagination.page - 1) * 20) + 1} to {Math.min(pagination.page * 20, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="p-2 border dark:border-gray-600 rounded-lg disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                    {pagination.page} / {pagination.pages}
                  </span>
                  <button
                    onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                    disabled={pagination.page === pagination.pages}
                    className="p-2 border dark:border-gray-600 rounded-lg disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Modal */}
      {showModal && editingSubscription && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Update Subscription
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSubscription} className="p-4 space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                <p className="font-medium text-gray-900 dark:text-white">{editingSubscription.name || 'No name'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{editingSubscription.email}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subscription Tier
                </label>
                <select
                  value={formData.tier_id}
                  onChange={(e) => setFormData(f => ({ ...f, tier_id: e.target.value }))}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="free">Free - J$0/mo</option>
                  <option value="professional">Professional - J$2,900/mo</option>
                  <option value="business">Business - J$7,900/mo</option>
                  <option value="enterprise">Enterprise - J$19,900/mo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.subscription_status}
                  onChange={(e) => setFormData(f => ({ ...f, subscription_status: e.target.value }))}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="none">None</option>
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="past_due">Past Due</option>
                  <option value="trialing">Trialing</option>
                  <option value="pending_payment">Pending Payment</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Reason for change..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Update Subscription
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
