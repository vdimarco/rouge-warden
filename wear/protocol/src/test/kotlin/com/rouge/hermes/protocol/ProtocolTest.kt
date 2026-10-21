package com.rouge.hermes.protocol

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ProtocolTest {
    @Test
    fun sseMatchesTheNodeReader() {
        val text = "event: a\r\ndata: {\"n\":1}\r\n\r\n: keepalive\n\nevent: b\ndata: {\"n\":\n\ndata: plain\n\n"
        val parser = SseParser()
        val seen = mutableListOf<SseEvent>()
        for (ch in text) seen += parser.push(ch.toString())
        assertEquals(
            listOf(
                SseEvent("a", "{\"n\":1}"),
                SseEvent("b", "{\"n\":"),
                SseEvent("message", "plain"),
            ),
            seen,
        )
    }

    @Test
    fun speechFollowsHermesEvents() {
        val commentary = """{"item":{"phase":"commentary","content":[{"text":"Checking Codex now."}]}}"""
        val first = """{"delta":"It wants approval "}"""
        val second = """{"delta":"to run the migration."}"""
        assertEquals(Speech.Words("Checking Codex now. "), speechOf(SseEvent("response.output_item.done", commentary)))
        assertEquals(Speech.Words("It wants approval "), speechOf(SseEvent("response.output_text.delta", first)))
        assertEquals(Speech.Words("to run the migration."), speechOf(SseEvent("response.output_text.delta", second)))
        assertEquals(Speech.Done, speechOf(SseEvent("response.completed", "{}")))
        assertEquals(Speech.Failed("Hermes failed the turn"), speechOf(SseEvent("response.failed", "{}")))
        assertNull(speechOf(SseEvent("response.output_text.delta", "{\"delta\":\"\"}")))
        assertNull(speechOf(SseEvent("response.created", "{\"response\":{\"id\":\"resp_1\"}}")))
    }

    @Test
    fun requestBodiesMatchHermesSpeech() {
        val body = Json.parse(hermesBody("What does it need", "talk")) as Json.Obj
        assertEquals("What does it need", body.str("input"))
        assertEquals(Bodies.VOICE_INSTRUCTIONS, body.str("instructions"))
        assertEquals("watch-call", body.str("conversation"))
        assertEquals("true", (body.map["stream"] as Json.Bool).value.toString())
        assertEquals("true", (body.map["store"] as Json.Bool).value.toString())
        val food = Json.parse(hermesBody("oatmeal", "food")) as Json.Obj
        assertEquals(Bodies.FOOD_INSTRUCTIONS, food.str("instructions"))
        assertEquals("watch-call", food.str("conversation"))
        val relay = Json.parse(relayBody("oatmeal and a coffee", "food", "2026-10-21")) as Json.Obj
        assertEquals("oatmeal and a coffee", relay.str("input"))
        assertEquals("food", relay.str("mode"))
        assertEquals("2026-10-21", relay.str("day"))
        assertEquals("talk", (Json.parse(relayBody("hi", "other", "2026-10-21")) as Json.Obj).str("mode"))
    }

    @Test
    fun jsonEscapesQuotes() {
        val parsed = Json.parse(hermesBody("say \"hi\"\nnow", "talk")) as Json.Obj
        assertEquals("say \"hi\"\nnow", parsed.str("input"))
    }

    @Test
    fun spokenAssemblerHidesTheFoodLine() {
        val assembler = SpokenAssembler()
        assertEquals("Logged oatmeal and coffee.\n", assembler.push("Logged oatmeal and coffee.\nFOO"))
        assertEquals("", assembler.push("D: {\"items\":[]}"))
        assertEquals("", assembler.finish())
        val whole = SpokenAssembler()
        assertEquals(
            "Logged oatmeal and coffee.\n",
            whole.push("Logged oatmeal and coffee.\nFOOD: {\"items\":[],\"time\":\"08:10\"}"),
        )
        val talk = SpokenAssembler()
        assertEquals("Hello there", talk.push("Hello there"))
    }

    @Test
    fun setupParsesQrAndLines() {
        val qr = parseRelaySetup("hermes://relay?url=https%3A%2F%2Fwatch.example.ts.net&token=relay-token-0123456789")
        assertEquals(RelaySetup("https://watch.example.ts.net", "relay-token-0123456789"), qr)
        val lines = parseRelaySetup("url=https://watch.example.ts.net/\ntoken=relay-token-0123456789")
        assertEquals("https://watch.example.ts.net", lines?.url)
        assertNull(parseRelaySetup("http://example.com\ntoken=relay-token-0123456789"))
        assertNull(parseRelaySetup("url=https://watch.example.ts.net\ntoken=short"))
        val tap = parseRelaySetup("wristagent://pair?u=https%3A%2F%2Fwatch.example.ts.net&k=relay-token-0123456789")
        assertEquals(RelaySetup("https://watch.example.ts.net", "relay-token-0123456789"), tap)
        val page = parseRelaySetup("https://watch.example.ts.net/pair?u=https%3A%2F%2Fwatch.example.ts.net&k=relay-token-0123456789")
        assertEquals("https://watch.example.ts.net", page?.url)
        val lan = parseRelaySetup("wristagent://pair?u=http%3A%2F%2F192.168.1.20%3A8650&k=relay-token-0123456789")
        assertEquals("http://192.168.1.20:8650", lan?.url)
        assertNull(parseRelaySetup("wristagent://pair?u=http%3A%2F%2F1.2.3.4%3A8650&k=relay-token-0123456789"))
        assertEquals("http://10.1.2.3:8650/relay/v1/food", relayEndpoint("http://10.1.2.3:8650", "/relay/v1/food"))
        assertEquals(
            "http://127.0.0.1:8650/relay/v1/responses",
            relayEndpoint("http://127.0.0.1:8650/", "/relay/v1/responses"),
        )
        assertEquals("2026-10-21", localDay(java.time.Instant.parse("2026-10-21T15:04:00.000Z").toEpochMilli()))
    }

    @Test
    fun wireRoundTrip() {
        val messages = listOf(
            WireMsg.PttStart("s1", "food"),
            WireMsg.PttStop("s1"),
            WireMsg.Barge("s1"),
            WireMsg.Ack("s1"),
            WireMsg.Partial("s1", "oat"),
            WireMsg.Delta("s1", "Hello"),
            WireMsg.Done("s1"),
            WireMsg.Failed("s1", "nope"),
            WireMsg.Transcript("s1", "oatmeal", "food"),
            WireMsg.NeedRecognizer("s1"),
            WireMsg.FoodSync("2026-10-21"),
            WireMsg.FoodList(listOf(FoodEntry("08:10", "oatmeal and a coffee", listOf("oatmeal (a bowl)")))),
        )
        for (msg in messages) {
            assertEquals(msg, WireMsg.parse(msg.encode()))
        }
        assertTrue(WireMsg.FoodList(listOf(FoodEntry("08:10", "note", listOf("oatmeal (a bowl)")))).encode().length < 1000)
        assertEquals("08:10 oatmeal (a bowl)", FoodEntry("08:10", "note", listOf("oatmeal (a bowl)")).label())
    }

    @Test
    fun sentencesAreSpokenAsTheyFinish() {
        val buffer = SentenceBuffer()
        assertEquals(emptyList<String>(), buffer.push("Hello "))
        assertEquals(listOf("Hello there."), buffer.push("there. Next"))
        assertEquals(emptyList<String>(), buffer.push(" line."))
        assertEquals("Next line.", buffer.flush())
        val held = SentenceBuffer()
        held.push("Still talking")
        assertEquals("Still talking", held.flush())
        assertEquals(Agents.PI, Agents.next(Agents.HERMES))
        assertEquals(Agents.HERMES, Agents.next(Agents.OPENAI))
    }
}
