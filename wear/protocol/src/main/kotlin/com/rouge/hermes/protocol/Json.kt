package com.rouge.hermes.protocol

sealed class Json {
    data class Obj(val map: Map<String, Json>) : Json() {
        fun str(key: String): String? = (map[key] as? Str)?.value
        fun obj(key: String): Obj? = map[key] as? Obj
        fun arr(key: String): Arr? = map[key] as? Arr
    }

    data class Arr(val list: List<Json>) : Json()
    data class Str(val value: String) : Json()
    data class Num(val raw: String) : Json()
    data class Bool(val value: Boolean) : Json()
    data object Null : Json()

    companion object {
        fun parse(text: String): Json = Parser(text).parse()
    }
}

fun jsonString(value: String): String = buildString {
    append('"')
    for (ch in value) {
        when (ch) {
            '"' -> append("\\\"")
            '\\' -> append("\\\\")
            '\n' -> append("\\n")
            '\r' -> append("\\r")
            '\t' -> append("\\t")
            else -> if (ch.code < 0x20) append("\\u%04x".format(ch.code)) else append(ch)
        }
    }
    append('"')
}

private class Parser(private val text: String) {
    private var i = 0

    fun parse(): Json {
        val value = value()
        skip()
        if (i != text.length) error("trailing json")
        return value
    }

    private fun value(): Json {
        skip()
        if (i >= text.length) error("unexpected end")
        return when (text[i]) {
            '{' -> obj()
            '[' -> arr()
            '"' -> Json.Str(str())
            't' -> literal("true", Json.Bool(true))
            'f' -> literal("false", Json.Bool(false))
            'n' -> literal("null", Json.Null)
            else -> num()
        }
    }

    private fun obj(): Json.Obj {
        expect('{')
        val map = linkedMapOf<String, Json>()
        skip()
        if (peek('}')) {
            i++
            return Json.Obj(map)
        }
        while (true) {
            skip()
            val key = str()
            skip()
            expect(':')
            map[key] = value()
            skip()
            if (peek('}')) {
                i++
                break
            }
            expect(',')
        }
        return Json.Obj(map)
    }

    private fun arr(): Json.Arr {
        expect('[')
        val list = mutableListOf<Json>()
        skip()
        if (peek(']')) {
            i++
            return Json.Arr(list)
        }
        while (true) {
            list.add(value())
            skip()
            if (peek(']')) {
                i++
                break
            }
            expect(',')
        }
        return Json.Arr(list)
    }

    private fun str(): String {
        expect('"')
        val out = StringBuilder()
        while (i < text.length) {
            val ch = text[i++]
            when (ch) {
                '"' -> return out.toString()
                '\\' -> {
                    if (i >= text.length) error("bad escape")
                    when (val esc = text[i++]) {
                        '"', '\\', '/' -> out.append(esc)
                        'b' -> out.append('\b')
                        'f' -> out.append('\u000c')
                        'n' -> out.append('\n')
                        'r' -> out.append('\r')
                        't' -> out.append('\t')
                        'u' -> {
                            if (i + 4 > text.length) error("bad unicode")
                            val hex = text.substring(i, i + 4)
                            out.append(hex.toInt(16).toChar())
                            i += 4
                        }
                        else -> error("bad escape")
                    }
                }
                else -> out.append(ch)
            }
        }
        error("unterminated string")
    }

    private fun num(): Json.Num {
        val start = i
        if (text[i] == '-') i++
        if (i >= text.length || !text[i].isDigit()) error("bad number")
        while (i < text.length && text[i].isDigit()) i++
        if (i < text.length && text[i] == '.') {
            i++
            while (i < text.length && text[i].isDigit()) i++
        }
        if (i < text.length && (text[i] == 'e' || text[i] == 'E')) {
            i++
            if (i < text.length && (text[i] == '+' || text[i] == '-')) i++
            while (i < text.length && text[i].isDigit()) i++
        }
        return Json.Num(text.substring(start, i))
    }

    private fun literal(word: String, value: Json): Json {
        if (!text.startsWith(word, i)) error("bad literal")
        i += word.length
        return value
    }

    private fun skip() {
        while (i < text.length && text[i].isWhitespace()) i++
    }

    private fun peek(ch: Char): Boolean = i < text.length && text[i] == ch

    private fun expect(ch: Char) {
        skip()
        if (!peek(ch)) error("expected $ch")
        i++
    }
}
