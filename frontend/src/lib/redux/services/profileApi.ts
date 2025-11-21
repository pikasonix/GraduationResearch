import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { PostgrestError } from "@supabase/supabase-js";
import type { StorageError } from "@supabase/storage-js";
import { supabase } from "@/supabase/client";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query"; // Import FetchBaseQueryError

// Define Profile type based on DB schema (adjust nullability as needed)
export interface DbProfile {
  id: string;
  name: string | null;
  avatar_url: string | null;
  intro: string | null;
  type: string[] | string | null;
  role: string[] | string | null;
  phone?: string | null;
  updated_at?: string;
}

// Define Project type based on DB schema (adjust nullability)
export interface DbProject {
  id: string;
  user_id: string;
  title: string | null;
  tags: string[] | string | null;
  description: string | null;
  location: string | null;
  website: string | null;
  portfolio: string | null;
  email: string | null;
  investment: string | null;
  currency: string | null;
  cofounders: string[] | string | null;
  partners: string[] | string | null;
  start_date: string | null; // Date as string for simplicity
  end_date: string | null; // Date as string
  created_at?: string;
  updated_at?: string;
}

// Define a type for the funding info payload expected by the backend
export interface FundingInfoPayload {
  investment: string | null;
  currency: string | null;
  cofounders: string[];
  partners: string[];
  startDate?: string | null;
  endDate?: string | null; // Optional to align with new profile flows
}

export interface ProjectBasicsPayload {
  title: string | null;
  tags: string[];
  description?: string | null;
}

export interface ProjectContactInfoPayload {
  location: string | null;
  website: string | null;
  portfolio: string | null;
  email: string | null;
}

// Define a new type for the combined Project and Profile data
export interface ProjectWithFounder extends DbProject {
  profiles: {
    name: string | null;
    role: string[] | null;
    avatar_url: string | null;
    type: string[] | null;
  } | null; // Profile might not exist, handle null
}

export interface ProfileOverview {
  profile: DbProfile | null;
  project: ProjectWithFounder | null;
}

const ensureStringArray = (
  value: string[] | string | null | undefined
): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string" && value.trim().length > 0) {
    return [value];
  }
  return [];
};

const arrayOrNull = (value: string[]): string[] | null =>
  value.length > 0 ? value : null;

const normalizeProfile = (profile: DbProfile | null): DbProfile | null => {
  if (!profile) return null;
  const typeArray = ensureStringArray(profile.type);
  const roleArray = ensureStringArray(profile.role);
  return {
    ...profile,
    type: profile.type === null ? null : arrayOrNull(typeArray),
    role: profile.role === null ? null : arrayOrNull(roleArray),
  };
};

const normalizeProject = <T extends DbProject | null>(project: T): T => {
  if (!project) return project;
  const normalized = {
    ...project,
    tags: arrayOrNull(ensureStringArray(project.tags)),
    cofounders: arrayOrNull(ensureStringArray(project.cofounders)),
    partners: arrayOrNull(ensureStringArray(project.partners)),
  } as DbProject;
  return normalized as T;
};

const normalizeProjectWithFounder = (
  project: (ProjectWithFounder | null) | (DbProject & { profiles?: any }) | null
): ProjectWithFounder | null => {
  if (!project) return null;
  const { profiles, ...rest } = project as ProjectWithFounder;
  return {
    ...(normalizeProject(rest as DbProject) as DbProject),
    profiles: profiles ?? null,
  };
};

// --- Helper function to format Supabase errors for RTK Query ---
/**
 * Formats a Supabase PostgrestError or StorageError into an RTK Query FetchBaseQueryError shape.
 * @param error - The Supabase error object.
 * @returns An object conforming to FetchBaseQueryError.
 */
function formatSupabaseError(
  error: PostgrestError | StorageError
): FetchBaseQueryError {
  let status: number | "CUSTOM_ERROR" = "CUSTOM_ERROR"; // Default status for RTK Query errors
  const message = error.message || "An unknown Supabase error occurred";

  // Try to map PostgrestError codes (often strings like 'PGRSTXXX') to numeric or custom statuses
  if ("code" in error && error.code) {
    // Simple mapping: Use 500 for server errors, 400 for potential client errors, else CUSTOM_ERROR
    // This is a basic heuristic and might need refinement based on specific PGRST codes
    if (error.code.startsWith("PGRST")) {
      status = 500; // Assume server-side issue with PostgREST
    } else {
      // Attempt to parse other codes as numbers if possible
      const parsedCode = parseInt(error.code, 10);
      status = !isNaN(parsedCode) ? parsedCode : "CUSTOM_ERROR";
    }
  } else if (error instanceof Error && !(error instanceof PostgrestError)) {
    // Handle StorageError or other generic errors - use a generic server error status
    status = 500;
  }

  // Conditionally return the object shape based on whether status is 'CUSTOM_ERROR' or a number
  if (status === "CUSTOM_ERROR") {
    return {
      status: "CUSTOM_ERROR",
      error: message, // Include the error message string when status is CUSTOM_ERROR
      data: undefined, // data is optional here
    };
  } else {
    // status is a number here
    return {
      status: status,
      data: message, // Put the original error message in the data field when status is a number
    };
  }
}

