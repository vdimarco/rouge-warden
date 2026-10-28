package com.rouge.hermes.protocol

data class SseEvent(val event: String, val data: String)

/** Same framing as readSse in voice/watch-call.mjs. A blank line ends one event. */
class SseParser {
    private var buf = ""
    private var event = ""
    private val data = mutableListOf<String>()

    fun push(chunk: String): List<SseEvent> {
        buf += chunk
        val out = mutableListOf<SseEvent>()
        while (true) {
            val nl = buf.indexOf('\n')
            if (nl < 0) break
            val line = buf.substring(0, nl).trimEnd('\r')
            buf = buf.substring(nl + 1)
            if (line.isEmpty()) {
                if (data.isNotEmpty()) {
                    out.add(SseEvent(event.ifEmpty { "message" }, data.joinToString("\n")))
                }
                event = ""
                data.clear()
            } else if (line.startsWith("event:")) {
                event = line.substring(6).trim()
            } else if (line.startsWith("data:")) {
                data.add(line.substring(5).removePrefix(" "))
            }
        }
        return out
    }

    fun finish(): List<SseEvent> = if (buf.isEmpty() && data.isEmpty()) emptyList() else push("\n")
}

sealed class Speech {
    data class Words(val text: String) : Speech()
    data object Done : Speech()
    data class Failed(val message: String) : Speech()
}

/** The words hermesSpeech would yield for one server-sent event. */
fun speechOf(event: SseEvent): Speech? {
    val obj = try {
        Json.parse(event.data) as? Json.Obj
    } catch (_: Exception) {
        null
    } ?: return null
    return when (event.event) {
        "response.output_text.delta" -> {
            val delta = obj.str("delta")
            if (delta.isNullOrEmpty()) null else Speech.Words(delta)
        }
        "response.output_item.done" -> {
            val item = obj.obj("item") ?: return null
            if (item.str("phase") != "commentary") return null
            val note = item.arr("content")?.list.orEmpty()
                .mapNotNull { (it as? Json.Obj)?.str("text") }
                .joinToString("")
                .trim()
            if (note.isEmpty()) null else Speech.Words("$note ")
        }
        "response.failed" -> Speech.Failed("Hermes failed the turn")
        "response.completed" -> Speech.Done
        else -> null
    }
}
