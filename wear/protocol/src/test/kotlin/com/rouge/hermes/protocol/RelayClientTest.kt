package com.rouge.hermes.protocol

import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RelayClientTest {
    @Test
    fun emitsSmallSseDeltasBeforeTheResponseEnds() {
        val server = MockWebServer()
        val first = "event: response.output_text.delta\ndata: {\"delta\":\"Hello. \"}\n\n"
        val completed = "event: response.completed\ndata: {}\n\n"
        server.enqueue(
            MockResponse()
                .setHeader("Content-Type", "text/event-stream")
                .setBody(first + completed)
                .throttleBody(first.toByteArray().size.toLong(), 2, java.util.concurrent.TimeUnit.SECONDS),
        )
        server.start()
        val relay = HermesRelay()
        val heard = java.util.concurrent.CountDownLatch(1)
        val worker = kotlin.concurrent.thread {
            runCatching {
                relay.stream(server.url("/").toString(), "secret", "hello", "talk", "2026-10-21") {
                    if (it is Speech.Words) heard.countDown()
                }
            }
        }
        try {
            assertTrue("First delta must arrive before the delayed completion", heard.await(1, java.util.concurrent.TimeUnit.SECONDS))
        } finally {
            relay.cancel()
            worker.join(5000)
            server.shutdown()
        }
    }

    @Test
    fun postsTheRelayBodyAndReadsSpeech() {
        val server = MockWebServer()
        server.enqueue(
            MockResponse()
                .setHeader("Content-Type", "text/event-stream")
                .setBody(
                    """
                    event: response.output_item.done
                    data: {"item":{"phase":"commentary","content":[{"text":"Checking Codex now."}]}}

                    event: response.output_text.delta
                    data: {"delta":"It wants approval"}

                    event: response.completed
                    data: {}

                    """.trimIndent(),
                ),
        )
        server.start()
        try {
            val heard = mutableListOf<Speech>()
            val relay = HermesRelay()
            relay.stream(server.url("/").toString().trimEnd('/'), "secret", "status", "talk", "2026-10-21") {
                heard.add(it)
            }
            val recorded = server.takeRequest()
            assertEquals("/relay/v1/responses", recorded.path)
            assertEquals("Bearer secret", recorded.getHeader("Authorization"))
            assertEquals("text/event-stream", recorded.getHeader("Accept"))
            val body = Json.parse(recorded.body.readUtf8()) as Json.Obj
            assertEquals("status", body.str("input"))
            assertEquals("talk", body.str("mode"))
            assertEquals("2026-10-21", body.str("day"))
            assertEquals("hermes", body.str("agent"))
            assertEquals(
                listOf(
                    Speech.Words("Checking Codex now. "),
                    Speech.Words("It wants approval"),
                    Speech.Done,
                ),
                heard,
            )
        } finally {
            server.shutdown()
        }
    }

    @Test
    fun foodLineIsNotSpokenAndTheListParses() {
        val server = MockWebServer()
        server.enqueue(
            MockResponse().setBody(
                """
                event: response.output_text.delta
                data: {"delta":"Logged oatmeal.\nFOOD: {\"items\":[{\"name\":\"oatmeal\",\"portion\":\"a bowl\"}],\"time\":\"08:10\"}"}

                event: response.completed
                data: {}

                """.trimIndent(),
            ),
        )
        server.enqueue(
            MockResponse().setBody(
                """{"day":"2026-10-21","entries":[{"time":"08:10","note":"oatmeal","items":[{"name":"oatmeal","portion":"a bowl"}]}]}""",
            ),
        )
        server.start()
        try {
            val relay = HermesRelay()
            val base = server.url("/").toString().trimEnd('/')
            val heard = mutableListOf<Speech>()
            relay.stream(base, "secret", "oatmeal", "food", "2026-10-21") { heard.add(it) }
            val words = heard.filterIsInstance<Speech.Words>().joinToString("") { it.text }
            assertEquals("Logged oatmeal.\n", words)
            assertTrue(heard.last() is Speech.Done)
            assertEquals("/relay/v1/responses", server.takeRequest().path)
            val entries = relay.food(base, "secret", "2026-10-21")
            assertEquals(listOf(FoodEntry("08:10", "oatmeal", listOf("oatmeal (a bowl)"))), entries)
            assertEquals("/relay/v1/food?day=2026-10-21", server.takeRequest().path)
        } finally {
            server.shutdown()
        }
    }
}
