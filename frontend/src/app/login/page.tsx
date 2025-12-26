"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useLoginMutation } from "@/lib/redux/services/auth";
import Link from "next/link";
import { supabase } from "@/supabase/client";


/**
 * Login form content component that uses useSearchParams
 */
function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified");
  const [login, { isLoading, error }] = useLoginMutation();
  const [credentials, setCredentials] = useState({
    email: "",
    password: "",
    rememberMe: false,
  });
  const [verificationMessage, setVerificationMessage] = useState("");



  /**
   * Check for verification status on component mount
   */
  useEffect(() => {
    if (verified === "pending") {
      setVerificationMessage(
        "Vui lòng kiểm tra email của bạn để xác minh tài khoản trước khi đăng nhập."
      );
    }
  }, [verified]);

  /**
   * Handle input change
   */

  const handleOAuthLogin = async (provider: 'google' | 'facebook') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/profile`,
      },
    });

    if (error) {
      console.error("OAuth login error:", error);
      alert("Không thể đăng nhập bằng " + provider);
    }
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setCredentials({
      ...credentials,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const result = await login({
        email: credentials.email,
        password: credentials.password,
      }).unwrap();

      if (result.session) {
        router.push("/profile");
      }
    } catch (err) {
      // Error is handled by the RTK Query hook
      console.error(err);
    }
  };

  // Check if error exists and render error message
  const hasError = error != null;

  return (
    <div className="auth-bg min-h-screen flex flex-col justify-center items-center px-4 pb-12 pt-16">
      <div className="w-full max-w-md">
        {/* Logo and header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center drop-shadow-lg gap-3 mb-6">
            <Image
              src={process.env.NEXT_PUBLIC_LOGO_WAYO || "/favicon.svg"}
              alt="WAYO Logo"
              width={32}
              height={32}
              className="rounded-md"
            />
            <span className="font-semibold text-xl">WAYO</span>
          </Link>
          <h1 className="text-2xl font-bold text-shadow-lg mb-2">Đăng nhập vào tài khoản</h1>
          <p className="text-gray-600 text-shadow-lg">
            Chào mừng trở lại! Vui lòng nhập thông tin của bạn.
          </p>
        </div>

        {/* Login form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 auth-form">
          <form className="space-y-4" onSubmit={handleSubmit}>
            {verificationMessage && (
              <div className="p-3 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 text-sm">
                {verificationMessage}
              </div>
            )}

            {hasError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-100 text-sm">
                Email hoặc mật khẩu không hợp lệ. Vui lòng thử lại.
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
                placeholder="Nhập email của bạn"
                value={credentials.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <input
                    id="rememberMe"
                    name="rememberMe"
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                    checked={credentials.rememberMe}
                    onChange={handleChange}
                  />
                  <label
                    htmlFor="rememberMe"
                    className="ml-2 block text-sm text-gray-700"
                  >
                    Ghi nhớ tôi
                  </label>
                </div>
                <div>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
                value={credentials.password}
                onChange={handleChange}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <button
            type="button"
            onClick={() => handleOAuthLogin('google')}
            className="flex justify-center items-center py-2.5 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 transition-colors"
          >
            <Image src="https://www.gstatic.com/images/branding/searchlogo/ico/favicon.ico" width={20} height={20} alt="Google" className="mr-2" />

            Đăng nhập bằng Google
          </button>
        </div>

        {/* Sign up link */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-600">
            Chưa có tài khoản?{" "}
            <Link
              href="/signup"
              className="text-blue-600 hover:text-blue-800 font-medium underline"
            >
              Đăng ký
            </Link>
          </p>
          <div style={{ textAlign: 'center', marginTop: 100 }}>



          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Login page component with Suspense boundary
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Đang tải...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
