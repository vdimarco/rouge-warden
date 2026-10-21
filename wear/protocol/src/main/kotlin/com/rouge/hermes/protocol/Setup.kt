package com.rouge.hermes.protocol

import java.net.URLDecoder
import java.time.Instant
import java.time.ZoneId

data class RelaySetup(val url: String, val token: String)

fun localDay(epochMs: Long, zone: ZoneId = ZoneId.of("UTC")): String =
    Instant.ofEpochMilli(epochMs).atZone(zone).toLocalDate().toString()

fun relayEndpoint(base: String, path: String): String {
    val trimmed = base.trim().trimEnd('/')
    if (!isAllowedRelay(trimmed)) error("relay URL must be https or a private address")
    if (!path.startsWith("/")) error("path")
    return trimmed + path
}

/** QR text, a wristagent:// or hermes:// link, an https /pair link, or lines beginning url= and token=. */
fun parseRelaySetup(raw: String): RelaySetup? {
    val text = raw.trim()
    if (text.isEmpty()) return null
    if (text.startsWith("{")) {
        val obj = try {
            Json.parse(text) as? Json.Obj
        } catch (_: Exception) {
            null
        } ?: return null
        return accept(obj.str("u") ?: obj.str("url"), obj.str("k") ?: obj.str("token"))
    }
    if (text.startsWith("wristagent://") || text.startsWith("hermes://")) {
        val map = queryMap(text.substringAfter("?", ""))
        return accept(map["u"] ?: map["url"], map["k"] ?: map["token"])
    }
    if ((text.startsWith("https://") || text.startsWith("http://")) && text.contains("?")) {
        val map = queryMap(text.substringAfter("?", ""))
        val key = map["k"] ?: map["token"]
        if (!key.isNullOrBlank()) {
            return accept(map["u"] ?: map["url"] ?: text.substringBefore("?"), key)
        }
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

internal fun isAllowedRelay(url: String): Boolean {
    if (url.startsWith("https://")) return true
    if (!url.startsWith("http://")) return false
    val host = try {
        java.net.URI(url).host
    } catch (_: Exception) {
        return false
    } ?: return false
    if (host == "localhost") return true
    return isPrivateIPv4(host)
}

internal fun isPrivateIPv4(host: String): Boolean {
    val parts = host.split('.')
    if (parts.size != 4) return false
    val nums = parts.map { it.toIntOrNull() ?: return false }
    if (nums.any { it !in 0..255 }) return false
    val a = nums[0]
    val b = nums[1]
    return a == 10 || a == 127 || (a == 192 && b == 168) || (a == 172 && b in 16..31) || (a == 169 && b == 254)
}

private fun accept(url: String?, token: String?): RelaySetup? {
    if (url.isNullOrBlank() || token.isNullOrBlank() || token.length < 16) return null
    val trimmed = url.trim().trimEnd('/')
    if (!isAllowedRelay(trimmed)) return null
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
