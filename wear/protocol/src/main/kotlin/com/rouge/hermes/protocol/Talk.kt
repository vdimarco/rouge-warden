package com.rouge.hermes.protocol

enum class Mode { TALK, FOOD }

fun Mode.wire(): String = if (this == Mode.FOOD) "food" else "talk"

enum class Phase { IDLE, HOLDING, SENDING }

enum class Route { PHONE, WATCH }

enum class Capture { MIC, RECOGNIZER }

data class Live(
    val id: String,
    val mode: Mode,
    val route: Route,
    val acked: Boolean,
    val capture: Capture,
)

data class TalkModel(
    val phase: Phase = Phase.IDLE,
    val armed: Mode = Mode.TALK,
    val agent: String = Agents.HERMES,
    val session: Live? = null,
    val reply: String = "",
    val heard: String = "",
    val status: String = "Ready",
    val error: String? = null,
    val food: List<FoodEntry> = emptyList(),
)

sealed class TalkEvent {
    data object ToggleMode : TalkEvent()
    data object ArmFood : TalkEvent()
    data class SetAgent(val agent: String) : TalkEvent()
    data class Press(val phoneReachable: Boolean, val sessionId: String) : TalkEvent()
    data object Release : TalkEvent()
    data class Ack(val sessionId: String) : TalkEvent()
    data class AckTimeout(val sessionId: String) : TalkEvent()
    data class PhoneLost(val sessionId: String) : TalkEvent()
    data class NeedRecognizer(val sessionId: String) : TalkEvent()
    data class Delta(val sessionId: String, val text: String) : TalkEvent()
    data class Done(val sessionId: String) : TalkEvent()
    data class Failed(val sessionId: String, val message: String) : TalkEvent()
    data class Heard(val sessionId: String, val text: String) : TalkEvent()
    data class LocalTranscript(val sessionId: String, val text: String) : TalkEvent()
    data class FoodList(val entries: List<FoodEntry>) : TalkEvent()
}

sealed class TalkAction {
    data class StartMic(val sessionId: String, val mode: Mode) : TalkAction()
    data class StopMic(val sessionId: String) : TalkAction()
    data class OpenPhone(val sessionId: String, val mode: Mode, val agent: String = Agents.HERMES) : TalkAction()
    data class ClosePhone(val sessionId: String) : TalkAction()
    data class Barge(val sessionId: String) : TalkAction()
    data class StartRecognizer(val sessionId: String, val mode: Mode) : TalkAction()
    data class StopRecognizer(val sessionId: String) : TalkAction()
    data class Speak(val text: String) : TalkAction()
    data object StopSpeak : TalkAction()
    data object Haptic : TalkAction()
    data object CancelRelay : TalkAction()
    data class Relay(val sessionId: String, val text: String, val mode: Mode, val agent: String = Agents.HERMES) : TalkAction()
    data object SyncFood : TalkAction()
}

data class Step(val model: TalkModel, val actions: List<TalkAction>)

