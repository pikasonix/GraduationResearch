/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useGetSessionQuery } from "@/lib/redux/services/auth";
import {
  useGetProfileOverviewQuery,
  useUpdateProfileMutation,
  useUploadAvatarMutation,
  type DbProfile,
  type DbProject,
} from "@/lib/redux/services/profileApi";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileTabs from "@/components/profile/ProfileTabs";
import CompleteProfileModal from "@/components/profile/SimpleProfileSection/CompleteProfileModal";
import type { ProfileData } from "@/components/profile/SimpleProfileSection/CompleteProfileModal";
import type {
  CustomerDetail,
  SupplierDetail,
  TechDetail,
} from "@/components/profile/DetailProfileSection";
import type { UserRole } from "@/components/profile/types";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useOptionLabels } from "@/lib/hooks/useOptionLabels";
// import { PROFILE_TYPE_OPTIONS, PROFILE_ROLE_OPTIONS } from "@/lib/constants/options"; // Removed

const LoadingSpinner: React.FC = () => (
  <div className="flex justify-center items-center h-64">
    <div className="h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => (
  <div className="text-center text-red-600 py-10">
    <p>Error loading data: {message}</p>
    <p>Please try refreshing the page.</p>
  </div>
);

// Helper type for RTK Query errors (more specific than any)
type RtkQueryError = FetchBaseQueryError & {
  data?: string | { message?: string }; // Adjust based on actual error data structure
};

/**
 * User profile page showing auth state and account information
 */
