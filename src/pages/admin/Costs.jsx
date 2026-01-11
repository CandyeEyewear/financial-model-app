import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOutletContext } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Edit2,
  DollarSign,
  RefreshCw,
  Calendar,
  Building,
  FileText,
  X,
  AlertCircle
} from 'lucide-react';

export default function AdminCosts() {
  const { session } = useAuth();
  const { adminRole } = useOutletContext();
  const [costs, setCosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCost, setEditingCost] = useState(null);
  const [filter, setFilter] = useState({ recurring: 'all', category: 'all' });
  const [error, setError] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    category_id: '',
    description: '',
    amount: '',
    currency: 'JMD',
    period_start: new Date().toISOString().split('T')[0],
    period_end: '',
    is_recurring: false,
    vendor: '',
    invoice_number: '',
    notes: ''
  });

  useEffect(() => {
    fetchCosts();
  }, [filter]);

  const fetchCosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.recurring !== 'all') {
        params.append('recurring', filter.recurring);
      }
      if (filter.category !== 'all') {
        params.append('category', filter.category);
      }

      const response = await fetch(`/api/admin/costs?${params}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch costs');

      const result = await response.json();
      setCosts(result.data?.costs || []);
      setCategories(result.data?.categories || []);
      setSummary(result.data?.summary || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      const method = editingCost ? 'PUT' : 'POST';
      const body = editingCost
        ? { id: editingCost.id, ...formData, amount: parseFloat(formData.amount) }
        : { ...formData, amount: parseFloat(formData.amount) };

      const response = await fetch('/api/admin/costs', {
        method,
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save cost');
      }

      setShowModal(false);
      setEditingCost(null);
      resetForm();
      fetchCosts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this cost entry?')) return;

    try {
      const response = await fetch(`/api/admin/costs?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete cost');

      fetchCosts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (cost) => {
    setEditingCost(cost);
    setFormData({
      category_id: cost.category_id || '',
      description: cost.description || '',
      amount: cost.amount?.toString() || '',
      currency: cost.currency || 'JMD',
      period_start: cost.period_start?.split('T')[0] || '',
      period_end: cost.period_end?.split('T')[0] || '',
      is_recurring: cost.is_recurring || false,
      vendor: cost.vendor || '',
      invoice_number: cost.invoice_number || '',
      notes: cost.notes || ''
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      category_id: '',
      description: '',
      amount: '',
      currency: 'JMD',
      period_start: new Date().toISOString().split('T')[0],
      period_end: '',
      is_recurring: false,
      vendor: '',
      invoice_number: '',
      notes: ''
    });
  };

  const openAddModal = () => {
    setEditingCost(null);
    resetForm();
    setShowModal(true);
  };

  const formatCurrency = (amount, currency = 'JMD') => {
    const prefix = currency === 'JMD' ? 'J$' : '$';
    return `${prefix}${(amount || 0).toLocaleString()}`;
  };

  // Group costs by recurring/one-time
  const recurringCosts = costs.filter(c => c.is_recurring);
  const onetimeCosts = costs.filter(c => !c.is_recurring);

  const categoryColors = {
    api: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    hosting: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    database: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    marketing: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    support: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    contractor: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    software: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    payment_fees: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    other: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cost Management</h1>
          <p className="text-gray-500 dark:text-gray-400">Track your operational expenses</p>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Cost
        </button>
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

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <RefreshCw className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Recurring Monthly</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(summary.recurringTotal)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <Calendar className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">One-Time</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(summary.onetimeTotal)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <DollarSign className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Costs</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(summary.grandTotal)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filter.recurring}
          onChange={(e) => setFilter(f => ({ ...f, recurring: e.target.value }))}
          className="border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">All Types</option>
          <option value="true">Recurring Only</option>
          <option value="false">One-Time Only</option>
        </select>

        <select
          value={filter.category}
          onChange={(e) => setFilter(f => ({ ...f, category: e.target.value }))}
          className="border dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="all">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.name}>
              {cat.name.charAt(0).toUpperCase() + cat.name.slice(1).replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Costs List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Recurring Costs */}
          {recurringCosts.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/20 border-b dark:border-gray-700">
                <h2 className="font-semibold text-blue-900 dark:text-blue-300 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Recurring Monthly Costs
                </h2>
              </div>
              <div className="divide-y dark:divide-gray-700">
                {recurringCosts.map(cost => (
                  <CostRow
                    key={cost.id}
                    cost={cost}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    formatCurrency={formatCurrency}
                    categoryColors={categoryColors}
                  />
                ))}
              </div>
            </div>
          )}

          {/* One-Time Costs */}
          {onetimeCosts.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 bg-orange-50 dark:bg-orange-900/20 border-b dark:border-gray-700">
                <h2 className="font-semibold text-orange-900 dark:text-orange-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  One-Time Costs
                </h2>
              </div>
              <div className="divide-y dark:divide-gray-700">
                {onetimeCosts.map(cost => (
                  <CostRow
                    key={cost.id}
                    cost={cost}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    formatCurrency={formatCurrency}
                    categoryColors={categoryColors}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {costs.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-12 text-center">
              <DollarSign className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No costs recorded</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Start tracking your operational expenses to see profit calculations.
              </p>
              <button
                onClick={openAddModal}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Your First Cost
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingCost ? 'Edit Cost Entry' : 'Add Cost Entry'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category *
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData(f => ({ ...f, category_id: e.target.value }))}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                >
                  <option value="">Select category...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name.charAt(0).toUpperCase() + cat.name.slice(1).replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                  placeholder="e.g., DeepSeek API - January 2026"
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              {/* Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount *
                  </label>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData(f => ({ ...f, currency: e.target.value }))}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="JMD">JMD (J$)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              {/* Recurring Toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData(f => ({ ...f, is_recurring: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label htmlFor="is_recurring" className="text-sm text-gray-700 dark:text-gray-300">
                  This is a recurring monthly cost
                </label>
              </div>

              {/* Period */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={formData.period_start}
                    onChange={(e) => setFormData(f => ({ ...f, period_start: e.target.value }))}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    End Date {formData.is_recurring && '(leave blank for ongoing)'}
                  </label>
                  <input
                    type="date"
                    value={formData.period_end}
                    onChange={(e) => setFormData(f => ({ ...f, period_end: e.target.value }))}
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Vendor */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Vendor / Provider
                </label>
                <input
                  type="text"
                  value={formData.vendor}
                  onChange={(e) => setFormData(f => ({ ...f, vendor: e.target.value }))}
                  placeholder="e.g., DeepSeek, Vercel, Supabase"
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Invoice Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Invoice / Reference Number
                </label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData(f => ({ ...f, invoice_number: e.target.value }))}
                  placeholder="e.g., INV-2026-001"
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any additional notes..."
                  rows={2}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Actions */}
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
                  {editingCost ? 'Save Changes' : 'Add Cost'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Cost Row Component
function CostRow({ cost, onEdit, onDelete, formatCurrency, categoryColors }) {
  const categoryName = cost.cost_categories?.name || cost.cost_type || 'other';
  const colorClass = categoryColors[categoryName] || categoryColors.other;

  return (
    <div className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30">
      <div className="flex items-center gap-4">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
          {categoryName.replace(/_/g, ' ')}
        </span>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{cost.description}</p>
          <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            {cost.vendor && (
              <span className="flex items-center gap-1">
                <Building className="w-3 h-3" />
                {cost.vendor}
              </span>
            )}
            {cost.invoice_number && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {cost.invoice_number}
              </span>
            )}
            <span>
              {new Date(cost.period_start).toLocaleDateString()}
              {cost.is_recurring && ' - ongoing'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-lg font-semibold text-gray-900 dark:text-white">
          {formatCurrency(cost.amount, cost.currency)}
          {cost.is_recurring && <span className="text-sm text-gray-500 dark:text-gray-400">/mo</span>}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(cost)}
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(cost.id)}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
