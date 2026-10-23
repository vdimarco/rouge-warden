package com.rouge.hermes.protocol

data class FoodEntry(val time: String, val note: String, val items: List<String>) {
    fun label(): String {
        val body = if (items.isEmpty()) note else items.joinToString(", ")
        return listOf(time, body).filter { it.isNotBlank() }.joinToString(" ")
    }
}

sealed class WireMsg {
    data class PttStart(val session: String, val mode: String, val agent: String = Agents.HERMES) : WireMsg()
    data class PttStop(val session: String) : WireMsg()
    data class Barge(val session: String) : WireMsg()
    data class Ack(val session: String) : WireMsg()
    data class Partial(val session: String, val text: String) : WireMsg()
    data class Delta(val session: String, val text: String) : WireMsg()
    data class Done(val session: String) : WireMsg()
    data class Failed(val session: String, val message: String) : WireMsg()
    data class Transcript(val session: String, val text: String, val mode: String, val agent: String = Agents.HERMES) : WireMsg()
    data class NeedRecognizer(val session: String) : WireMsg()
    data class FoodSync(val day: String) : WireMsg()
    data class FoodList(val entries: List<FoodEntry>) : WireMsg()

    fun encode(): String = when (this) {
        is WireMsg.PttStart -> obj("ptt-start", "session" to session, "mode" to mode, "agent" to agent)
        is WireMsg.PttStop -> obj("ptt-stop", "session" to session)
        is WireMsg.Barge -> obj("barge", "session" to session)
        is WireMsg.Ack -> obj("ack", "session" to session)
        is WireMsg.Partial -> obj("partial", "session" to session, "text" to text)
        is WireMsg.Delta -> obj("delta", "session" to session, "text" to text)
        is WireMsg.Done -> obj("done", "session" to session)
        is WireMsg.Failed -> obj("failed", "session" to session, "message" to message)
        is WireMsg.Transcript -> obj("transcript", "session" to session, "text" to text, "mode" to mode, "agent" to agent)
        is WireMsg.NeedRecognizer -> obj("need-recognizer", "session" to session)
        is WireMsg.FoodSync -> obj("food-sync", "day" to day)
        is WireMsg.FoodList -> foodJson(entries)
    }

    companion object {
        fun parse(text: String): WireMsg? {
            val obj = try {
                Json.parse(text) as? Json.Obj
            } catch (_: Exception) {
                null
            } ?: return null
            val type = obj.str("type") ?: return null
            val session = obj.str("session").orEmpty()
            return when (type) {
                "ptt-start" -> WireMsg.PttStart(session, obj.str("mode") ?: "talk", obj.str("agent") ?: Agents.HERMES)
                "ptt-stop" -> WireMsg.PttStop(session)
                "barge" -> WireMsg.Barge(session)
                "ack" -> WireMsg.Ack(session)
                "partial" -> WireMsg.Partial(session, obj.str("text").orEmpty())
                "delta" -> WireMsg.Delta(session, obj.str("text").orEmpty())
                "done" -> WireMsg.Done(session)
                "failed" -> WireMsg.Failed(session, obj.str("message").orEmpty())
                "transcript" -> WireMsg.Transcript(
                    session,
                    obj.str("text").orEmpty(),
                    obj.str("mode") ?: "talk",
                    obj.str("agent") ?: Agents.HERMES,
                )
                "need-recognizer" -> WireMsg.NeedRecognizer(session)
                "food-sync" -> WireMsg.FoodSync(obj.str("day").orEmpty())
                "food" -> WireMsg.FoodList(readEntries(obj))
                else -> null
            }
        }
    }
}

object Paths {
    const val WATCH = "/hermes/watch"
    const val PHONE = "/hermes/phone"
    const val AUDIO = "/hermes/audio"
    const val CONFIG = "/hermes/config"
}

private fun obj(type: String, vararg fields: Pair<String, String>): String = buildString {
    append("{\"type\":")
    append(jsonString(type))
    for ((key, value) in fields) {
        append(",")
        append(jsonString(key))
        append(":")
        append(jsonString(value))
    }
    append("}")
}

private fun foodJson(entries: List<FoodEntry>): String = buildString {
    append("{\"type\":\"food\",\"entries\":[")
    entries.forEachIndexed { index, entry ->
        if (index > 0) append(",")
        append("{\"time\":")
        append(jsonString(entry.time))
        append(",\"note\":")
        append(jsonString(entry.note))
        append(",\"items\":[")
        entry.items.forEachIndexed { itemIndex, item ->
            if (itemIndex > 0) append(",")
            append(jsonString(item))
        }
        append("]}")
    }
    append("]}")
}

private fun readEntries(obj: Json.Obj): List<FoodEntry> {
    val list = obj.arr("entries")?.list ?: return emptyList()
    return list.mapNotNull { el ->
        val row = el as? Json.Obj ?: return@mapNotNull null
        val items = row.arr("items")?.list?.mapNotNull { (it as? Json.Str)?.value }.orEmpty()
        FoodEntry(row.str("time").orEmpty(), row.str("note").orEmpty(), items)
    }
}
