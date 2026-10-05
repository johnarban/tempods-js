import { onMounted, onUnmounted, toRef, watch } from "vue";
import { Map, MapMouseEvent } from "maplibre-gl";

import { UseSelectionOptions } from "../../types";

export function baseUseSelection<SelectionInfo>(
  options: UseSelectionOptions<Map, MapMouseEvent, SelectionInfo>,
) {

  const { map, handler } = options;
  const active = toRef(options.active ?? false);

  onMounted(() => {
    const mMap = map.value;
    if (active.value && mMap) {
      updateListeners(mMap, active.value);
    }
  });

  // Escape is the way out of selection mode for someone who armed it from the
  // keyboard: the only other exit is the Cancel button, which means Tabbing
  // back off the map to find it.
  function onCanvasKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      active.value = false;
      return;
    }
    handler.onKeydown?.(event);
  }

  function updateListeners(map: Map, active: boolean) {
    if (active) {
      map.dragPan.disable();
      map.scrollZoom.disable();
      if (handler.onMousedown) {
        map.on("mousedown", handler.onMousedown);
      }
      if (handler.onMouseup) {
        map.on("mouseup", handler.onMouseup);
      }
      if (handler.onMousemove) {
        map.on("mousemove", handler.onMousemove);
      }
      map.getCanvas().addEventListener("keydown", onCanvasKeydown);
    } else {
      map.dragPan.enable();
      map.scrollZoom.enable();
      if (handler.onMousedown) {
        map.off("mousedown", handler.onMousedown);
      }
      if (handler.onMouseup) {
        map.off("mouseup", handler.onMouseup);
      }
      if (handler.onMousemove) {
        map.off("mousemove", handler.onMousemove);
      }
      map.getCanvas().removeEventListener("keydown", onCanvasKeydown);
    }
  }

  watch(active, (nowActive: boolean) => {
    const mMap = map.value;
    if (mMap !== null) {
      updateListeners(mMap, nowActive);
      mMap.getCanvas().style.cursor = nowActive ? 'crosshair' : '';
      // Arming selection used to leave focus on the button that armed it, so a
      // keyboard user got a crosshair cursor on a map they were not on and no
      // hint that the map was where to go next. Handing focus to the canvas
      // also puts them where the keys below are listening. MapLibre's own
      // keyboard panning and zooming stay enabled in selection mode, so the
      // arrow keys and +/- work from here.
      if (nowActive) {
        mMap.getCanvas().focus();
      }
    }
  });

  // If we're going to take in the map as a ref,
  // we might as well update if its value does
  watch(map, (newMap: Map | null) => {
    if (newMap !== null) {
      updateListeners(newMap, active.value);
    }
  });

  onUnmounted(() => {
    // The map will probably be destroyed along with the component using this composable
    // But if not, we should remove handlers
    const mMap = map.value;
    if (mMap !== null && active.value) {
      updateListeners(mMap, false);
    }
  });

  return {
    active,
    selectionInfo: handler.selectionInfo,
  };

}
