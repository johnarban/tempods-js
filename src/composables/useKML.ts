import { ref, type Ref, onBeforeUnmount } from 'vue';
import toGeoJSON from '../togeojson.js';
import { useAbortableFetch } from './useAbortableFetch';


export interface KMLResource {
  kmlUrl: Ref<string>
  geoJsonData: Ref<GeoJSON.FeatureCollection | null>
  loading: Ref<boolean>
  error: Ref<Error | null>
  setUrl: (newUrl: string) => Promise<void>
  loadKML: () => Promise<unknown>
  cleanUp: () => void
}

// https://developer.mozilla.org/en-US/docs/Web/API/DOMParser/parseFromString#error_handling
function parseXML(xmlString: string): Document | null {
  const parser = new DOMParser();

  const doc = parser.parseFromString(xmlString, "application/xml");
  const errorNode = doc.querySelector("parsererror");
  if (errorNode) {
    return null;
  } else {
    return doc;
  }
}

export function useKML(url: string): KMLResource {
  const { loading, error, abortController, abortableFetch, abort } = useAbortableFetch();
  const kmlUrl = ref(url);
  const geoJsonData = ref<GeoJSON.FeatureCollection | null>(null);

  // Convert KML to GeoJSON
  const _convertKmlToGeoJson = (kmlContent: string): GeoJSON.FeatureCollection => {
    
    const kmlDoc = parseXML(kmlContent);
    if (!kmlDoc) {
      throw new Error('Invalid KML format');
    }
    // Convert using local togeojson library
    const geoJson = toGeoJSON.kml(kmlDoc, { styles: true }) as GeoJSON.FeatureCollection;
    
    // Debug: Log the parsed GeoJSON structure
    console.log('=== KML PARSING DEBUG ===');
    console.log('URL:', kmlUrl.value);
    console.log('Total features:', geoJson.features.length);
    console.log('First few features with properties:', geoJson.features.slice(0, 3).map(f => ({
      geometry: f.geometry,
      properties: f.properties
    })));

    
    return geoJson;
      
  };


  // Load KML from URL
  async function loadKML() {
    
    const requestedUrl = kmlUrl.value;
    console.log('Starting KML load for URL:', requestedUrl);

    // Abort any in-flight request
    if (abortController.value) {
      console.log('useKML: Aborting previous fetch due to new request', abortController.value);
      abort('Aborting previous KML fetch due to new request');
    }
    

    console.log('Loading KML from:', requestedUrl);
    return abortableFetch(requestedUrl).then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
      
    })
      .then((response) => response.text())
      .then((kmlContent) => {
        console.log('KML fetched successfully, size:', kmlContent.length);
        
        // short-circuit lengthy processing if URL changed
        if (requestedUrl !== kmlUrl.value) {
          console.warn('KML URL changed during fetch, ignoring this result');
          return;
        }
        
        // convert Kml to GeoJSON and save to ref
        const geoJson = _convertKmlToGeoJson(kmlContent);
        if (requestedUrl !== kmlUrl.value) {
          console.warn('KML URL changed during KML parsing, ignoring this result');
          return;
        }
        if (geoJson) {
          geoJsonData.value = geoJson;
          console.log('KML loaded successfully:', geoJson.features.length, 'features');
        }
        
        return kmlContent;
      })
      .catch((err) => {
        // only error if not abort
        if (err.name === 'AbortError') {
          console.warn('KML fetch aborted:', err.message);
        } else {
          console.error('Error fetching KML:', err);
        }
      });
    
  }


  // Change URL and refresh layer
  async function setUrl(newUrl: string) {
    const next = (newUrl || '').trim();
    // right now lets avoid loops.
    if (next !== kmlUrl.value) {
      console.log('KML URL changing from', kmlUrl.value, 'to', next);
      kmlUrl.value = next;
    } // avoid loops

    // Abort any in-flight fetch before switching
    if (abortController.value) {
      console.log('useKML: Aborting previous fetch due to URL change');
      abort('Aborting previous KML fetch due to URL change');
    }
    
    console.log('useKML: reset data and error state');
    geoJsonData.value = null;
    error.value = null;
  }

  // Watch for URL changes to auto-reload (will be idempotent due to early return)
  // watch(kmlUrl, (newUrl) => {
  //   console.log('KML URL changed, reloading:', kmlUrl.value);
  //   setUrl(newUrl);
  // });

  // Remove from map
  function cleanUp() {
    // Abort any in-flight fetch
    if (abortController.value) {
      abort('Aborting KML fetch due to layer removal');
    }
  }
  
  onBeforeUnmount(() => {
    cleanUp();
  });
  return {
    geoJsonData,
    loadKML,
    loading,
    error,
    kmlUrl,
    setUrl,
    cleanUp,
  };
}