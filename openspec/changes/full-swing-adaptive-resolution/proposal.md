# Adaptive flat rendering under sustained load

The fixed 4K-pixel ceiling still permits severe GPU-bound slowdowns. Trial a bounded resolution reduction only after sustained slow active flat gameplay. Keep native DOM/UI sizing, camera geometry, content, controls and XR rendering unchanged. Retain a reduction only when frame intervals measurably improve; otherwise restore resolution and stop probing until resize/reload. Actual affected Chrome acceptance remains open.
