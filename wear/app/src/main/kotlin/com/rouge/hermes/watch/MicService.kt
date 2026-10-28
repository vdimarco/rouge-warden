package com.rouge.hermes.watch

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.os.IBinder
import java.util.concurrent.atomic.AtomicInteger

/** PCM16 mono at 16 kHz. The activity reads frames through [MicHub]. */
object MicHub {
    private val generation = AtomicInteger(0)
    @Volatile var onPcm: ((ByteArray) -> Unit)? = null
    @Volatile var onError: ((String) -> Unit)? = null

    fun current(): Int = generation.get()

    fun start(context: Context) {
        val gen = generation.incrementAndGet()
        val intent = Intent(context, MicService::class.java).putExtra(MicService.EXTRA_GEN, gen)
        context.startForegroundService(intent)
    }

    fun stop(context: Context) {
        generation.incrementAndGet()
        context.stopService(Intent(context, MicService::class.java))
    }
}

class MicService : Service() {
    private var record: AudioRecord? = null
    private var thread: Thread? = null
    @Volatile private var running = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startInForeground()
        val gen = intent?.getIntExtra(EXTRA_GEN, 0) ?: 0
        if (gen != MicHub.current()) {
            stopSelf()
            return START_NOT_STICKY
        }
        try {
            startCapture()
        } catch (error: Exception) {
            MicHub.onError?.invoke(error.message ?: "Microphone unavailable")
            stopSelf()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        stopCapture()
        super.onDestroy()
    }

    private fun startInForeground() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL, getString(R.string.mic_channel), NotificationManager.IMPORTANCE_LOW),
        )
        val notification: Notification = Notification.Builder(this, CHANNEL)
            .setContentTitle(getString(R.string.app_name))
            .setContentText(getString(R.string.mic_notice))
            .setSmallIcon(R.drawable.ic_hermes)
            .build()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTICE_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
            startForeground(NOTICE_ID, notification)
        }
    }

    private fun startCapture() {
        stopCapture()
        val min = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
        if (min <= 0) error("Microphone unavailable")
        val size = maxOf(min, 3200)
        val audio = AudioRecord(
            MediaRecorder.AudioSource.MIC,
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            size,
        )
        if (audio.state != AudioRecord.STATE_INITIALIZED) {
            audio.release()
            error("Microphone unavailable")
        }
        record = audio
        running = true
        audio.startRecording()
        thread = Thread {
            val bytes = ByteArray(size)
            while (running) {
                val n = audio.read(bytes, 0, bytes.size)
                if (n > 0) MicHub.onPcm?.invoke(bytes.copyOf(n))
            }
        }.also { it.name = "hermes-mic"; it.start() }
    }

    private fun stopCapture() {
        running = false
        thread?.join(400)
        thread = null
        record?.run {
            try {
                stop()
            } catch (_: Exception) {
            }
            release()
        }
        record = null
    }

    companion object {
        const val EXTRA_GEN = "gen"
        private const val CHANNEL = "hermes-mic"
        private const val NOTICE_ID = 7
        const val SAMPLE_RATE = 16000
    }
}
