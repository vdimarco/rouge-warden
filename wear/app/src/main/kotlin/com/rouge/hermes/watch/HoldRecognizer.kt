package com.rouge.hermes.watch

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer

/** Cloud speech is allowed when the on-device recognizer cannot hear the phrase. */
class HoldRecognizer(private val context: Context) {
    private var recognizer: SpeechRecognizer? = null
    private var preferOffline = true
    private var retried = false

    fun start(onPartial: (String) -> Unit, onText: (String) -> Unit, onError: (String) -> Unit) {
        stop()
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            onError("Speech recognition is not on this watch")
            return
        }
        preferOffline = true
        retried = false
        listen(onPartial, onText, onError)
    }

    fun stop() {
        recognizer?.stopListening()
    }

    fun destroy() {
        recognizer?.destroy()
        recognizer = null
    }

    private fun listen(onPartial: (String) -> Unit, onText: (String) -> Unit, onError: (String) -> Unit) {
        recognizer?.destroy()
        val next = SpeechRecognizer.createSpeechRecognizer(context)
        recognizer = next
        next.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) = Unit
            override fun onBeginningOfSpeech() = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() = Unit
            override fun onPartialResults(partialResults: Bundle?) {
                onPartial(partialResults?.text().orEmpty())
            }
            override fun onResults(results: Bundle?) {
                onText(results?.text().orEmpty())
            }
            override fun onError(error: Int) {
                val network = error == SpeechRecognizer.ERROR_NETWORK ||
                    error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT ||
                    error == SpeechRecognizer.ERROR_SERVER
                if (network && preferOffline && !retried) {
                    preferOffline = false
                    retried = true
                    listen(onPartial, onText, onError)
                    return
                }
                if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) onText("")
                else onError(errorName(error))
            }
            override fun onEvent(eventType: Int, params: Bundle?) = Unit
        })
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, preferOffline)
        }
        next.startListening(intent)
    }

    private fun Bundle.text(): String =
        getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()

    private fun errorName(code: Int): String = when (code) {
        SpeechRecognizer.ERROR_AUDIO -> "Microphone error"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Allow the microphone"
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT, SpeechRecognizer.ERROR_SERVER ->
            "Speech service unavailable"
        else -> "Didn't catch that"
    }
}
