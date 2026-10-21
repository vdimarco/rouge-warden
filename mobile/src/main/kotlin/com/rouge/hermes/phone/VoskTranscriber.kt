package com.rouge.hermes.phone

import android.content.Context
import com.rouge.hermes.protocol.Json
import com.rouge.hermes.protocol.Transcriber
import org.vosk.LibVosk
import org.vosk.LogLevel
import org.vosk.Model
import org.vosk.Recognizer

/** On-device speech. The model is downloaded by the phone app, not packed into the APK. */
class VoskTranscriber(context: Context) : Transcriber {
    private val files = context.applicationContext.filesDir
    private val lock = Any()
    private var model: Model? = null
    private var recognizer: Recognizer? = null
    private var failed = false

    override fun ready(): Boolean = !failed && ModelStore.ready(files)

    override fun transcribe(pcm: ByteArray): String {
        push(pcm)
        return finish().orEmpty()
    }

    override fun push(pcm: ByteArray): String = synchronized(lock) {
        val ear = recognizer() ?: return@synchronized ""
        ear.acceptWaveForm(pcm, pcm.size)
        field(ear.partialResult, "partial")
    }

    override fun finish(): String? = synchronized(lock) {
        val ear = recognizer ?: return@synchronized null
        val text = field(ear.finalResult, "text")
        ear.reset()
        text
    }

    private fun recognizer(): Recognizer? {
        recognizer?.let { return it }
        if (failed || !ready()) return null
        return try {
            LibVosk.setLogLevel(LogLevel.WARNINGS)
            val path = ModelStore.modelDir(files)?.absolutePath ?: return null
            val loaded = model ?: Model(path).also { model = it }
            Recognizer(loaded, 16000f).also { recognizer = it }
        } catch (_: Exception) {
            failed = true
            null
        }
    }

    private fun field(json: String, key: String): String {
        val obj = try {
            Json.parse(json) as? Json.Obj
        } catch (_: Exception) {
            null
        } ?: return ""
        return obj.str(key).orEmpty()
    }
}
