"use client";

import { useState } from "react";
import Image from "next/image";
import { useResetPasswordMutation } from "@/lib/redux/services/auth";
import Link from "next/link";

/**
 * Forgot Password page component
 */
export default function ForgotPasswordPage() {
  const [resetPassword, { isLoading, error }] = useResetPasswordMutation();
  const [email, setEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  /**
   * Handle input change
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const result = await resetPassword({ email }).unwrap();

      if (result.success) {
        setResetSent(true);
      }
    } catch (err) {
      // Error is handled by the RTK Query hook
      console.error(err);
    }
  };

  // Check if error exists
  const hasError = error != null;

  return (
    <div className="auth-bg min-h-screen flex flex-col justify-center items-center px-4 pb-12 pt-16">
      <div className="w-full max-w-md">
        {/* Logo and header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center text-shadow-lg gap-3 mb-6">
            <Image
              src={process.env.NEXT_PUBLIC_LOGO_WAYO || "/favicon.svg"}
              alt="WAYO Logo"
              width={32}
              height={32}
              className="rounded-md"
            />
            <span className="font-semibold text-xl">WAYO</span>
          </Link>
          <h1 className="text-2xl font-bold mb-2">Reset Your Password</h1>
          <p className="text-gray-600">
            Enter your email and we&apos;ll send you a link to reset your
            password.
          </p>
        </div>

        {/* Reset password form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 auth-form">
          {resetSent ? (
            <div className="p-4 bg-green-50 text-green-700 rounded-lg border border-green-100 text-sm mb-4">
              <h3 className="font-medium mb-1">Reset link sent!</h3>
              <p>Check your email for a link to reset your password.</p>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {hasError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-100 text-sm">
                  Unable to process your request. Please try again.
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your email"
                  value={email}
                  onChange={handleChange}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          )}
        </div>

        {/* Login link */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-600">
            Remember your password?{" "}
            <Link
              href="/login"
              className="text-blue-600 hover:text-blue-800 font-medium underline"
            >
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}