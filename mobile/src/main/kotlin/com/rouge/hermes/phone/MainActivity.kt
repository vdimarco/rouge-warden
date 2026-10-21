package com.rouge.hermes.phone

import android.Manifest
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
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
import com.rouge.hermes.protocol.localDay
import com.rouge.hermes.relay.RelayStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.ZoneId

class MainActivity : ComponentActivity() {
    private val camera = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) launchScan()
    }
    private val scan = registerForActivityResult(ScanContract()) { result ->
        val text = result.contents ?: return@registerForActivityResult
        RelayStore(this).save(text)
        PhoneHub.applySetup(this)
        PhoneHub.pushConfig(this)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        PhoneHub.start(this)
        intent?.data?.toString()?.let { raw ->
            RelayStore(this).save(raw)
            PhoneHub.applySetup(this)
            PhoneHub.pushConfig(this)
        }
        setContent { MaterialTheme { PhoneScreen(::scanRelay) } }
    }

    private fun scanRelay() {
        val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        if (granted) launchScan() else camera.launch(Manifest.permission.CAMERA)
    }

    private fun launchScan() {
        scan.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("Relay key"))
    }
}

@Composable
private fun PhoneScreen(onScan: () -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    val store = remember { RelayStore(context) }
    val scope = rememberCoroutineScope()
    var url by remember { mutableStateOf(store.read()?.url.orEmpty()) }
    var token by remember { mutableStateOf("") }
    var agent by remember { mutableStateOf(store.agent()) }
    var note by remember { mutableStateOf(if (ModelStore.ready(context.filesDir)) "Speech model is ready" else "Speech model is not downloaded") }
    var food by remember { mutableStateOf("Today's food appears here") }

    Column(
        modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Hermes on your phone", style = MaterialTheme.typography.headlineSmall)
        Text("The watch sends audio here. This phone transcribes it and talks to the relay.")
        OutlinedTextField(url, { url = it }, label = { Text("Relay URL") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(token, { token = it }, label = { Text("Relay token") }, modifier = Modifier.fillMaxWidth())
        Button(onClick = {
            store.save(url.trim(), token.trim())
            PhoneHub.applySetup(context)
            PhoneHub.pushConfig(context)
            note = if (store.read() == null) "That key was not saved" else "Key saved and sent to the watch"
        }) { Text("Save key") }
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
                food = "Add the relay key first"
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
    }
}
