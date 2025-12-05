plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)

// --- PLUGIN MỚI ---
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp) // Thay cho kapt
}

// Load local.properties
import java.util.Properties
val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localProperties.load(localPropertiesFile.inputStream())
}

android {
    namespace = "com.pikasonix.wayo"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.pikasonix.wayo"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        
        // Build Config fields from local.properties
        buildConfigField("String", "SUPABASE_URL", "\"${localProperties.getProperty("SUPABASE_URL", "")}\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"${localProperties.getProperty("SUPABASE_ANON_KEY", "")}\"")
        buildConfigField("String", "MAPBOX_ACCESS_TOKEN", "\"${localProperties.getProperty("MAPBOX_ACCESS_TOKEN", "")}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
    buildFeatures {
        compose = true
        buildConfig = true  // Enable BuildConfig generation
    }
}

dependencies {

    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)

    // 1. Dependency Injection
    implementation(libs.hilt.android)
    implementation(libs.hilt.navigation.compose)
    ksp(libs.hilt.compiler) // Dùng ksp thay vì kapt

    // 2. Navigation
    implementation(libs.androidx.navigation.compose)

    // 3. Network
    implementation(libs.retrofit)
    implementation(libs.retrofit.converter.gson)
    implementation(libs.okhttp.logging)

    // 4. Image Loading
    implementation(libs.coil.compose)

    // 5. Lifecycle Utilities
    implementation(libs.androidx.lifecycle.runtime.compose)

    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    // 6. Supabase
    implementation(platform(libs.supabase.bom))
    implementation(libs.supabase.auth)
    implementation(libs.supabase.postgrest)
    implementation(libs.ktor.client.android)

    // 7. Mapbox Maps
    implementation(libs.mapbox.maps)

    // 8. Material Icons Extended
    implementation(libs.androidx.compose.material.icons.extended)

    // 9. DataStore
    implementation(libs.androidx.datastore.preferences)

    // 10. Coroutines
    implementation(libs.kotlinx.coroutines.android)

    // 11. Google Play Services Location
    implementation(libs.play.services.location)

    // 12. Accompanist Permissions
    implementation(libs.accompanist.permissions)
}