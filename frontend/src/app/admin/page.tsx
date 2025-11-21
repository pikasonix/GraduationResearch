"use client";

import AdminCheck from "./_AdminCheck";

/**
 * Admin dashboard content
 */
function AdminDashboard() {
  return (
    <div className="container mx-auto px-4 py-8 pt-16">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Admin Panel</h2>
        <p className="mb-4">
          Welcome to the admin area. This page is only accessible to users with
          admin privileges.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="bg-gray-50 p-4 rounded border">
            <h3 className="font-medium mb-2">User Management</h3>
            <p className="text-gray-600">
              Manage user accounts and permissions
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded border">
            <h3 className="font-medium mb-2">Content Management</h3>
            <p className="text-gray-600">Manage website content and assets</p>
          </div>

          <div className="bg-gray-50 p-4 rounded border">
            <h3 className="font-medium mb-2">System Settings</h3>
            <p className="text-gray-600">Configure application settings</p>
          </div>

          <div className="bg-gray-50 p-4 rounded border">
            <h3 className="font-medium mb-2">Analytics</h3>
            <p className="text-gray-600">
              View site statistics and user metrics
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Admin page with access control
 */
export default function AdminPage() {
  return (
    <AdminCheck
      fallback={
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>You do not have permission to access this page.</p>
        </div>
      }
    >
      <AdminDashboard />
    </AdminCheck>
  );
}
