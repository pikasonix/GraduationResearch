package com.pikasonix.wayo.data.model

/**
 * Điểm vị trí trên bản đồ
 */
data class LocationPoint(
    val latitude: Double,
    val longitude: Double,
    val name: String? = null,
    val address: String? = null
)

/**
 * Bước tuyến đường chứa hướng dẫn điều hướng
 */
data class RouteStep(
    val instruction: String,
    val distance: Double, // mét
    val duration: Double, // giây
    val maneuver: String? = null,
    val name: String? = null, // tên đường/phố
    val coordinates: List<LocationPoint> = emptyList()
)

/**
 * Annotation của chặng tuyến đường chứa dữ liệu giao thông/tắc nghẫn
 */
data class RouteAnnotation(
    val congestion: List<String> = emptyList(), // thấp, vừa, nặng, nghiêm trọng, không xác định
    val speed: List<Double> = emptyList(), // tốc độ tính bằng m/s cho từng đoạn
    val duration: List<Double> = emptyList() // thời lượng tính bằng giây cho từng đoạn
)

/**
 * Chặng tuyến đường từ một điểm dừng đến điểm khác
 */
data class RouteLeg(
    val distance: Double,
    val duration: Double,
    val steps: List<RouteStep> = emptyList(),
    val annotation: RouteAnnotation? = null,
    val summary: String? = null
)

/**
 * Thông tin tuyến đường từ điểm xuất phát đến điểm đến
 */
data class RouteInfo(
    val origin: LocationPoint,
    val destination: LocationPoint,
    val waypoints: List<LocationPoint> = emptyList(),
    val distance: Double, // mét
    val duration: Double, // giây
    val geometry: List<LocationPoint> = emptyList(),
    val steps: List<RouteStep> = emptyList(),
    val legs: List<RouteLeg> = emptyList(),
    val summary: String? = null
)

/**
 * Wrapper kết quả tuyến đường
 */
sealed class RouteResult {
    data class Success(val routes: List<RouteInfo>) : RouteResult()
    data class Error(val message: String) : RouteResult()
    data object Loading : RouteResult()
}
