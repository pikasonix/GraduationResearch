"use client";

import { useState } from "react";
import Link from "next/link";
import MAP_LINKS from '@/config/mapLinks';
import {
  useGetSessionQuery,
  useLogoutMutation,
} from "@/lib/redux/services/auth";
import { useRouter } from "next/navigation";

/**
 * Mobile menu component with hamburger toggle
 */
export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const { data } = useGetSessionQuery();
  const [logout] = useLogoutMutation();
  const router = useRouter();

  /**
   * Toggle the mobile menu state
   */
  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  /**
   * Handle user logout
   */
  const handleLogout = async () => {
    try {
      await logout().unwrap();
      setIsOpen(false);
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
      router.push("/login");
    }
  };

  return (
    <div>
      {/* Hamburger button */}
      <button
        className="text-gray-700 p-2 focus:outline-none"
        onClick={toggleMenu}
        aria-label="Toggle menu"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          {isOpen ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          )}
        </svg>
      </button>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-white">
          <div className="container mx-auto px-4 py-5 bg-white">
            <div className="flex justify-end mb-8">
              <button
                className="text-gray-700 p-2 focus:outline-none"
                onClick={toggleMenu}
                aria-label="Close menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Navigation Items */}
            <nav className="flex flex-col space-y-8">

              {/* Map-specific links (kept consistent with desktop navbar) */}
              {MAP_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-lg font-medium text-gray-800 hover:text-blue-600"
                  onClick={() => setIsOpen(false)}
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href="/profile"
                className="text-lg font-medium text-gray-800 hover:text-blue-600"
                onClick={() => setIsOpen(false)}
              >
                Hồ sơ
              </Link>
            </nav>

            {/* Auth Links */}
            <div className="mt-12 border-t border-gray-100 pt-8">
              {data?.session ? (
                <div className="space-y-6">
                  <div className="flex flex-col space-y-4">
                    <button
                      onClick={handleLogout}
                      className="py-3 px-4 bg-gray-100 text-gray-800 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Đăng xuất
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col space-y-4">
                  <Link
                    href="/login"
                    className="py-3 px-4 bg-gray-100 text-gray-800 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    href="/signup"
                    className="py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    Đăng ký
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
