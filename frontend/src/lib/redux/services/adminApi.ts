import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/supabase/client";
import type { FetchBaseQueryError } from "@reduxjs/toolkit/query";

/**
 * Formats a Supabase PostgrestError into an RTK Query FetchBaseQueryError shape.
 * @param error - The Supabase error object.
 * @returns An object conforming to FetchBaseQueryError.
 */
function formatSupabaseError(error: PostgrestError): FetchBaseQueryError {
  let status: number | "CUSTOM_ERROR" = "CUSTOM_ERROR";
  const message = error.message || "An unknown Supabase error occurred";

  if ("code" in error && error.code) {
    if (error.code.startsWith("PGRST")) {
      status = 500;
    } else {
      const parsedCode = parseInt(error.code, 10);
      status = !isNaN(parsedCode) ? parsedCode : "CUSTOM_ERROR";
    }
  }

  if (status === "CUSTOM_ERROR") {
    return {
      status: "CUSTOM_ERROR",
      error: message,
      data: undefined,
    };
  } else {
    return {
      status: status,
      data: message,
    };
  }
}

/**
 * Admin API service for checking admin status and other admin features
 */
export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: fetchBaseQuery({ baseUrl: "/" }),
  tagTypes: ["AdminStatus"],
  endpoints: (builder) => ({
    /**
     * Check if a user has admin access
     * @param userId - The user ID to check admin status for
     * @returns Boolean indicating if user has admin access
     */
    checkAdminStatus: builder.query<boolean, string>({
      queryFn: async (userId) => {
        try {
          const { data, error } = await supabase
            .from("account_features")
            .select("is_admin")
            .eq("id", userId)
            .maybeSingle();

          if (error) return { error: formatSupabaseError(error) };

          // User has admin access if a row exists with is_admin = true
          return { data: data?.is_admin === true };
        } catch (error) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error: `Failed to check admin status: ${error}`,
            },
          };
        }
      },
      providesTags: (_result, _error, arg) =>
        arg ? [{ type: "AdminStatus" as const, id: arg }] : [],
    }),
  }),
});

// Export hooks for usage in components
export const { useCheckAdminStatusQuery } = adminApi;
