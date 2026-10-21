package com.rouge.hermes.watch

import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import com.rouge.hermes.protocol.Paths
import com.rouge.hermes.protocol.WireMsg
import com.rouge.hermes.relay.RelayStore

class WatchWearService : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        if (event.path != Paths.PHONE) return
        val msg = WireMsg.parse(event.data.toString(Charsets.UTF_8)) ?: return
        WatchBus.post(msg)
    }

    override fun onDataChanged(events: DataEventBuffer) {
        try {
            for (index in 0 until events.count) {
                val event = events.get(index)
                if (event.type != DataEvent.TYPE_CHANGED) continue
                if (event.dataItem.uri.path != Paths.CONFIG) continue
                val map = DataMapItem.fromDataItem(event.dataItem).dataMap
                val url = map.getString("url") ?: continue
                val token = map.getString("token") ?: continue
                val store = RelayStore(this)
                store.save(url, token)
                map.getString("agent")?.let { store.setAgent(it) }
                WatchBus.savedConfig()
            }
        } finally {
            events.release()
        }
    }
}
