package com.rouge.hermes.watch

import android.app.Application
import android.content.pm.PackageManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.speech.tts.TextToSpeech
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.rouge.hermes.protocol.Agents
import com.rouge.hermes.protocol.HermesRelay
import com.rouge.hermes.protocol.Mode
import com.rouge.hermes.protocol.SentenceBuffer
import com.rouge.hermes.protocol.Speech
import com.rouge.hermes.protocol.TalkAction
import com.rouge.hermes.protocol.TalkEvent
import com.rouge.hermes.protocol.TalkModel
import com.rouge.hermes.protocol.WireMsg
import com.rouge.hermes.protocol.localDay
import com.rouge.hermes.protocol.reduce
import com.rouge.hermes.protocol.wire
import com.rouge.hermes.relay.RelayStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.ZoneId
import java.util.Locale
import java.util.UUID

class WatchController(app: Application) : AndroidViewModel(app) {
    private val link = WatchLink(app)
    private val store = RelayStore(app)
    private val recognizer = HoldRecognizer(app)
    private val speaker = Speaker(app)
    private var model = TalkModel(agent = store.agent())
    private val _state = MutableStateFlow(model)
    val state = _state.asStateFlow()
    val hasKey = MutableStateFlow(false)
    private var ackJob: Job? = null
    private var pressGeneration = 0
    private var relay: HermesRelay? = null
    private var sessionId: String? = null
    private val sentences = SentenceBuffer()
    private var releasedAt = 0L
    private var loggedAudio = false

    init {
        MicHub.onPcm = { link.write(it) }
        MicHub.onError = { message -> sessionId?.let { dispatch(TalkEvent.Failed(it, message)) } }
        viewModelScope.launch {
            runCatching { link.pullConfig() }
            reloadKey()
            refreshFood()
            WatchBus.stream.collect { msg ->
                when (msg) {
                    is WireMsg.Ack -> {
                        ackJob?.cancel()
                        dispatch(TalkEvent.Ack(msg.session))
                    }
                    is WireMsg.Partial -> dispatch(TalkEvent.Heard(msg.session, msg.text))
                    is WireMsg.Delta -> dispatch(TalkEvent.Delta(msg.session, msg.text))
                    is WireMsg.Done -> dispatch(TalkEvent.Done(msg.session))
                    is WireMsg.Failed -> dispatch(TalkEvent.Failed(msg.session, msg.message))
                    is WireMsg.NeedRecognizer -> dispatch(TalkEvent.NeedRecognizer(msg.session))
                    is WireMsg.FoodList -> dispatch(TalkEvent.FoodList(msg.entries))
                    else -> Unit
                }
            }
        }
    }

    fun reloadKey() {
        hasKey.value = store.read() != null
        dispatch(TalkEvent.SetAgent(store.agent()))
    }

    fun cycleAgent() {
        val next = Agents.next(model.agent)
        store.setAgent(next)
        dispatch(TalkEvent.SetAgent(next))
    }

    fun armFood() = dispatch(TalkEvent.ArmFood)

    fun toggleMode() = dispatch(TalkEvent.ToggleMode)

