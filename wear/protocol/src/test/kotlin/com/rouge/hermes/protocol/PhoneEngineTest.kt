package com.rouge.hermes.protocol

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class PhoneEngineTest {
    private class FakeStt(var on: Boolean = true, var text: String = "what are my agents doing") : Transcriber {
        val calls = mutableListOf<ByteArray>()
        override fun ready(): Boolean = on
        override fun transcribe(pcm: ByteArray): String {
            calls.add(pcm)
            return text
        }
    }

    private class FakeRelay : RelayApi {
        val inputs = mutableListOf<Pair<String, String>>()
        var food = listOf(FoodEntry("08:10", "oatmeal", listOf("oatmeal (a bowl)")))
        var cancelCount = 0
        var speeches = listOf(Speech.Words("Checking Codex now. "), Speech.Words("It wants approval"), Speech.Done)
        val agents = mutableListOf<String>()
        override fun stream(input: String, mode: String, day: String, on: (Speech) -> Unit) {
            stream(input, mode, day, "hermes", on)
        }
        override fun stream(input: String, mode: String, day: String, agent: String, on: (Speech) -> Unit) {
            inputs.add(input to mode)
            agents.add(agent)
            for (speech in speeches) on(speech)
        }
        override fun food(day: String): List<FoodEntry> = food
        override fun cancel() { cancelCount += 1 }
    }

    @Test
    fun audioIsTranscribedAndTheReplyIsStreamed() {
        val stt = FakeStt()
        val relay = FakeRelay()
        val sent = mutableListOf<WireMsg>()
        val engine = PhoneEngine(stt, relay, { _, msg -> sent.add(msg) }, { "2026-10-21" })
        engine.onMessage("watch", WireMsg.PttStart("s", "talk"))
        engine.onPcm(byteArrayOf(1, 2, 3, 4))
        engine.onAudioClosed()
        assertEquals(listOf("what are my agents doing" to "talk"), relay.inputs)
        assertEquals(1, stt.calls.size)
        assertEquals(4, stt.calls[0].size)
        assertEquals(
            listOf(
                WireMsg.Ack("s"),
                WireMsg.Delta("s", "Checking Codex now. "),
                WireMsg.Delta("s", "It wants approval"),
                WireMsg.Done("s"),
            ),
            sent,
        )
    }

    @Test
    fun missingModelAsksTheWatchToRecognize() {
        val stt = FakeStt(on = false)
        val relay = FakeRelay()
        val sent = mutableListOf<WireMsg>()
        val engine = PhoneEngine(stt, relay, { _, msg -> sent.add(msg) }, { "2026-10-21" })
        engine.onMessage("watch", WireMsg.PttStart("s", "talk"))
        engine.onPcm(byteArrayOf(1, 2))
        engine.onAudioClosed()
        assertTrue(relay.inputs.isEmpty())
        assertTrue(stt.calls.isEmpty())
        assertEquals(listOf(WireMsg.Ack("s"), WireMsg.NeedRecognizer("s")), sent)
        engine.onMessage("watch", WireMsg.Transcript("s", "oatmeal and coffee", "food"))
        assertEquals("food", relay.inputs.single().second)
        assertTrue(sent.contains(WireMsg.FoodList(relay.food)))
    }

    @Test
    fun bargeDropsALateDone() {
        val relay = FakeRelay()
        val sent = mutableListOf<WireMsg>()
        lateinit var engine: PhoneEngine
        relay.speeches = listOf(Speech.Words("Hello"))
        val wrapping = object : RelayApi {
            override fun stream(input: String, mode: String, day: String, on: (Speech) -> Unit) {
                on(Speech.Words("Hello"))
                engine.cancelFromAnyThread()
                on(Speech.Done)
            }
            override fun food(day: String) = emptyList<FoodEntry>()
            override fun cancel() { relay.cancelCount += 1 }
        }
        engine = PhoneEngine(FakeStt(), wrapping, { _, msg -> sent.add(msg) }, { "2026-10-21" })
        engine.onMessage("watch", WireMsg.Transcript("s", "status", "talk"))
        assertTrue(sent.contains(WireMsg.Delta("s", "Hello")))
        assertTrue(sent.none { it is WireMsg.Done })
        assertEquals(1, relay.cancelCount)
    }

    @Test
    fun partialsStreamAndTheChosenAgentIsSent() {
        val stt = object : Transcriber {
            override fun ready() = true
            override fun transcribe(pcm: ByteArray) = error("use finish")
            override fun push(pcm: ByteArray) = "oat"
            override fun finish() = "oatmeal"
        }
        val relay = FakeRelay()
        val sent = mutableListOf<WireMsg>()
        val engine = PhoneEngine(stt, relay, { _, msg -> sent.add(msg) }, { "2026-10-21" })
        engine.onMessage("watch", WireMsg.PttStart("s", "talk", "pi"))
        engine.onPcm(byteArrayOf(1, 2))
        engine.onAudioClosed()
        assertTrue(sent.contains(WireMsg.Partial("s", "oat")))
        assertEquals(listOf("oatmeal" to "talk"), relay.inputs)
        assertEquals(listOf("pi"), relay.agents)
    }

    @Test
    fun blankTranscriptFails() {
        val sent = mutableListOf<WireMsg>()
        val engine = PhoneEngine(FakeStt(), FakeRelay(), { _, msg -> sent.add(msg) }, { "2026-10-21" })
        engine.onMessage("watch", WireMsg.Transcript("s", "  ", "talk"))
        assertEquals(WireMsg.Failed("s", "Didn't catch that"), sent.single())
    }
}
