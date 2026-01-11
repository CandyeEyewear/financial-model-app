/**
 * AdminQuickStats Component
 * Quick stats card for admin users on the main dashboard
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Shield, Users, CreditCard, ArrowRight, Crown } from 'lucide-react';

export default function AdminQuickStats() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) {
      fetchQuickStats();
    }
  }, [isAdmin]);

  const fetchQuickStats = async () => {
    try {
      // Fetch basic counts - adjust these queries based on your table structure
      const [usersResult, subscriptionsResult] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('tier').neq('tier', 'free')
      ]);

      const totalUsers = usersResult.count || 0;

      // Count paid subscriptions
      const paidSubs = (subscriptionsResult.data || []).length;

      setStats({
        totalUsers,
        paidSubscriptions: paidSubs,
      });
    } catch (err) {
      console.error('Failed to fetch admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  // Don't render for non-admins
  if (!isAdmin) return null;

  return (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-5 text-white shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isSuperAdmin ? (
            <Crown className="w-5 h-5" />
          ) : (
            <Shield className="w-5 h-5" />
          )}
          <h3 className="font-semibold">
            {isSuperAdmin ? 'Super Admin' : 'Admin'} Quick View
          </h3>
        </div>
        <Link
          to="/admin"
          className="flex items-center gap-1 text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full transition-colors"
        >
          Admin Panel
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {loading ? (
        <div className="flex gap-4">
          <div className="h-16 w-24 bg-white/20 animate-pulse rounded-lg" />
          <div className="h-16 w-24 bg-white/20 animate-pulse rounded-lg" />
        </div>
      ) : (
        <div className="flex gap-4">
          <div className="bg-white/10 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <Users className="w-4 h-4" />
              Users
            </div>
            <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
          </div>

          <div className="bg-white/10 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <CreditCard className="w-4 h-4" />
              Paid
            </div>
            <p className="text-2xl font-bold">{stats?.paidSubscriptions || 0}</p>
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2 text-sm">
        <Link to="/admin/users" className="text-white/80 hover:text-white underline">
          Manage Users
        </Link>
        <span className="text-white/50">|</span>
        <Link to="/admin/revenue" className="text-white/80 hover:text-white underline">
          Revenue
        </Link>
        <span className="text-white/50">|</span>
        <Link to="/admin/costs" className="text-white/80 hover:text-white underline">
          Costs
        </Link>
      </div>
    </div>
  );
}