const ProfilePage: React.FC = () => {
  const { data: sessionData, isLoading: isLoadingSession } =
    useGetSessionQuery();
  const router = useRouter();
  const userId = sessionData?.session?.user?.id;

  const { getLabels, getLabel } = useOptionLabels();

  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  // Note: project sub-modals were removed to simplify the page and avoid
  // referencing components/handlers that aren't present in this file.

  const {
    data: overviewData,
    error: overviewError,
    isLoading: isLoadingOverview,
    isFetching: isFetchingOverview,
  } = useGetProfileOverviewQuery(userId ?? "", {
    skip: !userId,
  });

  const [updateProfile] = useUpdateProfileMutation();
  const [uploadAvatar] = useUploadAvatarMutation();

  const profileData = overviewData?.profile ?? null;
  const projectData = overviewData?.project ?? null;

  // --- Mutation Error Handling Helper ---
  const handleMutationError = useCallback((err: unknown, context: string) => {
    console.error(`Failed to ${context}:`, err);
    let message = `Could not ${context}.`;
    // Type guard to check if it's an RTK Query error structure
    if (
      typeof err === "object" &&
      err !== null &&
      ("status" in err || "error" in err) // Check for common RTK error fields
    ) {
      const rtkError = err as RtkQueryError;
      // Extract message from data field (could be string or object)
      if (typeof rtkError.data === "string") {
        message = rtkError.data;
      } else if (typeof rtkError.data === "object" && rtkError.data?.message) {
        message = rtkError.data.message;
      } else if ("error" in rtkError && typeof rtkError.error === "string") {
        // Fallback for CUSTOM_ERROR structure
        message = rtkError.error;
      }
    }
    toast.error(`Error: ${message}`);
  }, []);

  const isLoading =
    isLoadingSession ||
    isLoadingOverview ||
    isFetchingOverview;

  const queryError = overviewError;

  const isProfileComplete = React.useMemo(() => {
    if (!profileData) return false;
    const name = (profileData.name || "").trim();
    const type = Array.isArray(profileData.type)
      ? profileData.type[0]
      : profileData.type;
    const phoneDigits = (profileData.phone || "").replace(/\D/g, "");
    const validPhone = phoneDigits.length >= 9;
    return Boolean(name && type && validPhone);
  }, [profileData]);

  useEffect(() => {
    if (!isLoadingSession && !userId) {
      router.push("/login");
    }
  }, [isLoadingSession, userId, router]);

  useEffect(() => {
    if (!isLoading && userId) {
      const nameMissing = !(profileData?.name && String(profileData.name).trim());
      const typeMissing = !(
        (Array.isArray(profileData?.type) && profileData!.type!.length > 0) ||
        (typeof profileData?.type === "string" && String(profileData?.type).trim() !== "")
      );
      const phoneMissing = !(profileData?.phone && String(profileData?.phone).trim());
      if (nameMissing || typeMissing || phoneMissing) {
        setIsEditProfileModalOpen(true);
      }
    }
  }, [isLoading, userId, profileData]);

  // Data processing (happens before early returns to maintain hook order)
  const currentProfile: Partial<DbProfile> = profileData ?? {};
  const currentProject: Partial<DbProject> = projectData ?? {};

  const profileRoleArray = Array.isArray(currentProfile.role)
    ? currentProfile.role
    : currentProfile.role
      ? [currentProfile.role]
      : [];

  const projectTagArray = Array.isArray(currentProject.tags)
    ? currentProject.tags
    : currentProject.tags
      ? [currentProject.tags]
      : [];

  const projectCofounderArray = Array.isArray(currentProject.cofounders)
    ? currentProject.cofounders
    : currentProject.cofounders
      ? [currentProject.cofounders]
      : [];

  const projectPartnerArray = Array.isArray(currentProject.partners)
    ? currentProject.partners
    : currentProject.partners
      ? [currentProject.partners]
      : [];

  const roleLabels = getLabels("profileRole", profileRoleArray, "");
  const currentProfileType =
    Array.isArray(currentProfile.type) && currentProfile.type.length > 0
      ? currentProfile.type[0]
      : typeof currentProfile.type === "string"
        ? currentProfile.type
        : undefined;
  const typeLabel = currentProfileType
    ? getLabel("profileType", currentProfileType, "")
    : "";

  const projectCategoryLabels = getLabels(
    "projectCategory",
    projectTagArray,
    ""
  );

  const userTypeBadges = typeLabel ? [typeLabel] : [];
  const projectTagsForDisplay = projectCategoryLabels
    ? projectCategoryLabels.split(", ")
    : [];

  const resolvedRole: UserRole = React.useMemo(() => {
    const validRoles: UserRole[] = ["CUSTOMER", "SUPPLIER", "TECH"];
    const match = profileRoleArray.find((role): role is UserRole =>
      validRoles.includes(role as UserRole)
    );
    return match ?? "CUSTOMER";
  }, [profileRoleArray]);

  const profileInfoForModal: ProfileData = {
    name: currentProfile.name ?? "",
    avatarUrl: currentProfile.avatar_url,
    type:
      Array.isArray(currentProfile.type) && currentProfile.type.length > 0
        ? currentProfile.type[0]
        : typeof currentProfile.type === "string"
          ? currentProfile.type
          : "",
    role: profileRoleArray,
    phone: currentProfile.phone ?? "",
    avatarFile: undefined,
  };

  const detailInfoForTabs = React.useMemo<{
    customer?: CustomerDetail;
    supplier?: SupplierDetail;
    tech?: TechDetail;
  }>(() => {
    const result: {
      customer?: CustomerDetail;
      supplier?: SupplierDetail;
      tech?: TechDetail;
    } = {};

    if (resolvedRole === "CUSTOMER") {
      result.customer = {
        fullName: profileInfoForModal.name || "Khách hàng WAYO",
        phone: profileInfoForModal.phone || "",
        password: "********",
      };
    }

    return result;
  }, [profileInfoForModal.name, profileInfoForModal.phone, resolvedRole]);

  if (isLoading) {
    return (
      <div className="pt-16 sm:pt-20 md:pt-24 max-w-4xl mx-auto px-4">
        <LoadingSpinner />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="pt-16 sm:pt-20 md:pt-24 max-w-4xl mx-auto px-4 text-center">
        Authenticating... If this persists, please{" "}
        <a href="/login" className="underline">
          log in
        </a>
        .
      </div>
    );
  }

  if (queryError) {
    const errorMessage =
      typeof queryError === "object" && queryError && "data" in queryError
        ? String(queryError.data)
        : "An unknown error occurred";
    return (
      <div className="pt-16 sm:pt-20 md:pt-24 max-w-4xl mx-auto px-4">
        <ErrorDisplay message={errorMessage} />
      </div>
    );
  }

  const handleEditProfile = () => setIsEditProfileModalOpen(true);
  // For now, other edit actions prompt the user to complete profile first
  // and otherwise open the main profile modal. This avoids depending on
  // additional modal components that are not imported here.
  const handleEditProject = () => {
    if (!isProfileComplete) {
      toast("Vui lòng hoàn thành hồ sơ trước khi chỉnh sửa các thông tin khác.");
      setIsEditProfileModalOpen(true);
      return;
    }
    toast("Chỉnh sửa dự án hiện chưa khả dụng trong bản này.");
  };

  const handleEditContact = () => {
    if (!isProfileComplete) {
      toast("Vui lòng hoàn thành hồ sơ trước khi chỉnh sửa các thông tin khác.");
      setIsEditProfileModalOpen(true);
      return;
    }
    toast("Chỉnh sửa thông tin liên hệ hiện chưa khả dụng trong bản này.");
  };

  const handleEditAbout = () => {
    if (!isProfileComplete) {
      toast("Vui lòng hoàn thành hồ sơ trước khi chỉnh sửa các thông tin khác.");
      setIsEditProfileModalOpen(true);
      return;
    }
    toast("Chỉnh sửa mô tả dự án hiện chưa khả dụng trong bản này.");
  };

  const handleEditFunding = () => {
    if (!isProfileComplete) {
      toast("Vui lòng hoàn thành hồ sơ trước khi chỉnh sửa các thông tin khác.");
      setIsEditProfileModalOpen(true);
      return;
    }
    toast("Chỉnh sửa thông tin gọi vốn hiện chưa khả dụng trong bản này.");
  };

  const handleSaveProfileInfo = async (updatedData: ProfileData) => {
    if (!userId) return;
    const { avatarFile, ...profileDetails } = updatedData;
    let newAvatarUrl = profileData?.avatar_url;

    if (avatarFile) {
      try {
        const uploadResult = await uploadAvatar({
          userId,
          file: avatarFile,
        }).unwrap();
        newAvatarUrl = uploadResult.publicUrl;
        toast.success("Avatar uploaded!");
      } catch (err) {
        handleMutationError(err, "upload avatar");
      }
    }

    // 2. Update profile details (including potentially new avatar URL)
    console.log("Attempting to update profile with payload:", {
      id: userId,
      name: profileDetails.name,
      type: profileDetails.type,
      role: profileDetails.role,
      phone: profileDetails.phone,
      avatar_url: newAvatarUrl,
    });
    try {
      const profileUpdatePayload = {
        id: userId,
        name: profileDetails.name,
        type: [profileDetails.type],
        phone: profileDetails.phone,
        role: profileDetails.role,
        avatar_url: newAvatarUrl,
      };
      await updateProfile(profileUpdatePayload).unwrap();
      toast.success("Profile updated!");
      console.log("Profile update successful, closing modal.");
      setIsEditProfileModalOpen(false); // Close modal on successful profile update
    } catch (err) {
      console.error(
        "Profile update failed after potential avatar upload:",
        err
      );
      handleMutationError(err, "update profile");
    }
  };

  return (
    <div className="flex flex-col min-h-screen pt-16">
      <Toaster />
      {isFetchingOverview && (
        <div className="fixed top-4 right-4 z-50 bg-blue-100 text-blue-700 px-3 py-1 rounded text-sm">
          Updating...
        </div>
      )}
      <main className="flex-grow container max-w-6xl mx-auto px-4 py-12 md:px-8">
        <ProfileHeader
          user={{
            name: currentProfile.name ?? "Unnamed User",
            avatarUrl: currentProfile.avatar_url || "",
            isVerified: false,
            typeBadges: userTypeBadges, // Use the processed type labels for badges
            roleDisplayText: roleLabels, // Use the processed role labels for display text
          }}
          onEdit={handleEditProfile}
        />

        <ProfileTabs
          role={resolvedRole}
          project={{
            title: currentProject.title ?? "Untitled Project",
            tags: projectTagsForDisplay, // Changed to use labels for display
            description:
              currentProject.description ?? "No description available.",
            contactInfo: {
              location: currentProject.location ?? null,
              website: currentProject.website ?? null,
              portfolio: currentProject.portfolio ?? null,
              email: currentProject.email ?? null,
            },
            fundingInfo: {
              investment: currentProject.investment ?? null,
              currency: currentProject.currency ?? null,
              cofounders: projectCofounderArray,
              partners: projectPartnerArray,
            },
          }}
          detailInfo={detailInfoForTabs}
          onEditProject={handleEditProject}
          onEditContact={handleEditContact}
          onEditAbout={handleEditAbout}
          onEditFunding={handleEditFunding}
        />
      </main>
      <CompleteProfileModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        initialData={profileInfoForModal}
        onSave={handleSaveProfileInfo}
      />
    </div>
  );
};

export default ProfilePage;