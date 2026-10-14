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

  function showPreview(info: RectangleSelectionInfo) {
    const mMap = map.value;
    if (!mMap) {
      return;
    }

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

  function removePreview() {
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

    onMouseup(event: MapMouseEvent) {
      if (region.value) {
        handler.selectionInfo.value = recentre(region.value, event.lngLat.lng, event.lngLat.lat);
      }
    },

    // As with drawing a rectangle, Enter uses the map view: the region moves
    // to the centre of what is on screen.
    onKeydown(event: KeyboardEvent) {
      const mMap = map.value;
      if (!mMap || !region.value || event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      const centre = mMap.getCenter();
      handler.selectionInfo.value = recentre(region.value, centre.lng, centre.lat);
    },
  };

  // Start the outline on the region where it is now, so there is something to
  // see before the mouse reaches the map
  watch([activeRef, region], ([isActive, info]) => {
    if (isActive && info) {
      showPreview(info);
    } else {
      removePreview();
    }
  });

  return baseUseSelection({ map, handler, active: activeRef });

}
