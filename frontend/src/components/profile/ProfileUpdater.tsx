"use client";

import { useEffect, useCallback } from "react";
import { useGetSessionQuery } from "@/lib/redux/services/auth";
import {
  useUpdateProfileMutation,
  useUploadAvatarMutation,
} from "@/lib/redux/services/profileApi";
import { supabase } from "@/supabase/client";

/**
 * A client component that handles updating the user's profile with a phone number
 * from local storage. This component does not render anything.
 */
export default function ProfileUpdater() {
  const { data: sessionData } = useGetSessionQuery();
  const userId = sessionData?.session?.user?.id;
  const [updateProfile] = useUpdateProfileMutation();
  const [uploadAvatar] = useUploadAvatarMutation();

  const handleMutationError = useCallback((err: unknown, context: string) => {
    console.error(`Failed to ${context}:`, err);
  }, []);

  useEffect(() => {
    if (userId) {
      const pendingPhone = localStorage.getItem("pending-phone-update");
      if (pendingPhone) {
        updateProfile({ id: userId, phone: pendingPhone })
          .unwrap()
          .then(() => {
            localStorage.removeItem("pending-phone-update");
          })
          .catch((err) => {
            handleMutationError(err, "update phone from local storage");
            // Also remove from local storage on failure to prevent repeated failed attempts
            localStorage.removeItem("pending-phone-update");
          });
      }
    }
  }, [userId, updateProfile, handleMutationError]);

  useEffect(() => {
    const copyGoogleAvatar = async () => {
      if (!userId) return;
      const googleAvatarUrl =
        sessionData?.session?.user?.user_metadata?.avatar_url;
      if (!googleAvatarUrl) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle();

      if (profile?.avatar_url) return;

      try {
        const response = await fetch(googleAvatarUrl);
        if (!response.ok) throw new Error("Failed to fetch Google avatar");
        const blob = await response.blob();
        const file = new File([blob], "avatar.jpg", { type: blob.type });
        const { publicUrl } = await uploadAvatar({ file, userId }).unwrap();
        await updateProfile({ id: userId, avatar_url: publicUrl }).unwrap();
      } catch (err) {
        handleMutationError(err, "copy Google avatar");
      }
    };

    copyGoogleAvatar();
  }, [
    userId,
    sessionData?.session?.user?.user_metadata?.avatar_url,
    uploadAvatar,
    updateProfile,
    handleMutationError,
  ]);

  return null; // This component doesn't render anything
}
