import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useOutletContext } from 'react-router-dom';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  Package,
  Check
} from 'lucide-react';

export default function AdminPackages() {
  const { session } = useAuth();
  const { adminRole } = useOutletContext();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [formData, setFormData] = useState({
    tier_id: '',
    name: '',
    description: '',
    price_monthly: '',
    price_yearly: '',
    query_limit: '',
    reports_limit: '',
    display_order: '',
    features: {}
  });

  const featureOptions = [
    { key: 'ai_chat', label: 'AI Chat Assistant' },
    { key: 'basic_models', label: 'Basic Financial Models' },
    { key: 'advanced_models', label: 'Advanced Models' },
    { key: 'export_pdf', label: 'PDF Export' },
    { key: 'priority_support', label: 'Priority Support' },
    { key: 'team_sharing', label: 'Team Sharing' },
    { key: 'custom_branding', label: 'Custom Branding' },
    { key: 'api_access', label: 'API Access' }
  ];

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/packages', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch packages');

      const result = await response.json();
      setPackages(result.data || []);
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
      const method = editingPackage ? 'PUT' : 'POST';
      const body = {
        ...formData,
        price_monthly: parseFloat(formData.price_monthly) || 0,
        price_yearly: parseFloat(formData.price_yearly) || 0,
        query_limit: parseInt(formData.query_limit) || 10,
        reports_limit: parseInt(formData.reports_limit) || 5,
        display_order: parseInt(formData.display_order) || 99
      };

      if (editingPackage) {
        body.id = editingPackage.id;
      }

      const response = await fetch('/api/admin/packages', {
        method,
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to save package');
      }

      setShowModal(false);
      setEditingPackage(null);
      resetForm();
      fetchPackages();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to deactivate this package?')) return;

    try {
      const response = await fetch(`/api/admin/packages?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!response.ok) throw new Error('Failed to delete package');

      fetchPackages();
    } catch (err) {
      setError(err.message);
    }
  };

  const openEditModal = (pkg) => {
    setEditingPackage(pkg);
    setFormData({
      tier_id: pkg.tier_id,
      name: pkg.name,
      description: pkg.description || '',
      price_monthly: pkg.price_monthly?.toString() || '0',
      price_yearly: pkg.price_yearly?.toString() || '0',
      query_limit: pkg.query_limit?.toString() || '10',
      reports_limit: pkg.reports_limit?.toString() || '5',
      display_order: pkg.display_order?.toString() || '0',
      features: pkg.features || {}
    });
    setShowModal(true);
  };

  const openCreateModal = () => {
    setEditingPackage(null);
    resetForm();
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      tier_id: '',
      name: '',
      description: '',
      price_monthly: '',
      price_yearly: '',
      query_limit: '10',
      reports_limit: '5',
      display_order: '99',
      features: {}
    });
  };

  const toggleFeature = (key) => {
    setFormData(f => ({
      ...f,
      features: {
        ...f.features,
        [key]: !f.features[key]
      }
    }));
  };

  const formatCurrency = (amount) => `J$${(amount || 0).toLocaleString()}`;

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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Packages</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage subscription packages and pricing</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Package
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

      {/* Packages Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 p-6 ${
                !pkg.is_active ? 'opacity-50' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(pkg)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(pkg.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{pkg.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{pkg.tier_id}</p>

              <div className="mb-4">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {formatCurrency(pkg.price_monthly)}
                  <span className="text-sm font-normal text-gray-500">/mo</span>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatCurrency(pkg.price_yearly)}/year
                </p>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">AI Queries</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {pkg.query_limit === -1 ? 'Unlimited' : pkg.query_limit}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Reports</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {pkg.reports_limit === -1 ? 'Unlimited' : pkg.reports_limit}
                  </span>
                </div>
              </div>

              <div className="border-t dark:border-gray-700 pt-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Features</p>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(pkg.features || {}).filter(([_, v]) => v).map(([key]) => (
                    <span
                      key={key}
                      className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded"
                    >
                      {key.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              </div>

              {!pkg.is_active && (
                <div className="mt-4 px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded text-center">
                  Inactive
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingPackage ? 'Edit Package' : 'Create Package'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tier ID *
                  </label>
                  <input
                    type="text"
                    value={formData.tier_id}
                    onChange={(e) => setFormData(f => ({ ...f, tier_id: e.target.value }))}
                    placeholder="e.g., professional"
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                    disabled={!!editingPackage}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g., Professional"
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Monthly Price (JMD)
                  </label>
                  <input
                    type="number"
                    value={formData.price_monthly}
                    onChange={(e) => setFormData(f => ({ ...f, price_monthly: e.target.value }))}
                    min="0"
                    step="0.01"
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Yearly Price (JMD)
                  </label>
                  <input
                    type="number"
                    value={formData.price_yearly}
                    onChange={(e) => setFormData(f => ({ ...f, price_yearly: e.target.value }))}
                    min="0"
                    step="0.01"
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Query Limit
                  </label>
                  <input
                    type="number"
                    value={formData.query_limit}
                    onChange={(e) => setFormData(f => ({ ...f, query_limit: e.target.value }))}
                    min="-1"
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">-1 = unlimited</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reports Limit
                  </label>
                  <input
                    type="number"
                    value={formData.reports_limit}
                    onChange={(e) => setFormData(f => ({ ...f, reports_limit: e.target.value }))}
                    min="-1"
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData(f => ({ ...f, display_order: e.target.value }))}
                    min="0"
                    className="w-full border dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Features
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {featureOptions.map((feature) => (
                    <label
                      key={feature.key}
                      className="flex items-center gap-2 p-2 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <input
                        type="checkbox"
                        checked={!!formData.features[feature.key]}
                        onChange={() => toggleFeature(feature.key)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{feature.label}</span>
                    </label>
                  ))}
                </div>
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
                  {editingPackage ? 'Save Changes' : 'Create Package'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
