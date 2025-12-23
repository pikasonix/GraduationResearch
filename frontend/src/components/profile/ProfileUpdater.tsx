"use client";

import { useEffect, useCallback } from "react";
import { useGetSessionQuery } from "@/lib/redux/services/auth";
import { supabase } from "@/supabase/client";

/**
 * A client component that handles updating the user's profile with a phone number
 * from local storage. This component does not render anything.
 * 
 * Note: This project uses 'users' table instead of 'profiles' table.
 */
export default function ProfileUpdater() {
  const { data: sessionData } = useGetSessionQuery();
  const userId = sessionData?.session?.user?.id;

  const handleMutationError = useCallback((err: unknown, context: string) => {
    console.error(`Failed to ${context}:`, err);
  }, []);

  useEffect(() => {
    const updatePendingPhone = async () => {
      if (!userId) return;
      
      const pendingPhone = localStorage.getItem("pending-phone-update");
      if (!pendingPhone) return;

      try {
        // Update phone in users table (not profiles)
        const { error } = await supabase
          .from("users")
          .update({ phone: pendingPhone })
          .eq("id", userId);

        if (error) {
          handleMutationError(error, "update phone from local storage");
        }
        // Remove from local storage regardless of success/failure
        localStorage.removeItem("pending-phone-update");
      } catch (err) {
        handleMutationError(err, "update phone from local storage");
        localStorage.removeItem("pending-phone-update");
      }
    };

    updatePendingPhone();
  }, [userId, handleMutationError]);

  return null;
}
