package com.rouge.hermes.phone

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.rouge.hermes.protocol.Agents
import com.rouge.hermes.protocol.HermesRelay
import com.rouge.hermes.protocol.RelaySetup
import com.rouge.hermes.protocol.localDay
import com.rouge.hermes.protocol.parseRelaySetup
import com.rouge.hermes.relay.RelayStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.ZoneId

data class LanRelay(val name: String, val setup: RelaySetup)

class MainActivity : ComponentActivity() {
    private var revision by mutableIntStateOf(0)
    private var banner by mutableStateOf("Tap a pairing link, scan the code, or connect on this Wi-Fi.")
    private var found by mutableStateOf(listOf<LanRelay>())
    private lateinit var discovery: LanDiscovery

    private val camera = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) launchScan()
    }
    private val scan = registerForActivityResult(ScanContract()) { result ->
        val text = result.contents ?: return@registerForActivityResult
        accept(text)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        PhoneHub.start(this)
        discovery = LanDiscovery(this) { name, setup ->
            found = (found.filter { it.setup.url != setup.url } + LanRelay(name, setup)).take(4)
        }
        accept(intent?.data?.toString())
        setContent {
            MaterialTheme {
                PhoneScreen(
                    revision = revision,
                    banner = banner,
                    found = found,
                    onScan = ::scanRelay,
                    onConnect = ::connect,
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        accept(intent.data?.toString())
    }

    override fun onStart() {
        super.onStart()
        discovery.start()
    }

    override fun onStop() {
        discovery.stop()
        super.onStop()
    }

    private fun scanRelay() {
        val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        if (granted) launchScan() else camera.launch(Manifest.permission.CAMERA)
    }

    private fun launchScan() {
        scan.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("Pairing code"))
    }

    private fun accept(raw: String?) {
        if (raw.isNullOrBlank()) return
        val setup = parseRelaySetup(raw) ?: run {
            banner = "That link had no relay."
            return
        }
        connect(setup)
    }

    private fun connect(setup: RelaySetup) {
        val store = RelayStore(this)
        store.save(setup.url, setup.token)
        if (store.read() == null) {
            banner = "That relay was not saved."
            return
        }
        PhoneHub.applySetup(this)
        PhoneHub.pushConfig(this)
        banner = "Paired. The watch can talk."
        revision++
    }
}

@Composable
private fun PhoneScreen(
    revision: Int,
    banner: String,
    found: List<LanRelay>,
    onScan: () -> Unit,
    onConnect: (RelaySetup) -> Unit,
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val store = remember { RelayStore(context) }
    val scope = rememberCoroutineScope()
    val paired = remember(revision) { store.read() != null }
    var agent by remember(revision) { mutableStateOf(store.agent()) }
    var advanced by remember { mutableStateOf(false) }
    var url by remember { mutableStateOf("") }
    var token by remember { mutableStateOf("") }
    var note by remember { mutableStateOf(if (ModelStore.ready(context.filesDir)) "Speech model is ready" else "Speech model is not downloaded") }
    var food by remember { mutableStateOf("Today's food appears here") }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Wrist Agent", style = MaterialTheme.typography.headlineSmall)
        Text(if (paired) "Connected. The watch can talk." else "The watch connects through this phone.")
        Text(banner)
        if (found.isEmpty() && !paired) Text("Looking for a relay on this Wi-Fi.")
        found.forEach { relay ->
            Button(onClick = { onConnect(relay.setup) }, modifier = Modifier.fillMaxWidth()) {
                Text("Connect to ${relay.name}")
            }
        }
        Button(onClick = onScan) { Text("Scan QR") }
        Text("Agent on the watch: ${Agents.label(agent)}")
        Agents.ALL.forEach { id ->
            Button(onClick = {
                store.setAgent(id)
                agent = id
                PhoneHub.pushConfig(context)
            }) { Text(Agents.label(id)) }
        }
        Button(onClick = {
            note = "Downloading the speech model"
            scope.launch {
                val result = withContext(Dispatchers.IO) {
                    runCatching { ModelStore.download(context.filesDir) }
                }
                note = result.fold(
                    onSuccess = { "Speech model is ready" },
                    onFailure = { it.message ?: "Download failed" },
                )
            }
        }) { Text("Download speech model") }
        Text(note)
        Button(onClick = {
            val setup = store.read()
            if (setup == null) {
                food = "Pair a relay first"
                return@Button
            }
            scope.launch {
                val day = localDay(System.currentTimeMillis(), ZoneId.systemDefault())
                val lines = withContext(Dispatchers.IO) {
                    runCatching { HermesRelay().food(setup.url, setup.token, day) }
                }
                food = lines.fold(
                    onSuccess = { entries ->
                        if (entries.isEmpty()) "No food logged today" else entries.joinToString("\n") { it.label() }
                    },
                    onFailure = { it.message ?: "Could not read the food log" },
                )
            }
        }) { Text("Today's food") }
        Text(food)
        TextButton(onClick = { advanced = !advanced }) { Text(if (advanced) "Hide advanced" else "Advanced") }
        if (advanced) {
            OutlinedTextField(url, { url = it }, label = { Text("Relay URL") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(token, { token = it }, label = { Text("Relay token") }, modifier = Modifier.fillMaxWidth())
            Button(onClick = {
                val setup = parseRelaySetup("url=${url.trim()}\ntoken=${token.trim()}")
                if (setup == null) note = "That key was not saved" else onConnect(setup)
            }) { Text("Save key") }
        }
    }
}
