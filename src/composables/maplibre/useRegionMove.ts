import { ref, toRef, watch, type MaybeRef, type Ref } from "vue";
import { GeoJSONSource, Map, MapMouseEvent } from "maplibre-gl";
import { v4 } from "uuid";

import type { RectangleSelectionInfo, SelectionHandler } from "../../types";
import { baseUseSelection } from "./baseUseSelection";
import { createBounds } from "./utils";

// The same width and height as info, centred on (lng, lat)
function recentre(info: RectangleSelectionInfo, lng: number, lat: number): RectangleSelectionInfo {
  const halfWidth = (info.xmax - info.xmin) / 2;
  const halfHeight = (info.ymax - info.ymin) / 2;
  return {
    xmin: lng - halfWidth,
    xmax: lng + halfWidth,
    ymin: lat - halfHeight,
    ymax: lat + halfHeight,
  };
}

// Picks a new position for an existing rectangle. While active, a dashed
// outline of the rectangle follows the mouse, and a click puts selectionInfo
// at the rectangle's new bounds. The caller does the actual moving, the same
// way the other selections leave creating the region to the caller.
export function useRegionMove(
  map: Ref<Map | null>,
  region: Ref<RectangleSelectionInfo | null>,
  interactColor: string = "yellow",
  active: MaybeRef<boolean>,
) {

  const uuid = v4();
  const activeRef = toRef(active);
  // Where the outline is now, which is where Enter puts the region
  let preview: RectangleSelectionInfo | null = null;
  

  function showPreview(info: RectangleSelectionInfo) {
    const mMap = map.value;
    if (!mMap) {
      return;
    }
    preview = info;

    const geoJson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [{
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [createBounds(info)],
        },
        properties: {},
      }],
    };

    const source = mMap.getSource(uuid) as GeoJSONSource | undefined;
    if (source) {
      source.setData(geoJson);
      return;
    }

    mMap.addSource(uuid, {
      type: "geojson",
      data: geoJson,
    });
    mMap.addLayer({
      id: uuid,
      type: "line",
      source: uuid,
      paint: {
        "line-color": interactColor,
        "line-width": 2,
        "line-dasharray": [2, 1],
      }
    });
  }

  function showPreviewAtCentre() {
    const mMap = map.value;
    if (!mMap || !region.value) {
      return;
    }
    const centre = mMap.getCenter();
    showPreview(recentre(region.value, centre.lng, centre.lat));
  }

  function removePreview() {
    preview = null;
    const mMap = map.value;
    if (!mMap) {
      return;
    }
    if (mMap.getLayer(uuid)) {
      mMap.removeLayer(uuid);
    }
    if (mMap.getSource(uuid)) {
      mMap.removeSource(uuid);
    }
  }

  const handler: SelectionHandler<MapMouseEvent, RectangleSelectionInfo> = {

    selectionInfo: ref<RectangleSelectionInfo | null>(null),

    onMousemove(event: MapMouseEvent) {
      if (region.value) {
        showPreview(recentre(region.value, event.lngLat.lng, event.lngLat.lat));
      }
    },
    
    
    // the mouse up after a click or tap
    onMouseup(event: MapMouseEvent) {
      if (region.value) {
        handler.selectionInfo.value = recentre(region.value, event.lngLat.lng, event.lngLat.lat);
      }
    },

    // Enter puts the region where the outline is: in the centre of the map
    // view, unless the mouse has since moved it
    onKeydown(event: KeyboardEvent) {
      if (preview === null || event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      handler.selectionInfo.value = preview;
    },
  };

  // The outline starts in the centre of the view and goes back there whenever
  // the map moves. baseUseSelection turns off panning and zooming with the
  // mouse while a selection is active, so the map only moves from the keyboard
  // (the arrow keys and +/-): a keyboard user moves the map under the outline,
  // then presses Enter.
  watch([activeRef, region], ([isActive, info]) => {
    const mMap = map.value;
    mMap?.off("move", showPreviewAtCentre);
    if (isActive && info) {
      showPreviewAtCentre();
      mMap?.on("move", showPreviewAtCentre);
    } else {
      removePreview();
    }
  });

  return baseUseSelection({ map, handler, active: activeRef });

}
