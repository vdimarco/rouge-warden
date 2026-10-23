package com.rouge.hermes.protocol

object Agents {
    const val HERMES = "hermes"
    const val PI = "pi"
    const val OPENAI = "openai"
    val ALL = listOf(HERMES, PI, OPENAI)

    fun next(id: String): String {
        val index = ALL.indexOf(id)
        return ALL[if (index < 0) 0 else (index + 1) % ALL.size]
    }

    fun label(id: String): String = when (id) {
        PI -> "Pi"
        OPENAI -> "OpenAI"
        else -> "Hermes"
    }
}
