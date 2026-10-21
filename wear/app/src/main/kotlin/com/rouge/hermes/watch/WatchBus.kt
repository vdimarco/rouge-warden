package com.rouge.hermes.watch

import com.rouge.hermes.protocol.WireMsg
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

object WatchBus {
    private val events = MutableSharedFlow<WireMsg>(extraBufferCapacity = 32)
    val stream = events.asSharedFlow()
    fun post(msg: WireMsg) {
        events.tryEmit(msg)
    }
}