fun reduce(model: TalkModel, event: TalkEvent): Step = when (event) {
    TalkEvent.ToggleMode ->
        if (model.phase != Phase.IDLE) Step(model, emptyList())
        else Step(model.copy(armed = if (model.armed == Mode.TALK) Mode.FOOD else Mode.TALK), emptyList())
    TalkEvent.ArmFood ->
        if (model.phase != Phase.IDLE) Step(model, emptyList())
        else Step(model.copy(armed = Mode.FOOD), emptyList())
    is TalkEvent.SetAgent ->
        if (model.phase != Phase.IDLE || event.agent !in Agents.ALL) Step(model, emptyList())
        else Step(model.copy(agent = event.agent, status = "Ready"), emptyList())
    is TalkEvent.Press -> press(model, event)
    TalkEvent.Release -> release(model)
    is TalkEvent.Ack -> {
        val live = model.session
        if (live == null || live.id != event.sessionId) Step(model, emptyList())
        else Step(model.copy(session = live.copy(acked = true)), emptyList())
    }
    is TalkEvent.AckTimeout -> leavePhone(model, event.sessionId, "Phone unreachable, listening here", "Could not reach the phone")
    is TalkEvent.PhoneLost -> leavePhone(model, event.sessionId, "Phone unreachable, listening here", "Could not reach the phone")
    is TalkEvent.NeedRecognizer -> leavePhone(model, event.sessionId, "Listening on the watch", "Speech model is not on the phone yet")
    is TalkEvent.Delta -> {
        val live = model.session
        if (live == null || live.id != event.sessionId || model.phase != Phase.SENDING || event.text.isEmpty()) {
            Step(model, emptyList())
        } else {
            Step(
                model.copy(reply = model.reply + event.text, status = Agents.label(model.agent)),
                listOf(TalkAction.Speak(event.text)),
            )
        }
    }
    is TalkEvent.Done -> {
        val live = model.session
        if (live == null || live.id != event.sessionId || model.phase != Phase.SENDING) Step(model, emptyList())
        else Step(
            model.copy(phase = Phase.IDLE, session = null, status = "Ready", error = null),
            listOf(TalkAction.Haptic) + if (live.mode == Mode.FOOD) listOf(TalkAction.SyncFood) else emptyList(),
        )
    }
    is TalkEvent.Failed -> {
        val live = model.session
        if (live != null && live.id != event.sessionId) Step(model, emptyList())
        else Step(
            model.copy(phase = Phase.IDLE, session = null, status = event.message, error = event.message),
            listOf(TalkAction.StopSpeak),
        )
    }
    is TalkEvent.LocalTranscript -> {
        val live = model.session
        if (live == null || live.id != event.sessionId || live.route != Route.WATCH || model.phase != Phase.SENDING) {
            Step(model, emptyList())
        } else if (event.text.isBlank()) {
            Step(
                model.copy(phase = Phase.IDLE, session = null, status = "Didn't catch that", error = "Didn't catch that"),
                emptyList(),
            )
        } else {
            Step(
                model.copy(heard = event.text, status = "Sending"),
                listOf(TalkAction.Relay(live.id, event.text, live.mode, model.agent)),
            )
        }
    }
    is TalkEvent.Heard -> {
        val live = model.session
        if (live == null || live.id != event.sessionId || event.text.isEmpty()) Step(model, emptyList())
        else Step(model.copy(heard = event.text), emptyList())
    }
    is TalkEvent.FoodList -> Step(model.copy(food = event.entries), emptyList())
}

private fun press(model: TalkModel, event: TalkEvent.Press): Step {
    val stop = mutableListOf<TalkAction>()
    val previous = model.session
    if (previous != null && model.phase != Phase.IDLE) {
        stop += TalkAction.StopSpeak
        stop += TalkAction.CancelRelay
        if (previous.capture == Capture.MIC) stop += TalkAction.StopMic(previous.id)
        if (previous.capture == Capture.RECOGNIZER) stop += TalkAction.StopRecognizer(previous.id)
        if (previous.route == Route.PHONE) stop += TalkAction.Barge(previous.id)
    }
    val route = if (event.phoneReachable) Route.PHONE else Route.WATCH
    val capture = if (route == Route.PHONE) Capture.MIC else Capture.RECOGNIZER
    val live = Live(event.sessionId, model.armed, route, acked = false, capture)
    val start: List<TalkAction> = if (capture == Capture.MIC) {
        listOf(TalkAction.StartMic(live.id, live.mode), TalkAction.OpenPhone(live.id, live.mode, model.agent))
    } else {
        listOf(TalkAction.StartRecognizer(live.id, live.mode))
    }
    return Step(
        model.copy(phase = Phase.HOLDING, session = live, reply = "", heard = "", error = null, status = "Listening"),
        stop + start,
    )
}

private fun release(model: TalkModel): Step {
    val live = model.session
    if (model.phase != Phase.HOLDING || live == null) return Step(model, emptyList())
    val actions = if (live.capture == Capture.MIC) {
        listOf(TalkAction.StopMic(live.id), TalkAction.ClosePhone(live.id))
    } else {
        listOf(TalkAction.StopRecognizer(live.id))
    }
    return Step(model.copy(phase = Phase.SENDING, status = "Sending"), actions)
}

private fun leavePhone(model: TalkModel, sessionId: String, holdingStatus: String, sentStatus: String): Step {
    val live = model.session ?: return Step(model, emptyList())
    if (live.id != sessionId || live.route != Route.PHONE || live.acked) return Step(model, emptyList())
    if (model.phase == Phase.HOLDING) {
        return Step(
            model.copy(session = live.copy(route = Route.WATCH, capture = Capture.RECOGNIZER), status = holdingStatus),
            listOf(
                TalkAction.StopMic(live.id),
                TalkAction.Barge(live.id),
                TalkAction.StartRecognizer(live.id, live.mode),
            ),
        )
    }
    if (model.phase == Phase.SENDING) {
        return Step(
            model.copy(phase = Phase.IDLE, session = null, status = sentStatus, error = sentStatus),
            listOf(TalkAction.Barge(live.id), TalkAction.StopSpeak),
        )
    }
    return Step(model, emptyList())
}
