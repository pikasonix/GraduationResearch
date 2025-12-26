import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { PostgrestError } from "@supabase/supabase-js";
import type { StorageError } from "@supabase/storage-js";
import { supabase } from "@/supabase/client";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";
import type { DispatchSettings } from "@/lib/dispatchSettings";

// User role enum matching database
export type UserRole = "super_admin" | "admin" | "manager" | "driver" | "user";

// User type based on public.users table
export interface DbUser {
  id: string;
  organization_id: string;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  last_login_at: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// Organization type based on public.organizations table
export interface DbOrganization {
  id: string;
  name: string;
  account_type: "enterprise" | "individual";
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  tax_code: string | null;
  depot_name?: string | null;
  depot_address?: string | null;
  depot_latitude?: number | null;
  depot_longitude?: number | null;
  dispatch_settings?: DispatchSettings | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// User with organization data
export interface UserWithOrganization extends DbUser {
  organization: DbOrganization | null;
}

// User profile overview
export interface UserProfileOverview {
  user: DbUser | null;
  organization: DbOrganization | null;
}

// Format Supabase errors for RTK Query
function formatSupabaseError(error: PostgrestError | StorageError): FetchBaseQueryError {
  const message = error.message || "An unknown Supabase error occurred";
  let status: number | "CUSTOM_ERROR" = "CUSTOM_ERROR";

  if ("code" in error && error.code) {
    if (error.code.startsWith("PGRST")) {
      status = 500;
    } else {
      const parsedCode = parseInt(error.code, 10);
      status = !isNaN(parsedCode) ? parsedCode : "CUSTOM_ERROR";
    }
  } else if (error instanceof Error && !(error instanceof PostgrestError)) {
    status = 500;
  }

  if (status === "CUSTOM_ERROR") {
    return { status: "CUSTOM_ERROR", error: message, data: undefined };
  }
  return { status: status as number, data: message };
}

export const userApi = createApi({
  reducerPath: "userApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/" }),
  tagTypes: ["User", "Organization"],

  endpoints: (builder) => ({
    // Get current user profile
    getUser: builder.query<DbUser | null, string>({
      queryFn: async (userId) => {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (error) return { error: formatSupabaseError(error) };
        return { data: data as DbUser | null };
      },
      providesTags: (result) =>
        result ? [{ type: "User", id: result.id }] : [],
    }),

    // Get user with organization
    getUserWithOrganization: builder.query<UserWithOrganization | null, string>({
      queryFn: async (userId) => {
        const { data, error } = await supabase
          .from("users")
          .select(`
            *,
            organization:organizations(*)
          `)
          .eq("id", userId)
          .maybeSingle();
        if (error) return { error: formatSupabaseError(error) };
        return { data: data as UserWithOrganization | null };
      },
      providesTags: (result) =>
        result
          ? [
              { type: "User", id: result.id },
              { type: "Organization", id: result.organization_id },
            ]
          : [],
    }),

    // Get user profile overview (user + organization)
    getUserProfileOverview: builder.query<UserProfileOverview, string>({
      queryFn: async (userId) => {
        if (!userId) {
          return { data: { user: null, organization: null } };
        }

        const { data: user, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (userError) return { error: formatSupabaseError(userError) };
        if (!user) return { data: { user: null, organization: null } };

        const { data: organization, error: orgError } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", user.organization_id)
          .maybeSingle();

        if (orgError) return { error: formatSupabaseError(orgError) };

        return {
          data: {
            user: user as DbUser,
            organization: organization as DbOrganization | null,
          },
        };
      },
      providesTags: (result, error, userId) =>
        userId
          ? [
              { type: "User", id: userId },
              { type: "Organization", id: result?.organization?.id ?? "unknown" },
            ]
          : [],
    }),

    // Update user profile
    updateUser: builder.mutation<DbUser, Partial<DbUser> & { id: string }>({
      queryFn: async (userUpdate) => {
        const { id, ...updateData } = userUpdate;

        const payload = {
          ...updateData,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("users")
          .update(payload)
          .eq("id", id)
          .select()
          .single();

        if (error) return { error: formatSupabaseError(error) };
        return { data: data as DbUser };
      },
      invalidatesTags: (result, error, { id }) =>
        id ? [{ type: "User", id }] : [],
    }),

    // Update organization
    updateOrganization: builder.mutation<
      DbOrganization,
      Partial<DbOrganization> & { id: string }
    >({
      queryFn: async (orgUpdate) => {
        const { id, ...updateData } = orgUpdate;

        const payload = {
          ...updateData,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("organizations")
          .update(payload)
          .eq("id", id)
          .select("*")
          .maybeSingle();

        if (error) return { error: formatSupabaseError(error) };
        if (!data) {
          return {
            error: {
              status: 403,
              data: "Không thể cập nhật organization (có thể do phân quyền RLS hoặc không tìm thấy bản ghi)",
            },
          };
        }
        return { data: data as DbOrganization };
      },
      invalidatesTags: (result, error, { id }) =>
        id ? [{ type: "Organization", id }] : [],
    }),

    // Get all users in organization (for admin/manager)
    getOrganizationUsers: builder.query<DbUser[], string>({
      queryFn: async (organizationId) => {
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("is_active", true)
          .order("created_at", { ascending: false });

        if (error) return { error: formatSupabaseError(error) };
        return { data: (data as DbUser[]) ?? [] };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "User" as const, id })),
              { type: "User", id: "LIST" },
            ]
          : [{ type: "User", id: "LIST" }],
    }),

    // Upload avatar to Supabase Storage
    uploadAvatar: builder.mutation<
      { path: string; publicUrl: string },
      { file: File; userId: string }
    >({
      queryFn: async ({ file, userId }) => {
        const fileExt = file.name.split(".").pop();
        const filePath = `/${userId}/avatar-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, file, { upsert: true });

        if (uploadError) return { error: formatSupabaseError(uploadError) };

        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        return { data: { path: filePath, publicUrl: urlData.publicUrl } };
      },
    }),

    // Check if username is available
    checkUsername: builder.query<
      { available: boolean; exists: boolean },
      { username: string; currentUserId: string }
    >({
      queryFn: async ({ username, currentUserId }) => {
        if (!username || username.trim() === "") {
          return { data: { available: false, exists: false } };
        }

        const { data, error } = await supabase
          .from("users")
          .select("id")
          .eq("username", username)
          .maybeSingle();

        if (error) return { error: formatSupabaseError(error) };

        // If no user found, username is available
        if (!data) {
          return { data: { available: true, exists: false } };
        }

        // If found user is current user, it's their own username
        if (data.id === currentUserId) {
          return { data: { available: true, exists: false } };
        }

        // Username exists and belongs to someone else
        return { data: { available: false, exists: true } };
      },
    }),
  }),
});

export const {
  useGetUserQuery,
  useGetUserWithOrganizationQuery,
  useGetUserProfileOverviewQuery,
  useUpdateUserMutation,
  useUpdateOrganizationMutation,
  useGetOrganizationUsersQuery,
  useUploadAvatarMutation,
  useLazyCheckUsernameQuery,
} = userApi;