    fun press() {
        if (ContextCompat.checkSelfPermission(getApplication(), android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            dispatch(TalkEvent.Failed(model.session?.id ?: "mic", "Allow the microphone"))
            return
        }
        val generation = ++pressGeneration
        viewModelScope.launch {
            val reachable = runCatching { link.reachable() }.getOrDefault(false)
            if (generation != pressGeneration) return@launch
            val id = UUID.randomUUID().toString()
            sessionId = id
            dispatch(TalkEvent.Press(reachable, id))
            if (reachable) {
                ackJob?.cancel()
                ackJob = viewModelScope.launch {
                    kotlinx.coroutines.delay(2500)
                    dispatch(TalkEvent.AckTimeout(id))
                }
            }
        }
    }

    fun release() {
        pressGeneration += 1
        releasedAt = System.currentTimeMillis()
        loggedAudio = false
        sentences.clear()
        dispatch(TalkEvent.Release)
    }

    private fun dispatch(event: TalkEvent) {
        val step = reduce(model, event)
        model = step.model
        _state.value = model
        for (action in step.actions) apply(action)
    }

    private fun apply(action: TalkAction) {
        val app = getApplication<Application>()
        when (action) {
            is TalkAction.StartMic -> MicHub.start(app)
            is TalkAction.StopMic -> MicHub.stop(app)
            is TalkAction.OpenPhone -> viewModelScope.launch {
                val opened = runCatching { link.open(action.sessionId, action.mode, action.agent) }.getOrDefault(false)
                if (!opened || linkFailed()) dispatch(TalkEvent.PhoneLost(action.sessionId))
            }
            is TalkAction.ClosePhone -> viewModelScope.launch {
                runCatching { link.close(action.sessionId) }
            }
            is TalkAction.Barge -> viewModelScope.launch {
                runCatching { link.barge(action.sessionId) }
            }
            is TalkAction.StartRecognizer -> recognizer.start(
                onPartial = { text ->
                    if (text.isNotBlank()) {
                        model = model.copy(heard = text)
                        _state.value = model
                    }
                },
                onText = { dispatch(TalkEvent.LocalTranscript(action.sessionId, it)) },
                onError = { dispatch(TalkEvent.Failed(action.sessionId, it)) },
            )
            is TalkAction.StopRecognizer -> recognizer.stop()
            is TalkAction.Speak -> {
                for (line in sentences.push(action.text)) sayTimed(line)
            }
            TalkAction.StopSpeak -> {
                sentences.clear()
                speaker.stop()
            }
            TalkAction.Haptic -> {
                val rest = sentences.flush()
                if (rest.isNotBlank()) sayTimed(rest)
                buzz()
            }
            TalkAction.CancelRelay -> relay?.cancel()
            is TalkAction.Relay -> speakFromRelay(action)
            TalkAction.SyncFood -> viewModelScope.launch { refreshFood() }
        }
    }

    private fun linkFailed(): Boolean = false

    private fun speakFromRelay(action: TalkAction.Relay) {
        val setup = store.read()
        if (setup == null) {
            dispatch(TalkEvent.Failed(action.sessionId, "Add the relay key"))
            return
        }
        val client = HermesRelay()
        relay = client
        val day = localDay(System.currentTimeMillis(), ZoneId.systemDefault())
        viewModelScope.launch(Dispatchers.IO) {
            try {
                client.stream(setup.url, setup.token, action.text, action.mode.wire(), day, action.agent) { speech ->
                    viewModelScope.launch {
                        when (speech) {
                            is Speech.Words -> dispatch(TalkEvent.Delta(action.sessionId, speech.text))
                            Speech.Done -> dispatch(TalkEvent.Done(action.sessionId))
                            is Speech.Failed -> dispatch(TalkEvent.Failed(action.sessionId, speech.message))
                        }
                    }
                }
            } catch (error: Exception) {
                viewModelScope.launch {
                    dispatch(TalkEvent.Failed(action.sessionId, error.message ?: "Couldn't reach Hermes"))
                }
            }
        }
    }

    private suspend fun refreshFood() {
        val day = localDay(System.currentTimeMillis(), ZoneId.systemDefault())
        runCatching { link.foodSync(day) }
        val setup = store.read() ?: return
        val entries = runCatching {
            kotlinx.coroutines.withContext(Dispatchers.IO) {
                HermesRelay().food(setup.url, setup.token, day)
            }
        }.getOrNull() ?: return
        dispatch(TalkEvent.FoodList(entries))
    }

    private fun sayTimed(text: String) {
        if (!loggedAudio && releasedAt > 0L) {
            loggedAudio = true
            Log.i("HermesWatch", "ttfa ${System.currentTimeMillis() - releasedAt}ms")
        }
        speaker.say(text)
    }

    private fun buzz() {
        val vibrator = getApplication<Application>().getSystemService(Vibrator::class.java) ?: return
        vibrator.vibrate(VibrationEffect.createOneShot(40, VibrationEffect.DEFAULT_AMPLITUDE))
    }

    override fun onCleared() {
        pressGeneration += 1
        recognizer.destroy()
        speaker.shutdown()
        MicHub.stop(getApplication())
        super.onCleared()
    }
}

private class Speaker(app: Application) : TextToSpeech.OnInitListener {
    private val tts = TextToSpeech(app, this)
    private var ready = false

    override fun onInit(status: Int) {
        ready = status == TextToSpeech.SUCCESS
        if (ready) tts.language = Locale.US
    }

    fun say(text: String) {
        if (!ready || text.isBlank()) return
        tts.speak(text, TextToSpeech.QUEUE_ADD, null, UUID.randomUUID().toString())
    }

    fun stop() {
        tts.stop()
    }

    fun shutdown() {
        tts.shutdown()
    }
}
