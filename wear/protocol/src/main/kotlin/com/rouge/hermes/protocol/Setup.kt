package com.rouge.hermes.protocol

import java.net.URLDecoder
import java.time.Instant
import java.time.ZoneId

data class RelaySetup(val url: String, val token: String)

fun localDay(epochMs: Long, zone: ZoneId = ZoneId.of("UTC")): String =
    Instant.ofEpochMilli(epochMs).atZone(zone).toLocalDate().toString()

fun relayEndpoint(base: String, path: String): String {
    val trimmed = base.trim().trimEnd('/')
    val loopback = trimmed.startsWith("http://127.0.0.1") || trimmed.startsWith("http://localhost")
    if (!trimmed.startsWith("https://") && !loopback) error("relay URL must be https")
    if (!path.startsWith("/")) error("path")
    return trimmed + path
}

/** QR text, a hermes:// link, or two lines beginning url= and token=. */
fun parseRelaySetup(raw: String): RelaySetup? {
    val text = raw.trim()
    if (text.isEmpty()) return null
    if (text.startsWith("{")) {
        val obj = try {
            Json.parse(text) as? Json.Obj
        } catch (_: Exception) {
            null
        } ?: return null
        return accept(obj.str("url"), obj.str("token"))
    }
    if (text.startsWith("hermes://")) {
        val query = text.substringAfter("?", "")
        val map = queryMap(query)
        return accept(map["url"], map["token"])
    }
    var url: String? = null
    var token: String? = null
    for (line in text.lines().map { it.trim() }.filter { it.isNotEmpty() }) {
        val lower = line.lowercase()
        when {
            lower.startsWith("url=") -> url = line.substring(4).trim()
            lower.startsWith("token=") -> token = line.substring(6).trim()
            line.startsWith("https://") || line.startsWith("http://") -> url = line
        }
    }
    return accept(url, token)
}

private fun accept(url: String?, token: String?): RelaySetup? {
    if (url.isNullOrBlank() || token.isNullOrBlank() || token.length < 16) return null
    val trimmed = url.trim().trimEnd('/')
    val loopback = trimmed.startsWith("http://127.0.0.1") || trimmed.startsWith("http://localhost")
    if (!trimmed.startsWith("https://") && !loopback) return null
    return RelaySetup(trimmed, token.trim())
}

private fun queryMap(query: String): Map<String, String> {
    if (query.isEmpty()) return emptyMap()
    val map = linkedMapOf<String, String>()
    for (part in query.split("&")) {
        val key = part.substringBefore("=")
        val value = part.substringAfter("=", "")
        if (key.isEmpty()) continue
        map[decode(key)] = decode(value)
    }
    return map
}

private fun decode(value: String): String = URLDecoder.decode(value, Charsets.UTF_8.name())
