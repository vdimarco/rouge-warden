package com.rouge.hermes.phone

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Handler
import android.os.Looper
import com.rouge.hermes.protocol.Json
import com.rouge.hermes.protocol.RelaySetup
import com.rouge.hermes.protocol.parseRelaySetup
import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.URL
import java.net.URLEncoder
import java.util.concurrent.Executors

/** Finds a relay advertising `_wristagent._tcp` on this Wi-Fi. */
class LanDiscovery(
    context: Context,
    private val onFound: (String, RelaySetup) -> Unit,
) {
    private val app = context.applicationContext
    private val nsd = app.getSystemService(NsdManager::class.java)
    private val main = Handler(Looper.getMainLooper())
    private val pool = Executors.newSingleThreadExecutor()
    private var lock: WifiManager.MulticastLock? = null
    private var listener: NsdManager.DiscoveryListener? = null

    fun start() {
        if (listener != null || nsd == null) return
        val wifi = app.getSystemService(WifiManager::class.java)
        lock = wifi?.createMulticastLock("wristagent")?.apply {
            setReferenceCounted(false)
            acquire()
        }
        val found = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) {}
            override fun onDiscoveryStopped(serviceType: String) {}
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {}
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
            override fun onServiceLost(serviceInfo: NsdServiceInfo) {}
            override fun onServiceFound(service: NsdServiceInfo) {
                resolve(service)
            }
        }
        listener = found
        runCatching { nsd.discoverServices(SERVICE, NsdManager.PROTOCOL_DNS_SD, found) }
    }

    fun stop() {
        val current = listener
        listener = null
        if (current != null && nsd != null) runCatching { nsd.stopServiceDiscovery(current) }
        lock?.let { if (it.isHeld) it.release() }
        lock = null
    }

    @Suppress("DEPRECATION")
    private fun resolve(service: NsdServiceInfo) {
        val manager = nsd ?: return
        runCatching {
            manager.resolveService(service, object : NsdManager.ResolveListener {
                override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}
                override fun onServiceResolved(info: NsdServiceInfo) {
                    val fromTxt = setupFrom(info)
                    if (fromTxt != null) {
                        main.post { onFound(info.serviceName ?: "Relay", fromTxt) }
                        return
                    }
                    val host = (info.host as? Inet4Address)?.hostAddress ?: return
                    pool.execute {
                        val setup = fetchLan(host, info.port) ?: return@execute
                        main.post { onFound(info.serviceName ?: "Relay", setup) }
                    }
                }
            })
        }
    }

    private fun setupFrom(info: NsdServiceInfo): RelaySetup? {
        val url = info.attributes?.get("u")?.toString(Charsets.UTF_8) ?: return null
        val token = info.attributes?.get("k")?.toString(Charsets.UTF_8) ?: return null
        val link = "wristagent://pair?u=${URLEncoder.encode(url, Charsets.UTF_8.name())}&k=${URLEncoder.encode(token, Charsets.UTF_8.name())}"
        return parseRelaySetup(link)
    }

    private fun fetchLan(host: String, port: Int): RelaySetup? {
        return runCatching {
            val conn = URL("http://$host:$port/pair/lan").openConnection() as HttpURLConnection
            conn.connectTimeout = 2000
            conn.readTimeout = 2000
            conn.inputStream.bufferedReader().use { reader ->
                val obj = Json.parse(reader.readText()) as? Json.Obj ?: return null
                parseRelaySetup("url=${obj.str("u")}\ntoken=${obj.str("k")}")
            }
        }.getOrNull()
    }

    companion object {
        const val SERVICE = "_wristagent._tcp"
    }
}
