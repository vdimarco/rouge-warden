package com.rouge.hermes.protocol

import java.io.ByteArrayOutputStream

interface Transcriber {
    fun ready(): Boolean
    fun transcribe(pcm: ByteArray): String
    fun push(pcm: ByteArray): String = ""

    /** Final text from a streaming recognizer. Null means use [transcribe] on the buffer. */
    fun finish(): String? = null
}

interface RelayApi {
    fun stream(input: String, mode: String, day: String, on: (Speech) -> Unit)
    fun stream(input: String, mode: String, day: String, agent: String, on: (Speech) -> Unit) {
        stream(input, mode, day, on)
    }
    fun food(day: String): List<FoodEntry>
    fun cancel()
}

/**
 * Phone-side session. Call onMessage, onPcm, and onAudioClosed from one thread.
 * [cancelFromAnyThread] is safe from the listener thread so a barge can abort OkHttp.
 */
class PhoneEngine(
    private val stt: Transcriber,
    private val relay: RelayApi,
    private val send: (nodeId: String, WireMsg) -> Unit,
    private val day: () -> String,
    private val clock: () -> Long = { System.currentTimeMillis() },
    private val log: (String) -> Unit = {},
) {
    private val lock = Any()
    private var nodeId: String? = null
    private var session: String? = null
    private var mode: String = "talk"
    private var agent: String = Agents.HERMES
    private val pcm = ByteArrayOutputStream()
    private var started = false
    private var audioDone = false
    private var recognizer = false
    private var generation = 0
    private var lastPartial = ""
    private var releasedAt = 0L

    fun onMessage(node: String, msg: WireMsg) {
        when (msg) {
            is WireMsg.PttStart -> {
                synchronized(lock) {
                    generation += 1
                    nodeId = node
                    session = msg.session
                    mode = if (msg.mode == "food") "food" else "talk"
                    agent = msg.agent.ifBlank { Agents.HERMES }
                    pcm.reset()
                    lastPartial = ""
                    started = true
                    audioDone = false
                    recognizer = !stt.ready()
                }
                relay.cancel()
                send(node, WireMsg.Ack(msg.session))
                if (!stt.ready()) send(node, WireMsg.NeedRecognizer(msg.session))
            }
            is WireMsg.PttStop -> {
                val job = synchronized(lock) {
                    if (msg.session != session) return
                    audioDone = true
                    releasedAt = clock()
                    takeFinish()
                }
                if (job != null) run(job)
            }
            is WireMsg.Barge -> cancelFromAnyThread()
            is WireMsg.Transcript -> {
                val useMode = if (msg.mode == "food") "food" else "talk"
                val useAgent = msg.agent.ifBlank { Agents.HERMES }
                synchronized(lock) {
                    nodeId = node
                    session = msg.session
                    mode = useMode
                    agent = useAgent
                    started = false
                    recognizer = false
                    releasedAt = clock()
                }
                if (msg.text.isBlank()) send(node, WireMsg.Failed(msg.session, "Didn't catch that"))
                else stream(node, msg.session, msg.text, useMode, useAgent)
            }
            is WireMsg.FoodSync -> {
                val entries = try {
                    relay.food(msg.day)
                } catch (error: Exception) {
                    send(node, WireMsg.Failed(session ?: "", error.message ?: "Couldn't read the food log"))
                    return
                }
                send(node, WireMsg.FoodList(entries))
            }
            else -> Unit
        }
    }

    fun onPcm(bytes: ByteArray) {
        val partial = synchronized(lock) {
            if (!started || audioDone || recognizer) return
            pcm.write(bytes)
            val node = nodeId ?: return
            val id = session ?: return
            val text = stt.push(bytes)
            if (text.isBlank() || text == lastPartial) null
            else {
                lastPartial = text
                node to WireMsg.Partial(id, text)
            }
        }
        if (partial != null) send(partial.first, partial.second)
    }

    fun onAudioClosed() {
        val job = synchronized(lock) {
            audioDone = true
            if (releasedAt == 0L) releasedAt = clock()
            takeFinish()
        } ?: return
        run(job)
    }

    fun cancelFromAnyThread() {
        synchronized(lock) {
            generation += 1
            started = false
            pcm.reset()
        }
        relay.cancel()
    }

    private data class Finish(
        val node: String,
        val session: String,
        val mode: String,
        val agent: String,
        val pcm: ByteArray,
        val gen: Int,
        val releasedAt: Long,
    )

    private fun takeFinish(): Finish? {
        if (!started || recognizer || !audioDone) return null
        val node = nodeId ?: return null
        val id = session ?: return null
        val audio = pcm.toByteArray()
        pcm.reset()
        started = false
        return Finish(node, id, mode, agent, audio, generation, releasedAt)
    }

    private fun run(job: Finish) {
        val text = try {
            val streamed = stt.finish()
            val heard = streamed ?: stt.transcribe(job.pcm)
            val sttMs = clock() - job.releasedAt
            log("phone: stt ${sttMs}ms")
            heard
        } catch (error: Exception) {
            if (current(job.gen)) send(job.node, WireMsg.Failed(job.session, error.message ?: "Speech failed"))
            return
        }
        if (!current(job.gen)) return
        if (text.isBlank()) {
            send(job.node, WireMsg.Failed(job.session, "Didn't catch that"))
            return
        }
        stream(job.node, job.session, text, job.mode, job.agent, job.gen, job.releasedAt)
    }

    private fun stream(
        node: String,
        session: String,
        text: String,
        mode: String,
        agent: String = synchronized(lock) { this.agent },
        gen: Int = synchronized(lock) { generation },
        releasedAt: Long = synchronized(lock) { this.releasedAt },
    ) {
        var noted = false
        try {
            relay.stream(text, mode, day(), agent) { speech ->
                if (!current(gen)) return@stream
                if (!noted && speech is Speech.Words && speech.text.isNotEmpty()) {
                    noted = true
                    log("phone: first-token ${clock() - releasedAt}ms")
                }
                when (speech) {
                    is Speech.Words -> if (speech.text.isNotEmpty()) send(node, WireMsg.Delta(session, speech.text))
                    Speech.Done -> {
                        send(node, WireMsg.Done(session))
                        if (mode == "food") {
                            val entries = try {
                                relay.food(day())
                            } catch (_: Exception) {
                                emptyList()
                            }
                            send(node, WireMsg.FoodList(entries))
                        }
                    }
                    is Speech.Failed -> send(node, WireMsg.Failed(session, speech.message))
                }
            }
        } catch (error: Exception) {
            if (current(gen)) send(node, WireMsg.Failed(session, error.message ?: "relay failed"))
        }
    }

    private fun current(gen: Int): Boolean = synchronized(lock) { generation == gen }
}
