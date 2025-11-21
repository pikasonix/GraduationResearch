/**
 * Authentication API service
 */
import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { supabase } from "@/supabase/client";
import { Session, User } from "@supabase/supabase-js";

/**
 * Auth response interface
 */
interface AuthResponse {
  user: User | null;
  session: Session | null;
  error: Error | null;
}

/**
 * Login credentials interface
 */
interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Signup credentials interface
 */
interface SignupCredentials {
  email: string;
  password: string;
  phone: string;
}

/**
 * Reset password credentials interface
 */
interface ResetPasswordCredentials {
  email: string;
}

/**
 * Auth API with RTK Query
 */
export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: fakeBaseQuery(),
  tagTypes: ["Auth", "User"],
  endpoints: (builder) => ({
    /**
     * Login endpoint using Supabase auth
     */
    login: builder.mutation<AuthResponse, LoginCredentials>({
      queryFn: async ({ email, password }) => {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            return { error: error };
          }

          return {
            data: { user: data.user, session: data.session, error: null },
          };
        } catch (error) {
          return { error: error as Error };
        }
      },
      invalidatesTags: ["Auth", "User"],
    }),

    /**
     * Signup endpoint using Supabase auth
     */
    signup: builder.mutation<AuthResponse, SignupCredentials>({
      queryFn: async ({ email, password, phone }) => {
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          });

          if (error) {
            return { error: error };
          }

          if (data.user) {
            // Save phone number to local storage to be picked up by profile page
            localStorage.setItem("pending-phone-update", phone);
          }

          return {
            data: { user: data.user, session: data.session, error: null },
          };
        } catch (error) {
          return { error: error as Error };
        }
      },
      invalidatesTags: ["Auth", "User"],
    }),

    /**
     * Reset password endpoint using Supabase auth
     * Sends a password reset email to the user
     */
    resetPassword: builder.mutation<
      { success: boolean; error: Error | null },
      ResetPasswordCredentials
    >({
      queryFn: async ({ email }) => {
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
          });

          if (error) {
            return { error: error };
          }

          return { data: { success: true, error: null } };
        } catch (error) {
          return { error: error as Error };
        }
      },
    }),

    /**
     * Logout endpoint using Supabase auth
     */
    logout: builder.mutation<void, void>({
      queryFn: async () => {
        try {
          const { error } = await supabase.auth.signOut();

          if (error) {
            // Check if it's an AuthSessionMissingError, which can happen
            // if the user's session has already expired or been removed
            const errMsg = (error as any)?.message ?? String(error);
            if (errMsg.includes("Auth session missing")) {
              // If session is already missing, consider this a successful logout
              return { data: undefined };
            }
            return { error: error };
          }

          return { data: undefined };
        } catch (error) {
          return { error: error as Error };
        }
      },
      invalidatesTags: ["Auth", "User"],
    }),

    /**
     * Get current session endpoint
     */
    getSession: builder.query<AuthResponse, void>({
      queryFn: async () => {
        try {
          const resp: any = await supabase.auth.getSession();
          const data = resp.data;
          const error = resp.error;

          if (error) {
            return { error: error };
          }

          return {
            data: {
              user: data?.session?.user || null,
              session: data?.session || null,
              error: null,
            },
          };
        } catch (error) {
          return { error: error as Error };
        }
      },
      providesTags: ["Auth"],
    }),
  }),
});

// Export hooks for usage in components
export const {
  useLoginMutation,
  useSignupMutation,
  useLogoutMutation,
  useGetSessionQuery,
  useResetPasswordMutation,
} = authApi;
