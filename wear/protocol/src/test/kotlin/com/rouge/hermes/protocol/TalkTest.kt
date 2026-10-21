package com.rouge.hermes.protocol

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TalkTest {
    @Test
    fun holdOnThePhoneThenStreamAndHaptic() {
        val pressed = reduce(TalkModel(), TalkEvent.Press(phoneReachable = true, sessionId = "s"))
        assertEquals(Phase.HOLDING, pressed.model.phase)
        assertEquals(Route.PHONE, pressed.model.session?.route)
        assertEquals(
            listOf(TalkAction.StartMic("s", Mode.TALK), TalkAction.OpenPhone("s", Mode.TALK)),
            pressed.actions,
        )
        val acked = reduce(pressed.model, TalkEvent.Ack("s"))
        assertTrue(acked.model.session!!.acked)
        val released = reduce(acked.model, TalkEvent.Release)
        assertEquals(Phase.SENDING, released.model.phase)
        assertEquals(listOf(TalkAction.StopMic("s"), TalkAction.ClosePhone("s")), released.actions)
        val spoken = reduce(released.model, TalkEvent.Delta("s", "Hello"))
        assertEquals("Hello", spoken.model.reply)
        assertEquals(listOf(TalkAction.Speak("Hello")), spoken.actions)
        val done = reduce(spoken.model, TalkEvent.Done("s"))
        assertEquals(Phase.IDLE, done.model.phase)
        assertEquals("Hello", done.model.reply)
        assertEquals(listOf(TalkAction.Haptic), done.actions)
    }

    @Test
    fun noPhoneUsesTheWatchRecognizerAndTheRelay() {
        var model = reduce(TalkModel(), TalkEvent.Press(false, "s")).model
        assertEquals(Capture.RECOGNIZER, model.session?.capture)
        model = reduce(model, TalkEvent.Release).model
        val transcript = reduce(model, TalkEvent.LocalTranscript("s", "status"))
        assertEquals(listOf(TalkAction.Relay("s", "status", Mode.TALK)), transcript.actions)
        assertEquals("status", transcript.model.heard)
    }

    @Test
    fun timeoutWhileHoldingSwitchesToTheWatch() {
        val holding = reduce(TalkModel(), TalkEvent.Press(true, "s")).model
        val lost = reduce(holding, TalkEvent.AckTimeout("s"))
        assertEquals(Route.WATCH, lost.model.session?.route)
        assertEquals(Capture.RECOGNIZER, lost.model.session?.capture)
        assertEquals(Phase.HOLDING, lost.model.phase)
        assertTrue(lost.actions.contains(TalkAction.StartRecognizer("s", Mode.TALK)))
        assertTrue(lost.actions.contains(TalkAction.Barge("s")))
        val acked = reduce(holding, TalkEvent.Ack("s")).model
        val ignored = reduce(acked, TalkEvent.AckTimeout("s"))
        assertEquals(Route.PHONE, ignored.model.session?.route)
        assertTrue(ignored.actions.isEmpty())
    }

    @Test
    fun newPressBargesIn() {
        var model = reduce(TalkModel(), TalkEvent.Press(true, "s")).model
        model = reduce(model, TalkEvent.Release).model
        model = reduce(model, TalkEvent.Delta("s", "Hello")).model
        val again = reduce(model, TalkEvent.Press(true, "next"))
        assertTrue(again.actions.contains(TalkAction.StopSpeak))
        assertTrue(again.actions.contains(TalkAction.Barge("s")))
        assertTrue(again.actions.contains(TalkAction.CancelRelay))
        assertEquals("next", again.model.session?.id)
        assertEquals("", again.model.reply)
    }

    @Test
    fun foodModeSyncsAfterTheReply() {
        var model = reduce(TalkModel(), TalkEvent.ArmFood).model
        assertEquals(Mode.FOOD, model.armed)
        model = reduce(model, TalkEvent.Press(true, "s")).model
        assertEquals(Mode.FOOD, model.session?.mode)
        model = reduce(model, TalkEvent.Release).model
        val done = reduce(model, TalkEvent.Done("s"))
        assertEquals(listOf(TalkAction.Haptic, TalkAction.SyncFood), done.actions)
    }

    @Test
    fun blankTranscriptAndFailure() {
        var model = reduce(TalkModel(), TalkEvent.Press(false, "s")).model
        model = reduce(model, TalkEvent.Release).model
        val missed = reduce(model, TalkEvent.LocalTranscript("s", "  "))
        assertEquals("Didn't catch that", missed.model.error)
        assertNull(missed.model.session)
        val sending = reduce(TalkModel(phase = Phase.SENDING, session = Live("s", Mode.TALK, Route.PHONE, true, Capture.MIC)), TalkEvent.Failed("s", "Hermes failed the turn"))
        assertEquals("Hermes failed the turn", sending.model.error)
        assertEquals(listOf(TalkAction.StopSpeak), sending.actions)
    }

    @Test
    fun foodListDoesNotDisturbATurn() {
        val holding = reduce(TalkModel(), TalkEvent.Press(true, "s")).model
        val listed = reduce(holding, TalkEvent.FoodList(listOf(FoodEntry("08:10", "oats", listOf("oats")))))
        assertEquals(Phase.HOLDING, listed.model.phase)
        assertEquals(1, listed.model.food.size)
    }
}
