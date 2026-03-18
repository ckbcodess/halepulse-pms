/**
 * Manager Dashboard Design - Component Reference for Figma
 * This component recreates the exact layout from the web design
 * Use as a reference for updating your Figma design system
 */

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { AlertCircle, Bell, Settings, LogOut, Clock, TrendingUp } from 'lucide-react';

export default function ManagerDashboard() {
  const monthlyData = [
    { month: 'Jan', value: 0 },
    { month: 'Feb', value: 0 },
    { month: 'Mar', value: 38 },
    { month: 'Apr', value: 0 },
    { month: 'May', value: 0 },
    { month: 'Jun', value: 0 },
    { month: 'Jul', value: 0 },
    { month: 'Aug', value: 0 },
    { month: 'Sep', value: 0 },
    { month: 'Oct', value: 0 },
    { month: 'Nov', value: 0 },
    { month: 'Dec', value: 0 },
  ];

  const todayReportData = [{ name: 'Cash', value: 39.00 }];
  const COLORS = ['#5B5BFF'];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* ===== LEFT SIDEBAR ===== */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
              H
            </div>
            <div>
              <div className="font-bold text-sm text-gray-900">HalePulse</div>
              <div className="text-xs text-gray-500">PHARMACY</div>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 px-4 py-6">
          <div className="text-xs font-semibold text-gray-500 mb-4 px-2">MENU</div>
          <ul className="space-y-2">
            {/* Active item */}
            <li>
              <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-600 text-white font-medium text-sm">
                <div className="w-5 h-5">📊</div>
                Dashboard
              </button>
            </li>
            {/* Inactive items */}
            {[
              { icon: '🛒', label: 'Point of Sale' },
              { icon: '📦', label: 'Inventory' },
              { icon: '👥', label: 'Customers' },
              { icon: '📋', label: 'Reports' },
              { icon: '⚙️', label: 'Settings' },
              { icon: '👤', label: 'Team' },
            ].map((item) => (
              <li key={item.label}>
                <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 font-medium text-sm hover:bg-gray-100 rounded-lg">
                  <div className="w-5 h-5">{item.icon}</div>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sign Out */}
        <div className="p-4 border-t border-gray-200">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-600 font-medium text-sm hover:bg-gray-100 rounded-lg">
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 flex flex-col bg-slate-50">
        {/* TOP HEADER */}
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-lg relative">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg">
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
            <button className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded-lg">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-xs">
                M
              </div>
              <div className="text-sm">
                <div className="font-semibold text-gray-900">Manager</div>
                <div className="text-xs text-gray-500">MANAGER</div>
              </div>
            </button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <div className="flex-1 overflow-auto p-8">
          {/* Greeting Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-1">
              Good afternoon, Manager 💙
            </h2>
            <p className="text-gray-600 text-sm">Tuesday, March 17, 2026</p>
          </div>

          {/* Filters */}
          <div className="flex gap-4 mb-8">
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium text-sm hover:bg-gray-50">
              <Clock className="w-4 h-4" />
              Last 30 days
            </button>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium text-sm hover:bg-gray-50">
              <TrendingUp className="w-4 h-4" />
              Compare: Previous period
            </button>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Total Inventory', value: '1,896', info: true },
              { label: 'Low Stock Alerts', value: '1,896', alert: true, info: true },
              { label: 'Expiring Soon', value: '0', info: true },
              { label: 'Sales Today', value: '₵39.00', trend: '+1000.0%', info: true },
            ].map((card, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-700">{card.label}</h3>
                  {card.info && <AlertCircle className="w-4 h-4 text-gray-400" />}
                </div>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-bold text-gray-900">{card.value}</div>
                  {card.alert && <span className="w-2 h-2 bg-red-500 rounded-full"></span>}
                  {card.trend && <span className="text-green-600 text-sm font-medium">{card.trend}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Monthly Progress Chart */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Monthly Progress</h3>
                <button className="text-sm text-gray-600 hover:text-gray-900">Monthly</button>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  />
                  <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Today's Report Chart */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Today's Report</h3>
              <div className="flex flex-col items-center justify-center py-6">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={todayReportData}
                      innerRadius={70}
                      outerRadius={100}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-center mt-4">
                  <p className="text-sm text-gray-600">Total Earning</p>
                  <p className="text-2xl font-bold text-gray-900">₵39.00</p>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  <span className="text-sm text-gray-600">Cash</span>
                </div>
              </div>
            </div>
          </div>

          {/* Transactions & Alerts Section */}
          <div className="grid grid-cols-2 gap-6">
            {/* Recent Transactions */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Recent Transactions</h3>
                <a href="#" className="text-blue-600 text-sm font-medium hover:underline">
                  View report
                </a>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-xs">
                      W
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Walk-in Customer</p>
                    </div>
                  </div>
                  <p className="font-medium text-gray-900">₵39.00</p>
                </div>
              </div>
            </div>

            {/* Inventory Alerts */}
            <div className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Inventory Alerts</h3>
                <a href="#" className="text-blue-600 text-sm font-medium hover:underline">
                  View report
                </a>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                    <div>
                      <p className="font-medium text-gray-900">Low Stock Remaining</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
