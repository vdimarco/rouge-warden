package com.rouge.hermes.phone

import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.util.zip.ZipInputStream

object ModelStore {
    const val URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"

    fun root(files: File): File = File(files, "vosk")

    fun modelDir(files: File): File? {
        val root = root(files)
        if (File(root, "conf").isDirectory) return root
        return root.listFiles()?.firstOrNull { it.isDirectory && File(it, "conf").isDirectory }
    }

    fun ready(files: File): Boolean = modelDir(files) != null

    fun download(files: File, client: OkHttpClient = OkHttpClient()) {
        val root = root(files)
        root.mkdirs()
        val zip = File(root, "model.zip")
        val request = Request.Builder().url(URL).build()
        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) error("Model download answered ${response.code}")
            val body = response.body ?: error("Model download was empty")
            body.byteStream().use { input -> FileOutputStream(zip).use { output -> input.copyTo(output) } }
        }
        unzip(zip, root)
        zip.delete()
        if (!ready(files)) error("Model archive had no conf directory")
    }

    fun unzip(zip: File, dest: File) {
        val root = dest.canonicalFile
        ZipInputStream(zip.inputStream()).use { archive ->
            while (true) {
                val entry = archive.nextEntry ?: break
                val out = File(dest, entry.name).canonicalFile
                if (out != root && !out.path.startsWith(root.path + File.separator)) error("zip entry")
                if (entry.isDirectory) {
                    out.mkdirs()
                } else {
                    out.parentFile?.mkdirs()
                    FileOutputStream(out).use { archive.copyTo(it) }
                }
                archive.closeEntry()
            }
        }
    }
}
