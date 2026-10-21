package com.rouge.hermes.protocol

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class HermesRelay(
    private val preferSocket: Boolean = false,
) : RelayApi {
    private val client: OkHttpClient = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .callTimeout(0, TimeUnit.MILLISECONDS)
        .pingInterval(20, TimeUnit.SECONDS)
        .build()
    private val json = "application/json; charset=utf-8".toMediaType()
    private val lock = Any()
    private var call: okhttp3.Call? = null
    private var socket: okhttp3.WebSocket? = null
    private var baseUrl: String = ""
    private var token: String = ""
    private var turnId: String? = null
    private var turnOn: ((Speech) -> Unit)? = null
    private var turnLatch: java.util.concurrent.CountDownLatch? = null
    private var turnAssembler: SpokenAssembler? = null

    fun configure(url: String, bearer: String) {
        baseUrl = url
        token = bearer
    }

    fun warm() {
        if (preferSocket && baseUrl.isNotBlank() && token.isNotBlank()) {
            ensureSocket()
        }
    }

    override fun stream(input: String, mode: String, day: String, on: (Speech) -> Unit) {
        stream(input, mode, day, Agents.HERMES, on)
    }

    override fun stream(input: String, mode: String, day: String, agent: String, on: (Speech) -> Unit) {
        if (preferSocket && streamSocket(input, mode, day, agent, on)) return
        val request = Request.Builder()
            .url(relayEndpoint(baseUrl, "/relay/v1/responses"))
            .header("Authorization", "Bearer $token")
            .header("Accept", "text/event-stream")
            .post(relayBody(input, mode, day, agent).toRequestBody(json))
            .build()
        execute(request, on)
    }

    /** One shot used by the watch fallback, which does not keep a configured relay. */
    fun stream(url: String, bearer: String, input: String, mode: String, day: String, agent: String, on: (Speech) -> Unit) {
        configure(url, bearer)
        stream(input, mode, day, agent, on)
    }

    fun stream(url: String, bearer: String, input: String, mode: String, day: String, on: (Speech) -> Unit) {
        stream(url, bearer, input, mode, day, Agents.HERMES, on)
    }

    override fun food(day: String): List<FoodEntry> {
        val request = Request.Builder()
            .url(relayEndpoint(baseUrl, "/relay/v1/food?day=$day"))
            .header("Authorization", "Bearer $token")
            .get()
            .build()
        client.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) error("Relay answered ${response.code}")
            return parseFoodList(text)
        }
    }

    fun food(url: String, bearer: String, day: String): List<FoodEntry> {
        configure(url, bearer)
        return food(day)
    }

    override fun cancel() {
        val id = synchronized(lock) { turnId }
        synchronized(lock) { call?.cancel() }
        if (id != null) {
            socket?.send("{\"type\":\"barge\",\"id\":${jsonString(id)}}")
        }
        synchronized(lock) { turnLatch?.countDown() }
    }

    private fun execute(request: Request, on: (Speech) -> Unit) {
        val next = client.newCall(request)
        synchronized(lock) { call = next }
        next.execute().use { response ->
            if (!response.isSuccessful) {
                on(Speech.Failed("Relay answered ${response.code}"))
                return
            }
            val source = response.body?.source() ?: run {
                on(Speech.Failed("empty relay response"))
                return
            }
            val parser = SseParser()
            val spoken = SpokenAssembler()
            while (!source.exhausted()) {
                if (source.buffer.size == 0L) break
                emit(parser.push(source.readUtf8(source.buffer.size)), spoken, on)
            }
            emit(parser.finish(), spoken, on)
        }
    }

    private fun streamSocket(input: String, mode: String, day: String, agent: String, on: (Speech) -> Unit): Boolean {
        val ws = ensureSocket() ?: return false
        val id = java.util.UUID.randomUUID().toString()
        val latch = java.util.concurrent.CountDownLatch(1)
        synchronized(lock) {
            turnId = id
            turnOn = on
            turnLatch = latch
            turnAssembler = SpokenAssembler()
        }
        val wireMode = if (mode == "food") "food" else "talk"
        val payload = "{\"type\":\"turn\",\"id\":${jsonString(id)},\"input\":${jsonString(input)},\"mode\":${jsonString(wireMode)},\"day\":${jsonString(day)},\"agent\":${jsonString(agent)}}"
        if (!ws.send(payload)) {
            synchronized(lock) {
                if (turnId == id) {
                    turnId = null
                    turnOn = null
                    turnLatch = null
                }
            }
            return false
        }
        if (!latch.await(90, TimeUnit.SECONDS)) on(Speech.Failed("relay timed out"))
        return true
    }

    private fun ensureSocket(): okhttp3.WebSocket? {
        synchronized(lock) { socket?.let { return it } }
        val opened = java.util.concurrent.CountDownLatch(1)
        var created: okhttp3.WebSocket? = null
        var failed = false
        val request = Request.Builder()
            .url(socketUrl())
            .header("Authorization", "Bearer $token")
            .build()
        val attempt = client.newWebSocket(request, object : okhttp3.WebSocketListener() {
            override fun onOpen(webSocket: okhttp3.WebSocket, response: okhttp3.Response) {
                created = webSocket
                opened.countDown()
            }

            override fun onMessage(webSocket: okhttp3.WebSocket, text: String) {
                onSocketMessage(text)
            }

            override fun onFailure(webSocket: okhttp3.WebSocket, t: Throwable, response: okhttp3.Response?) {
                failed = true
                synchronized(lock) { if (socket == webSocket) socket = null }
                turnLatch?.countDown()
                opened.countDown()
            }

            override fun onClosed(webSocket: okhttp3.WebSocket, code: Int, reason: String) {
                synchronized(lock) { if (socket == webSocket) socket = null }
                turnLatch?.countDown()
            }
        })
        if (!opened.await(5, TimeUnit.SECONDS) || failed || created == null) {
            attempt.cancel()
            return null
        }
        synchronized(lock) { socket = created }
        return created
    }

    private fun onSocketMessage(text: String) {
        val obj = try {
            Json.parse(text) as? Json.Obj
        } catch (_: Exception) {
            null
        } ?: return
        val id = obj.str("id")
        val on: ((Speech) -> Unit)?
        val assembler: SpokenAssembler?
        val latch: java.util.concurrent.CountDownLatch?
        synchronized(lock) {
            if (id == null || id != turnId) return
            on = turnOn
            assembler = turnAssembler
            latch = turnLatch
        }
        if (on == null || assembler == null || latch == null) return
        when (obj.str("type")) {
            "delta" -> {
                val say = assembler.push(obj.str("text").orEmpty())
                if (say.isNotEmpty()) on(Speech.Words(say))
            }
            "done" -> {
                val rest = assembler.finish()
                if (rest.isNotEmpty()) on(Speech.Words(rest))
                on(Speech.Done)
                latch.countDown()
            }
            "failed" -> {
                on(Speech.Failed(obj.str("message") ?: "relay failed"))
                latch.countDown()
            }
        }
    }

    private fun socketUrl(): String {
        val base = baseUrl.trim().trimEnd('/')
        val ws = when {
            base.startsWith("https://") -> "wss://" + base.removePrefix("https://")
            base.startsWith("http://") -> "ws://" + base.removePrefix("http://")
            else -> base
        }
        return "$ws/relay/v1/stream"
    }
}

