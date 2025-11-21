"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCheckAdminStatusQuery } from "@/lib/redux/services/adminApi";
import { useGetSessionQuery } from "@/lib/redux/services/auth";

/**
 * Props for the AdminCheck component
 */
interface AdminCheckProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that restricts access to admin-only content
 * Redirects non-admin users to the home page
 */
export default function AdminCheck({ children, fallback }: AdminCheckProps) {
  const router = useRouter();
  const [isChecked, setIsChecked] = useState(false);
  const { data: session, isLoading: isSessionLoading } = useGetSessionQuery();
  const userId = session?.user?.id;

  const {
    data: isAdmin,
    isLoading: isAdminCheckLoading,
    error: adminCheckError,
  } = useCheckAdminStatusQuery(userId ?? "", {
    skip: !userId,
  });

  useEffect(() => {
    if (!isSessionLoading && !isAdminCheckLoading) {
      setIsChecked(true);

      // Redirect to home if not admin and not loading
      if (!userId || !isAdmin) {
        router.push("/");
      }
    }
  }, [userId, isAdmin, isSessionLoading, isAdminCheckLoading, router]);

  // Show loading state while checking permissions
  if (!isChecked || isSessionLoading || isAdminCheckLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">
            Checking admin access...
          </h2>
          <p className="text-gray-600">
            Please wait while we verify your permissions.
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (adminCheckError) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2 text-red-600">
            Access Error
          </h2>
          <p className="text-gray-600">
            There was a problem verifying your admin access.
          </p>
        </div>
      </div>
    );
  }

  // Show fallback content if user is not admin
  if (!isAdmin && fallback) {
    return <>{fallback}</>;
  }

  // Show admin content if user is admin
  return <>{children}</>;
}
