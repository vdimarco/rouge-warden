package com.rouge.hermes.watch

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material.Chip
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import com.rouge.hermes.protocol.Mode
import com.rouge.hermes.protocol.Phase
import com.rouge.hermes.relay.RelayStore

class MainActivity : ComponentActivity() {
    private val micPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        intent?.data?.toString()?.let { RelayStore(this).save(it) }
        if (intent?.getStringExtra("mode") == "food") startFood = true
        setContent {
            MaterialTheme {
                TalkScreen(
                    startFood = startFood,
                    ensureMic = {
                        val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                        if (!granted) micPermission.launch(Manifest.permission.RECORD_AUDIO)
                        granted
                    },
                )
            }
        }
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        intent.data?.toString()?.let { RelayStore(this).save(it) }
    }

    override fun onResume() {
        super.onResume()
    }

    private var startFood: Boolean = false
}

@Composable
private fun TalkScreen(startFood: Boolean, ensureMic: () -> Boolean) {
    val controller: WatchController = viewModel()
    val state by controller.state.collectAsState()
    val hasKey by controller.hasKey.collectAsState()
    LaunchedEffect(startFood) {
        if (startFood) controller.armFood()
        controller.reloadKey()
    }
    ScalingLazyColumn(
        modifier = Modifier.fillMaxSize(),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        item { TimeText() }
        item {
            Text(
                text = if (!hasKey) "Add the relay key" else state.status,
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
            )
        }
        item {
            val shown = state.reply.ifBlank { state.heard }
            Text(text = shown, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 12.dp))
        }
        item {
            HoldPad(
                label = if (state.armed == Mode.FOOD) "Log" else "Talk",
                holding = state.phase == Phase.HOLDING,
                onHold = {
                    if (ensureMic()) controller.press()
                },
                onRelease = { controller.release() },
            )
        }
        item {
            Chip(
                label = { Text(if (state.armed == Mode.FOOD) "Logging food" else "Log food") },
                onClick = { controller.toggleMode() },
                enabled = state.phase != Phase.HOLDING,
            )
        }
        item {
            Chip(
                label = { Text(com.rouge.hermes.protocol.Agents.label(state.agent)) },
                onClick = { controller.cycleAgent() },
                enabled = state.phase == Phase.IDLE,
            )
        }
        items(state.food.size) { index ->
            Text(state.food[index].label(), fontSize = 12.sp, textAlign = TextAlign.Center)
        }
    }
}

@Composable
private fun HoldPad(label: String, holding: Boolean, onHold: () -> Unit, onRelease: () -> Unit) {
    val hold = rememberUpdatedState(onHold)
    val release = rememberUpdatedState(onRelease)
    Box(
        modifier = Modifier
            .padding(vertical = 4.dp)
            .size(96.dp)
            .clip(CircleShape)
            .background(if (holding) Color(0xFF7C9CFF) else Color(0xFF2C3E66))
            .pointerInput(Unit) {
                awaitEachGesture {
                    awaitFirstDown()
                    hold.value()
                    waitForUpOrCancellation()
                    release.value()
                }
            },
        contentAlignment = Alignment.Center,
    ) {
        Text(label)
    }
}