fun parseFoodList(json: String): List<FoodEntry> {
    val root = Json.parse(json) as? Json.Obj ?: return emptyList()
    val rows = root.arr("entries")?.list ?: return emptyList()
    return rows.mapNotNull { el ->
        val obj = el as? Json.Obj ?: return@mapNotNull null
        val items = obj.arr("items")?.list?.mapNotNull { item ->
            when (item) {
                is Json.Str -> item.value
                is Json.Obj -> {
                    val name = item.str("name") ?: return@mapNotNull null
                    val portion = item.str("portion").orEmpty()
                    if (portion.isBlank()) name else "$name ($portion)"
                }
                else -> null
            }
        }.orEmpty()
        FoodEntry(obj.str("time").orEmpty(), obj.str("note").orEmpty(), items)
    }
}

private fun emit(events: List<SseEvent>, spoken: SpokenAssembler, on: (Speech) -> Unit) {
    for (event in events) {
        when (val speech = speechOf(event)) {
            is Speech.Words -> {
                val say = spoken.push(speech.text)
                if (say.isNotEmpty()) on(Speech.Words(say))
            }
            Speech.Done -> {
                val rest = spoken.finish()
                if (rest.isNotEmpty()) on(Speech.Words(rest))
                on(Speech.Done)
            }
            is Speech.Failed -> on(speech)
            null -> Unit
        }
    }
}
