pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

// Load local.properties for Mapbox token
val localPropertiesFile = file("local.properties")
val localProperties = java.util.Properties()
if (localPropertiesFile.exists()) {
    localProperties.load(localPropertiesFile.inputStream())
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        
        // Mapbox Maven repository
        maven {
            url = uri("https://api.mapbox.com/downloads/v2/releases/maven")
            credentials.username = "mapbox"
            credentials.password = localProperties.getProperty("MAPBOX_DOWNLOADS_TOKEN", "")
            authentication {
                create<BasicAuthentication>("basic")
            }
        }
    }
}

rootProject.name = "WAYO"
include(":app")
