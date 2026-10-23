package com.rouge.hermes.protocol

/**
 * Splits streamed reply text into pieces the watch can speak.
 * A sentence ends at . ! or ? once the next character is whitespace.
 * A long stretch with no punctuation is spoken at the last space so the first
 * words are not held until the turn ends.
 */
class SentenceBuffer {
    private val pending = StringBuilder()

    fun push(delta: String): List<String> {
        if (delta.isEmpty()) return emptyList()
        pending.append(delta)
        val out = mutableListOf<String>()
        while (true) {
            val end = sentenceEnd(pending)
            if (end >= 0) {
                emit(out, end + 1)
                continue
            }
            if (pending.length >= 80) {
                val space = pending.lastIndexOf(' ')
                if (space > 20) {
                    emit(out, space + 1)
                    continue
                }
            }
            break
        }
        return out
    }

    fun flush(): String {
        val rest = pending.toString().trim()
        pending.clear()
        return rest
    }

    fun clear() {
        pending.clear()
    }

    private fun emit(out: MutableList<String>, length: Int) {
        val piece = pending.substring(0, length).trim()
        pending.delete(0, length)
        if (piece.isNotEmpty()) out.add(piece)
    }
}

fun sentenceEnd(text: CharSequence): Int {
    for (i in text.indices) {
        val c = text[i]
        if (c != '.' && c != '!' && c != '?') continue
        if (c == '.' && i > 0 && text[i - 1].isDigit()) continue
        val next = if (i + 1 < text.length) text[i + 1] else return -1
        if (next == ' ' || next == '\n') return i
    }
    return -1
}
