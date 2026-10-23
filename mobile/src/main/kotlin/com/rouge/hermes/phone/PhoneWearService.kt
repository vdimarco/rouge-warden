package com.rouge.hermes.phone

import com.google.android.gms.wearable.ChannelClient
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import com.rouge.hermes.protocol.Paths
import com.rouge.hermes.protocol.WireMsg
import kotlin.concurrent.thread

class PhoneWearService : WearableListenerService() {
    override fun onCreate() {
        super.onCreate()
        PhoneHub.start(this)
    }

    override fun onMessageReceived(event: MessageEvent) {
        if (event.path != Paths.WATCH) return
        PhoneHub.start(this)
        val msg = WireMsg.parse(event.data.toString(Charsets.UTF_8)) ?: return
        PhoneHub.engine.onMessage(event.sourceNodeId, msg)
    }

    override fun onChannelOpened(channel: ChannelClient.Channel) {
        if (channel.path != Paths.AUDIO) return
        PhoneHub.start(this)
        Wearable.getChannelClient(this).getInputStream(channel).addOnSuccessListener { stream ->
            thread(name = "hermes-audio") {
                val buf = ByteArray(3200)
                try {
                    while (true) {
                        val n = stream.read(buf)
                        if (n < 0) break
                        if (n > 0) PhoneHub.engine.onPcm(buf.copyOf(n))
                    }
                } catch (_: Exception) {
                    // The watch closed the channel.
                } finally {
                    PhoneHub.engine.onAudioClosed()
                    runCatching { stream.close() }
                }
            }
        }
    }
}
