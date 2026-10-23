package com.rouge.hermes.protocol

/**
 * Kept identical to VOICE_INSTRUCTIONS and FOOD_INSTRUCTIONS in voice/watch-call.mjs.
 * qa/voice/relay.test.mjs reads these constants and fails if they drift.
 */
object Bodies {
    const val CONVERSATION = "watch-call"
    const val VOICE_INSTRUCTIONS = "This turn comes from a phone call. The user hears your answer through the speaker on their watch. Speak in short, plain sentences. Do not use markdown, lists, code, links or emoji. Keep each answer under 40 words unless the user asks for detail. Before a step that takes more than a few seconds, say in one short sentence what you are starting."
    const val FOOD_INSTRUCTIONS = "This turn comes from a phone call. The user hears your answer through the speaker on their watch. Speak in short, plain sentences. Do not use markdown, lists, code, links or emoji. Keep each answer under 40 words unless the user asks for detail. Before a step that takes more than a few seconds, say in one short sentence what you are starting. This turn is a meal note to log as food. Pull out each food, a rough portion, and the time the user means. If the user gives no time, use the current time. Confirm in one short sentence that names the foods. Then add one final line that starts with FOOD: and a JSON object. The object has items and time. items is an array of objects with name and portion. time is HH:MM. Do not put the JSON on the confirmation line."
}

fun hermesBody(input: String, mode: String, conversation: String = Bodies.CONVERSATION): String {
    val instructions = if (mode == "food") Bodies.FOOD_INSTRUCTIONS else Bodies.VOICE_INSTRUCTIONS
    return buildString {
        append("{\"input\":")
        append(jsonString(input))
        append(",\"instructions\":")
        append(jsonString(instructions))
        append(",\"conversation\":")
        append(jsonString(conversation))
        append(",\"stream\":true,\"store\":true}")
    }
}

fun relayBody(input: String, mode: String, day: String, agent: String = Agents.HERMES): String {
    val wireMode = if (mode == "food") "food" else "talk"
    val wireAgent = if (agent == Agents.PI || agent == Agents.OPENAI) agent else Agents.HERMES
    return buildString {
        append("{\"input\":")
        append(jsonString(input))
        append(",\"mode\":")
        append(jsonString(wireMode))
        append(",\"day\":")
        append(jsonString(day))
        append(",\"agent\":")
        append(jsonString(wireAgent))
        append("}")
    }
}

/** Drops a trailing FOOD: line so the watch does not speak the log JSON. */
class SpokenAssembler {
    private val pending = StringBuilder()

    fun push(delta: String): String {
        pending.append(delta)
        return drain(finish = false)
    }

    fun finish(): String = drain(finish = true)

    private fun drain(finish: Boolean): String {
        val speak = StringBuilder()
        while (true) {
            val nl = pending.indexOf("\n")
            if (nl < 0) break
            val line = pending.substring(0, nl)
            pending.delete(0, nl + 1)
            if (!line.trimStart().startsWith("FOOD:")) {
                speak.append(line).append('\n')
            }
        }
        val rest = pending.toString()
        val trimmed = rest.trimStart()
        val holding = !finish && trimmed.isNotEmpty() && ("FOOD:".startsWith(trimmed) || trimmed.startsWith("FOOD:"))
        if (holding) return speak.toString()
        val cut = rest.indexOf("FOOD:")
        if (cut >= 0) {
            speak.append(rest.substring(0, cut))
            pending.clear()
            return speak.toString()
        }
        speak.append(rest)
        pending.clear()
        return speak.toString()
    }
}