// --- RTK Query API Slice Definition ---
export const profileApi = createApi({
  reducerPath: "profileApi",
  // baseQuery: supabaseBaseQuery, // Using direct Supabase calls in endpoints is easier here
  baseQuery: fetchBaseQuery({ baseUrl: "/" }), // Dummy baseQuery, endpoints handle Supabase calls
  tagTypes: ["Profile", "Project"], // Define tags for caching

  endpoints: (builder) => ({
    // --- Profile Endpoints ---
    getProfile: builder.query<DbProfile | null, string>({
      // Arg: userId
      queryFn: async (userId) => {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle(); // Returns single object or null
        if (error) return { error: formatSupabaseError(error) };
        return { data: normalizeProfile(data as DbProfile | null) };
      },
      providesTags: (result) =>
        result ? [{ type: "Profile", id: result.id }] : [],
    }),

    updateProfile: builder.mutation<
      DbProfile,
      Partial<DbProfile> & { id: string }
    >({
      queryFn: async (profileUpdate) => {
        const { id, ...updateData } = profileUpdate;

        const payload: Partial<DbProfile> & { id: string; updated_at: string } = {
          ...updateData,
          id,
          updated_at: new Date().toISOString(),
        };

        if (updateData.type !== undefined) {
          const normalizedType = ensureStringArray(updateData.type);
          payload.type = normalizedType.length ? normalizedType : null;
        }

        if (updateData.role !== undefined) {
          const normalizedRole = ensureStringArray(updateData.role);
          payload.role = normalizedRole.length ? normalizedRole : null;
        }

        const { data, error } = await supabase
          .from("profiles")
          .upsert(payload)
          .select()
          .single();

        if (error) return { error: formatSupabaseError(error) };
        return { data: normalizeProfile(data as DbProfile) as DbProfile };
      },
      invalidatesTags: (result, error, profileUpdate) =>
        profileUpdate ? [{ type: "Profile", id: profileUpdate.id }] : [],
    }),

    uploadAvatar: builder.mutation<
      { path: string; publicUrl: string },
      { file: File; userId: string }
    >({
      queryFn: async ({ file, userId }) => {
        const fileExt = file.name.split(".").pop();
        const filePath = `/${userId}/avatar-${Date.now()}.${fileExt}`; // Unique path per user

        const { error: uploadError } = await (supabase.storage as any)
          .from("avatars") // Your bucket name
          .upload(filePath, file, { upsert: true }); // Use upsert to overwrite

        if (uploadError) return { error: formatSupabaseError(uploadError) };

        // Get public URL
        const { data: urlData } = (supabase.storage as any)
          .from("avatars")
          .getPublicUrl(filePath);

        return { data: { path: filePath, publicUrl: urlData.publicUrl } };
      },
      // Doesn't directly invalidate profile cache,
      // updateProfile should be called after with the new URL
    }),

    // --- Project Endpoints ---
    getAllProjects: builder.query<ProjectWithFounder[], void>({
      queryFn: async () => {
        // Modify select to fetch related profile data
        const { data, error } = await supabase.from("projects").select(`
            *,
            profiles (
              name,
              role,
              avatar_url,
              type
            )
          `);

        if (error) return { error: formatSupabaseError(error) };
        const projects = Array.isArray(data) ? (data as ProjectWithFounder[]) : [];
        const normalized = projects
          .map((project) => normalizeProjectWithFounder(project))
          .filter((project): project is ProjectWithFounder => Boolean(project));
        return { data: normalized };
      },
      // Provide a general tag for the list of projects
      providesTags: (result) =>
        result
          ? [
            // Provide a specific tag for each project
            ...result.map(({ id }) => ({ type: "Project" as const, id })),
            { type: "Project", id: "LIST" },
          ]
          : [{ type: "Project", id: "LIST" }],
    }),

    getProject: builder.query<DbProject | null, string>({
      // Arg: userId
      queryFn: async (userId) => {
        const { data, error } = await supabase
          .from("projects")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle(); // Assume one project per user for now

        if (error) return { error: formatSupabaseError(error) };
        return { data: normalizeProject(data as DbProject | null) };
      },
      providesTags: (result, error, userId) =>
        userId ? [{ type: "Project", id: userId }] : [],
    }),

    getProjectById: builder.query<ProjectWithFounder | null, string>({
      // Arg: projectId
      queryFn: async (projectId) => {
        const { data, error } = await supabase
          .from("projects")
          .select(
            `
            *,
            profiles (
              name,
              role,
              avatar_url,
              type,
              intro
            )
          `
          )
          .eq("id", projectId)
          .maybeSingle(); // Returns single object or null
        if (error) return { error: formatSupabaseError(error) };
        return {
          data: normalizeProjectWithFounder(data as ProjectWithFounder | null),
        };
      },
      providesTags: (result, error, projectId) =>
        result ? [{ type: "Project", id: projectId }] : [],
    }),

    getProfileOverview: builder.query<ProfileOverview, string>({
      queryFn: async (userId) => {
        if (!userId) {
          return { data: { profile: null, project: null } };
        }
        const [profileResult, projectResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle(),
          supabase
            .from("projects")
            .select(
              `
              *,
              profiles (
                name,
                role,
                avatar_url,
                type,
                intro
              )
            `
            )
            .eq("user_id", userId)
            .maybeSingle(),
        ]);

        const profileError = profileResult.error;
        if (profileError) return { error: formatSupabaseError(profileError) };

        const projectError = projectResult.error;
        if (projectError) return { error: formatSupabaseError(projectError) };

        return {
          data: {
            profile: normalizeProfile(profileResult.data as DbProfile | null),
            project: normalizeProjectWithFounder(
              projectResult.data as ProjectWithFounder | null
            ),
          },
        };
      },
      providesTags: (result, error, userId) =>
        userId
          ? [
            { type: "Profile", id: userId },
            { type: "Project", id: userId },
          ]
          : [],
    }),

    updateProjectBasics: builder.mutation<
      DbProject,
      { userId: string; basics: ProjectBasicsPayload }
    >({
      queryFn: async ({ userId, basics }) => {
        const payload: Partial<DbProject> & { user_id: string; updated_at: string } = {
          user_id: userId,
          title: basics.title,
          tags: basics.tags ?? [],
          updated_at: new Date().toISOString(),
        };

        if (basics.description !== undefined) {
          payload.description = basics.description;
        }

        const { data, error } = await supabase
          .from("projects")
          .upsert(payload, { onConflict: "user_id" })
          .select()
          .single();

        if (error) return { error: formatSupabaseError(error) };
        return {
          data: normalizeProject(data as DbProject) as DbProject,
        };
      },
      invalidatesTags: (result, error, { userId }) =>
        userId
          ? [
            { type: "Project", id: userId },
            { type: "Project", id: "LIST" },
          ]
          : [],
    }),

    updateProjectContact: builder.mutation<
      DbProject,
      { userId: string; contact: ProjectContactInfoPayload }
    >({
      queryFn: async ({ userId, contact }) => {
        const payload: Partial<DbProject> & { user_id: string; updated_at: string } = {
          user_id: userId,
          location: contact.location,
          website: contact.website,
          portfolio: contact.portfolio,
          email: contact.email,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("projects")
          .upsert(payload, { onConflict: "user_id" })
          .select()
          .single();

        if (error) return { error: formatSupabaseError(error) };
        return {
          data: normalizeProject(data as DbProject) as DbProject,
        };
      },
      invalidatesTags: (result, error, { userId }) =>
        userId
          ? [
            { type: "Project", id: userId },
            { type: "Project", id: "LIST" },
          ]
          : [],
    }),

    updateProjectFunding: builder.mutation<
      DbProject,
      { userId: string; fundingInfo: FundingInfoPayload }
    >({
      queryFn: async ({ userId, fundingInfo }) => {
        const {
          startDate,
          endDate,
          investment,
          currency,
          cofounders,
          partners,
        } = fundingInfo;

        // Construct the payload only with fields that exist in DbProject
        const payload: Partial<DbProject> & { user_id: string } = {
          user_id: userId,
          investment,
          currency,
          cofounders: cofounders ?? [],
          partners: partners ?? [],
          updated_at: new Date().toISOString(),
        };

        if (startDate !== undefined) {
          payload.start_date = startDate ?? null;
        }

        if (endDate !== undefined) {
          payload.end_date = endDate ?? null;
        }

        const { data, error } = await supabase
          .from("projects")
          .upsert(payload, { onConflict: "user_id" })
          .select()
          .single();
        if (error) return { error: formatSupabaseError(error) };
        return {
          data: normalizeProject(data as DbProject) as DbProject,
        };
      },
      invalidatesTags: (result, error, { userId }) =>
        userId
          ? [
            { type: "Project", id: userId },
            { type: "Project", id: "LIST" },
          ]
          : [],
    }),

    updateProjectAbout: builder.mutation<
      DbProject,
      { userId: string; about: string }
    >({
      queryFn: async ({ userId, about }) => {
        // Prepare payload for upsert
        const payload: Partial<DbProject> & { user_id: string } = {
          user_id: userId,
          description: about,
          updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
          .from("projects")
          // Specify user_id as the conflict target for upsert
          .upsert(payload, { onConflict: "user_id" })
          .select()
          .single();

        if (error) return { error: formatSupabaseError(error) };
        return {
          data: normalizeProject(data as DbProject) as DbProject,
        };
      },
      invalidatesTags: (result, error, { userId }) =>
        userId
          ? [
            { type: "Project", id: userId },
            { type: "Project", id: "LIST" },
          ]
          : [],
    }),
  }),
});

// Export hooks for usage in functional components
export const {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useUploadAvatarMutation,
  useGetProfileOverviewQuery,
  useGetAllProjectsQuery,
  useGetProjectQuery,
  useGetProjectByIdQuery,
  useUpdateProjectBasicsMutation,
  useUpdateProjectContactMutation,
  useUpdateProjectFundingMutation,
  useUpdateProjectAboutMutation,
} = profileApi;
