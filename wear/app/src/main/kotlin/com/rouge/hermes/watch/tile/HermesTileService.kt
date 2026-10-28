package com.rouge.hermes.watch.tile

import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.DimensionBuilders
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.protolayout.TypeBuilders
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

abstract class HermesTileService : TileService() {
    protected abstract val label: String
    protected abstract val mode: String?

    override fun onTileRequest(requestParams: RequestBuilders.TileRequest): ListenableFuture<TileBuilders.Tile> {
        val activity = ActionBuilders.AndroidActivity.Builder()
            .setPackageName(packageName)
            .setClassName("com.rouge.hermes.watch.MainActivity")
            .apply {
                if (mode != null) addKeyToExtraMapping("mode", ActionBuilders.stringExtra(mode))
            }
            .build()
        val click = ModifiersBuilders.Clickable.Builder()
            .setId("open")
            .setOnClick(ActionBuilders.LaunchAction.Builder().setAndroidActivity(activity).build())
            .build()
        val text = LayoutElementBuilders.Text.Builder()
            .setText(TypeBuilders.StringProp.Builder(label).build())
            .setFontStyle(
                LayoutElementBuilders.FontStyle.Builder()
                    .setSize(DimensionBuilders.sp(20f))
                    .build(),
            )
            .setMaxLines(TypeBuilders.Int32Prop.Builder().setValue(2).build())
            .build()
        val root = LayoutElementBuilders.Box.Builder()
            .setWidth(DimensionBuilders.expand())
            .setHeight(DimensionBuilders.expand())
            .setModifiers(ModifiersBuilders.Modifiers.Builder().setClickable(click).build())
            .addContent(text)
            .build()
        val tile = TileBuilders.Tile.Builder()
            .setResourcesVersion("1")
            .setTileTimeline(TimelineBuilders.Timeline.fromLayoutElement(root))
            .build()
        return Futures.immediateFuture(tile)
    }

    override fun onTileResourcesRequest(requestParams: RequestBuilders.ResourcesRequest): ListenableFuture<ResourceBuilders.Resources> {
        return Futures.immediateFuture(ResourceBuilders.Resources.Builder().setVersion("1").build())
    }
}

class TalkTileService : HermesTileService() {
    override val label = "Hermes"
    override val mode: String? = null
}

class FoodTileService : HermesTileService() {
    override val label = "Log food"
    override val mode: String? = "food"
}
