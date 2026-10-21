package com.rouge.hermes.relay

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.rouge.hermes.protocol.RelaySetup
import com.rouge.hermes.protocol.parseRelaySetup

class RelayStore(context: Context) {
    private val app = context.applicationContext
    private val prefs by lazy {
        val master = MasterKey.Builder(app)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            app,
            "hermes_relay",
            master,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    fun save(url: String, token: String) {
        val setup = parseRelaySetup("url=$url\ntoken=$token") ?: return
        prefs.edit().putString("url", setup.url).putString("token", setup.token).apply()
    }

    fun save(raw: String) {
        val setup = parseRelaySetup(raw) ?: return
        prefs.edit().putString("url", setup.url).putString("token", setup.token).apply()
    }

    fun read(): RelaySetup? {
        val url = prefs.getString("url", null) ?: return null
        val token = prefs.getString("token", null) ?: return null
        return parseRelaySetup("url=$url\ntoken=$token")
    }

    fun agent(): String {
        val id = prefs.getString("agent", "hermes") ?: "hermes"
        return if (id == "pi" || id == "openai") id else "hermes"
    }

    fun setAgent(id: String) {
        if (id != "hermes" && id != "pi" && id != "openai") return
        prefs.edit().putString("agent", id).apply()
    }

    fun clear() {
        prefs.edit().clear().apply()
    }
}

class RelayKeyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION) return
        val url = intent.getStringExtra("url") ?: return
        val token = intent.getStringExtra("token") ?: return
        RelayStore(context).save(url, token)
    }

    companion object {
        const val ACTION = "com.rouge.hermes.SET_RELAY"
    }
}
