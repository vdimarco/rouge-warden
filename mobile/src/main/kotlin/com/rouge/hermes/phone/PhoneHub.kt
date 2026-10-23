package com.rouge.hermes.phone

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.rouge.hermes.protocol.HermesRelay
import com.rouge.hermes.protocol.Paths
import com.rouge.hermes.protocol.PhoneEngine
import com.rouge.hermes.protocol.WireMsg
import com.rouge.hermes.protocol.localDay
import com.rouge.hermes.relay.RelayStore
import java.time.ZoneId

object PhoneHub {
    lateinit var relay: HermesRelay
        private set
    lateinit var engine: PhoneEngine
        private set
    private var started = false

    fun start(context: Context) {
        if (started) return
        synchronized(this) {
            if (started) return
            val app = context.applicationContext
            val client = HermesRelay(preferSocket = true)
            relay = client
            engine = PhoneEngine(
                VoskTranscriber(app),
                client,
                { node, msg -> send(app, node, msg) },
                { localDay(System.currentTimeMillis(), ZoneId.systemDefault()) },
                log = { line -> Log.i("HermesPhone", line) },
            )
            started = true
            applySetup(app)
        }
    }

    fun applySetup(context: Context) {
        if (!started) start(context)
        val setup = RelayStore(context).read() ?: return
        relay.configure(setup.url, setup.token)
        relay.warm()
    }

    fun pushConfig(context: Context) {
        val store = RelayStore(context)
        val setup = store.read() ?: return
        val map = PutDataMapRequest.create(Paths.CONFIG)
        map.dataMap.putString("url", setup.url)
        map.dataMap.putString("token", setup.token)
        map.dataMap.putString("agent", store.agent())
        Wearable.getDataClient(context).putDataItem(map.asPutDataRequest().setUrgent())
    }

    private fun send(context: Context, node: String, msg: WireMsg) {
        Wearable.getMessageClient(context).sendMessage(node, Paths.PHONE, msg.encode().toByteArray())
    }
}
