package com.pikasonix.wayo.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.pikasonix.wayo.ui.screens.AssignedRoutesScreen
import com.pikasonix.wayo.ui.screens.LoginScreen
import com.pikasonix.wayo.ui.screens.RoutingScreen
import com.pikasonix.wayo.ui.screens.SignUpScreen
import com.pikasonix.wayo.ui.screens.VehicleSelectionScreen

/**
 * Navigation routes for the app
 */
sealed class Screen(val route: String) {
    data object Login : Screen("login")
    data object Routing : Screen("routing")
    data object SignUp : Screen("signup")
    data object ForgotPassword : Screen("forgot_password")
    data object VehicleSelection : Screen("vehicle_selection/{driverId}/{organizationId}")
    data object AssignedRoutes : Screen("assigned_routes/{driverId}")
}

/**
 * Main navigation graph for the app
 */
@Composable
fun WayoNavGraph(
    navController: NavHostController = rememberNavController(),
    startDestination: String = Screen.Login.route
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        // Login Screen
        composable(route = Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.Routing.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onNavigateToSignUp = {
                    navController.navigate(Screen.SignUp.route)
                },
                onNavigateToForgotPassword = {
                    navController.navigate(Screen.ForgotPassword.route)
                }
            )
        }
        
        // Routing Screen
        composable(route = Screen.Routing.route) {
            RoutingScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }
        
        // Sign Up Screen
        composable(route = Screen.SignUp.route) {
            SignUpScreen(
                onSignUpSuccess = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.SignUp.route) { inclusive = true }
                    }
                },
                onNavigateToLogin = {
                    navController.popBackStack()
                }
            )
        }
        
        // Forgot Password Screen (placeholder)
        composable(route = Screen.ForgotPassword.route) {
            // TODO: Implement ForgotPasswordScreen
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(Screen.Routing.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onNavigateToSignUp = {
                    navController.navigate(Screen.SignUp.route)
                },
                onNavigateToForgotPassword = { }
            )
        }

        // Vehicle Selection Screen
        composable(route = "vehicle_selection/{driverId}/{organizationId}") { backStackEntry ->
            val driverId = backStackEntry.arguments?.getString("driverId") ?: ""
            val organizationId = backStackEntry.arguments?.getString("organizationId") ?: ""
            
            VehicleSelectionScreen(
                driverId = driverId,
                organizationId = organizationId,
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        // Assigned Routes Screen
        composable(route = "assigned_routes/{driverId}") { backStackEntry ->
            val driverId = backStackEntry.arguments?.getString("driverId") ?: ""
            
            AssignedRoutesScreen(
                driverId = driverId,
                onRouteSelected = { routeId ->
                    // TODO: Navigate to route details
                },
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }
    }
}
