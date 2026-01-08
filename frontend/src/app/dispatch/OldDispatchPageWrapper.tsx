"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/supabase/client";
import { useGetSessionQuery } from "@/lib/redux/services/auth";
import { useGetUserProfileOverviewQuery } from "@/lib/redux/services/userApi";

export function OldDispatchPageWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const solutionId = searchParams.get("solutionId") || searchParams.get("solution_id");
  
  const [isChecking, setIsChecking] = useState(true);
  
  const { data: sessionData } = useGetSessionQuery();
  const userId = sessionData?.session?.user?.id;
  
  const { data: userProfile, isLoading: isProfileLoading } = useGetUserProfileOverviewQuery(
    userId ?? "",
    { skip: !userId }
  );
  
  const organizationId = userProfile?.organization?.id ?? null;

  useEffect(() => {
    async function checkAndRedirect() {
      // If solutionId already exists in URL, no need to redirect
      if (solutionId) {
        setIsChecking(false);
        return;
      }

      // Wait for organization to be loaded
      if (!organizationId) {
        if (!isProfileLoading && userId) {
          // Profile loaded but no organization
          setIsChecking(false);
        }
        return;
      }

      try {
        // Fetch the most recent solution for this organization
        const { data, error } = await supabase
          .from("optimization_solutions")
          .select("id")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error("Error fetching latest solution:", error);
          setIsChecking(false);
          return;
        }

        if (data?.id) {
          // Redirect to the latest solution
          router.replace(`/dispatch?solutionId=${data.id}`);
        } else {
          // No solutions found, just show the page
          setIsChecking(false);
        }
      } catch (err) {
        console.error("Error in checkAndRedirect:", err);
        setIsChecking(false);
      }
    }

    checkAndRedirect();
  }, [solutionId, organizationId, isProfileLoading, userId, router]);

  // Show loading state while checking
  if (isChecking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
