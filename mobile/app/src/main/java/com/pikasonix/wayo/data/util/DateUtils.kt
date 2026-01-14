package com.pikasonix.wayo.data.util

import java.time.Instant
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

object DateUtils {
    /**
     * Chuyển đổi chuỗi ISO 8601 sang epoch milliseconds
     * Ví dụ: "2024-01-20T10:30:00Z" -> 1705750200000
     */
    fun isoToEpochMillis(isoString: String?): Long? {
        if (isoString == null) return null
        return try {
            Instant.parse(isoString).toEpochMilli()
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Chuyển đổi epoch milliseconds sang chuỗi ISO 8601
     * Ví dụ: 1705750200000 -> "2024-01-20T10:30:00Z"
     */
    fun epochMillisToIso(epochMillis: Long?): String? {
        if (epochMillis == null) return null
        return try {
            Instant.ofEpochMilli(epochMillis).toString()
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Lấy thời gian hiện tại dưới dạng epoch milliseconds
     */
    fun now(): Long = System.currentTimeMillis()

    /**
     * Lấy thời gian hiện tại dưới dạng chuỗi ISO 8601
     */
    fun nowIso(): String = Instant.now().toString()
}
