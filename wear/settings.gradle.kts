pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "hermes-wear"
include(":protocol")
include(":relay")
include(":wear-app")
include(":phone-app")
project(":wear-app").projectDir = file("app")
project(":phone-app").projectDir = file("../mobile")
