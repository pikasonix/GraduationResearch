package com.pikasonix.wayo.data.remote

import com.pikasonix.wayo.BuildConfig
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest

/**
 * Supabase client configuration
 * Values are loaded from local.properties via BuildConfig
 */
object SupabaseConfig {
    val SUPABASE_URL: String = BuildConfig.SUPABASE_URL
    val SUPABASE_ANON_KEY: String = BuildConfig.SUPABASE_ANON_KEY
}

/**
 * Singleton Supabase client instance
 */
object SupabaseClientProvider {
    val client: SupabaseClient by lazy {
        createSupabaseClient(
            supabaseUrl = SupabaseConfig.SUPABASE_URL,
            supabaseKey = SupabaseConfig.SUPABASE_ANON_KEY
        ) {
            install(Auth)
            install(Postgrest)
        }
    }
}
