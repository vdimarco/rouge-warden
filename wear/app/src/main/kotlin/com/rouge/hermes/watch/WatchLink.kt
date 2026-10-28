package com.rouge.hermes.watch

import android.content.Context
import com.google.android.gms.wearable.CapabilityClient
import com.google.android.gms.wearable.ChannelClient
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import com.rouge.hermes.protocol.Mode
import com.rouge.hermes.protocol.Paths
import com.rouge.hermes.protocol.WireMsg
import com.rouge.hermes.protocol.wire
import com.rouge.hermes.relay.RelayStore
import kotlinx.coroutines.tasks.await
import java.io.ByteArrayOutputStream
import java.io.OutputStream

class WatchLink(private val context: Context) {
    private val pipe = AudioPipe()
    private var channel: ChannelClient.Channel? = null
    private var node: String? = null

    suspend fun reachable(): Boolean = nodeId() != null

    suspend fun open(session: String, mode: Mode, agent: String): Boolean {
        val id = nodeId() ?: return false
        node = id
        pipe.reset()
        send(id, WireMsg.PttStart(session, mode.wire(), agent))
        val opened = Wearable.getChannelClient(context).openChannel(id, Paths.AUDIO).await()
        channel = opened
        val stream = Wearable.getChannelClient(context).getOutputStream(opened).await()
        pipe.attach(stream)
        return !pipe.failed
    }

    fun write(bytes: ByteArray) {
        pipe.write(bytes)
    }

    suspend fun close(session: String) {
        pipe.close()
        closeChannel()
        val id = node ?: nodeId() ?: return
        send(id, WireMsg.PttStop(session))
    }

    suspend fun barge(session: String) {
        pipe.close()
        closeChannel()
        val id = node ?: return
        send(id, WireMsg.Barge(session))
    }

    suspend fun foodSync(day: String) {
        val id = nodeId() ?: return
        send(id, WireMsg.FoodSync(day))
    }

    suspend fun pullConfig() {
        val buffer = Wearable.getDataClient(context).dataItems.await()
        try {
            for (index in 0 until buffer.count) {
                val item = buffer.get(index)
                if (item.uri.path != Paths.CONFIG) continue
                val map = DataMapItem.fromDataItem(item).dataMap
                val url = map.getString("url") ?: continue
                val token = map.getString("token") ?: continue
                val store = RelayStore(context)
                store.save(url, token)
                map.getString("agent")?.let { store.setAgent(it) }
            }
        } finally {
            buffer.release()
        }
    }

    private suspend fun closeChannel() {
        val open = channel
        channel = null
        if (open != null) {
            runCatching { Wearable.getChannelClient(context).close(open).await() }
        }
    }

    private suspend fun send(id: String, msg: WireMsg) {
        Wearable.getMessageClient(context).sendMessage(id, Paths.WATCH, msg.encode().toByteArray()).await()
    }

    private suspend fun nodeId(): String? {
        val info = Wearable.getCapabilityClient(context)
            .getCapability("hermes_phone", CapabilityClient.FILTER_REACHABLE)
            .await()
        node = info.nodes.firstOrNull { it.isNearby }?.id ?: info.nodes.firstOrNull()?.id
        return node
    }
}

/** Holds PCM until the phone channel is open, then writes it through. */
class AudioPipe {
    private val pending = ByteArrayOutputStream()
    private var out: OutputStream? = null
    @Volatile var failed: Boolean = false

    @Synchronized
    fun write(pcm: ByteArray) {
        if (failed) return
        val stream = out
        if (stream == null) {
            if (pending.size() + pcm.size > MAX) failed = true else pending.write(pcm)
            return
        }
        try {
            stream.write(pcm)
        } catch (_: Exception) {
            failed = true
        }
    }

    @Synchronized
    fun attach(stream: OutputStream) {
        try {
            stream.write(pending.toByteArray())
            pending.reset()
            out = stream
        } catch (_: Exception) {
            failed = true
        }
    }

    @Synchronized
    fun close() {
        try {
            out?.flush()
            out?.close()
        } catch (_: Exception) {
        }
        out = null
    }

    @Synchronized
    fun reset() {
        close()
        pending.reset()
        failed = false
    }

    companion object {
        private const val MAX = 1_000_000
    }
}
