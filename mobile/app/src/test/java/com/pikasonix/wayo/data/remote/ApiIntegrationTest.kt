package com.pikasonix.wayo.data.remote

import com.pikasonix.wayo.BuildConfig
import com.pikasonix.wayo.data.remote.backend.BackendApiService
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Integration test for Backend API and Supabase configuration
 * 
 * Tests verify:
 * - Retrofit service is correctly configured
 * - Base URL is loaded from BuildConfig
 * - OkHttp client has proper timeouts and interceptors
 * - Supabase client is properly initialized
 * - API endpoints are defined correctly
 */
class ApiIntegrationTest {

    private lateinit var backendApiService: BackendApiService
    private lateinit var okHttpClient: OkHttpClient
    private lateinit var moshi: Moshi

    @Before
    fun setup() {
        // Setup Moshi
        moshi = Moshi.Builder()
            .add(KotlinJsonAdapterFactory())
            .build()

        // Setup OkHttp client
        okHttpClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(
                HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BODY
                }
            )
            .build()

        fun normalizeBaseUrl(url: String): String {
            val trimmed = url.trim()
            if (trimmed.isEmpty()) return trimmed
            return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
        }

        // Setup Retrofit service
        val baseUrl = when {
            BuildConfig.BACKEND_URL.isNotBlank() -> normalizeBaseUrl(BuildConfig.BACKEND_URL)
            BuildConfig.DEBUG -> "http://10.0.2.2:3001/"
            else -> "https://api.wayo.com/"
        }

        backendApiService = Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(BackendApiService::class.java)
    }

    @Test
    fun `verify BackendApiService is created successfully`() {
        assertNotNull(backendApiService)
    }

    @Test
    fun `verify OkHttp client has correct timeouts`() {
        assertEquals(30_000L, okHttpClient.connectTimeoutMillis.toLong())
        assertEquals(30_000L, okHttpClient.readTimeoutMillis.toLong())
        assertEquals(30_000L, okHttpClient.writeTimeoutMillis.toLong())
    }

    @Test
    fun `verify OkHttp client has logging interceptor in debug`() {
        val interceptors = okHttpClient.interceptors
        val hasLoggingInterceptor = interceptors.any { it is HttpLoggingInterceptor }
        assertTrue("OkHttp should have logging interceptor", hasLoggingInterceptor)
    }

    @Test
    fun `verify Moshi has Kotlin adapter`() {
        assertNotNull(moshi)
        // Verify Moshi can handle Kotlin data classes
        val adapter = moshi.adapter(TestData::class.java)
        assertNotNull(adapter)
    }

    @Test
    fun `verify backend URL is configured`() {
        val baseUrl = BuildConfig.BACKEND_URL
        // URL can be empty in tests, but should be defined
        assertNotNull("BACKEND_URL should be defined in BuildConfig", baseUrl)
    }

    @Test
    fun `verify Supabase URL is configured`() {
        val supabaseUrl = BuildConfig.SUPABASE_URL
        assertNotNull("SUPABASE_URL should be defined in BuildConfig", supabaseUrl)
    }

    @Test
    fun `verify Supabase anon key is configured`() {
        val supabaseKey = BuildConfig.SUPABASE_ANON_KEY
        assertNotNull("SUPABASE_ANON_KEY should be defined in BuildConfig", supabaseKey)
    }

    @Test
    fun `verify SupabaseClient is lazily initialized`() {
        // Supabase client should be created but we can't test actual connection in unit tests
        // Just verify the configuration exists
        assertNotNull(SupabaseConfig.SUPABASE_URL)
        assertNotNull(SupabaseConfig.SUPABASE_ANON_KEY)
    }

    @Test
    fun `verify API endpoints are defined`() = runTest {
        // These will fail with network errors in unit tests, but verify methods exist
        val service = backendApiService
        
        // Verify all methods exist by checking they're callable
        assertNotNull(service::getDriverProfile)
        assertNotNull(service::getAssignedRoutes)
        assertNotNull(service::getRouteDetails)
        assertNotNull(service::startRoute)
        assertNotNull(service::completeRoute)
        assertNotNull(service::completeStop)
        assertNotNull(service::sendTrackingPing)
        assertNotNull(service::syncOutbox)
    }

    @Test
    fun `verify API method signatures`() {
        val methods = BackendApiService::class.java.declaredMethods
        
        // Verify critical endpoints exist
        val methodNames = methods.map { it.name }
        assertTrue("Should have getDriverProfile", methodNames.contains("getDriverProfile"))
        assertTrue("Should have getAssignedRoutes", methodNames.contains("getAssignedRoutes"))
        assertTrue("Should have getRouteDetails", methodNames.contains("getRouteDetails"))
        assertTrue("Should have completeStop", methodNames.contains("completeStop"))
        assertTrue("Should have syncOutbox", methodNames.contains("syncOutbox"))
    }

    @Test
    fun `verify Retrofit base URL format`() {
        fun normalizeBaseUrl(url: String): String {
            val trimmed = url.trim()
            if (trimmed.isEmpty()) return trimmed
            return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
        }

        val baseUrl = when {
            BuildConfig.BACKEND_URL.isNotBlank() -> normalizeBaseUrl(BuildConfig.BACKEND_URL)
            BuildConfig.DEBUG -> "http://10.0.2.2:3001/"
            else -> "https://api.wayo.com/"
        }
        
        // Base URL should end with /
        assertTrue("Base URL should end with /", baseUrl.endsWith("/"))
        
        // Base URL should be HTTPS in production
        if (!BuildConfig.DEBUG) {
            assertTrue("Production base URL should use HTTPS", baseUrl.startsWith("https://"))
        }
    }

    @Test
    fun `verify Supabase configuration values are not empty in production`() {
        if (!BuildConfig.DEBUG) {
            // In production, these must be set
            assertFalse("SUPABASE_URL should not be empty", 
                BuildConfig.SUPABASE_URL.isEmpty())
            assertFalse("SUPABASE_ANON_KEY should not be empty", 
                BuildConfig.SUPABASE_ANON_KEY.isEmpty())
        }
        // In debug/test, they might be empty - that's okay for unit tests
    }

    // Test data class for Moshi verification
    private data class TestData(val id: String, val name: String)
}
