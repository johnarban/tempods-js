import {cleanTrailingSlash, getServiceDetails, updateAttribution} from './utils';

export class ImageService {

  constructor (sourceId, map, esriServiceOptions, rasterSrcOptions) {
    if (!esriServiceOptions.url) throw new Error('A url must be supplied as part of the esriServiceOptions object.');

    esriServiceOptions.url = cleanTrailingSlash(esriServiceOptions.url);

    this._sourceId = sourceId;
    this._map = map;

    this._defaultEsriOptions = {
      format: 'jpgpng',
      dpi: 96,
      getAttributionFromService: true
    };

    this.rasterSrcOptions = rasterSrcOptions;
    this.esriServiceOptions = esriServiceOptions;
    this._createSource();

    this._serviceMetadata = null;

    try {
      if (this.options.getAttributionFromService) this.setAttributionFromService();
    } catch (error) {
      // this can fail if we have flakiness in the service
      // but it is not a critical failure, so just catch & log
      console.error(error);
    }
  }

  get options () {
    return {
      ...this._defaultEsriOptions,
      ...this.esriServiceOptions
    };
  }

  get _time () {
    if (!this.options.to) return false;
    let from = this.options.from;
    let to = this.options.to;
    if (from instanceof Date) from = from.valueOf();
    if (to instanceof Date) to = to.valueOf();

    return `${from},${to}`;
  }

  get _source () {
    const tileSize = this.rasterSrcOptions ? this.rasterSrcOptions.tileSize ? this.rasterSrcOptions.tileSize : 256 : 256;
    // These are the bare minimum parameters
    const params = new URLSearchParams({
      bboxSR: 3857,
      imageSR: 3857,
      format: this.options.format,
      size: [tileSize, tileSize],
      f: 'image'
    });

    // These are optional params
    if (this._time) params.append('time', this._time);
    if (this.options.interpolation) params.append('interpolation', this.options.interpolation);
    if (this.options.mosaicRule) params.append('mosaicRule', JSON.stringify(this.options.mosaicRule));
    if (this.options.renderingRule) params.append('renderingRule', JSON.stringify(this.options.renderingRule));
    return {
      type: 'raster',
      tiles: [
        `${this.options.url}/exportImage?bbox={bbox-epsg-3857}&${params.toString()}`
      ],
      tileSize,
      ...this.rasterSrcOptions
    };
  }

  _createSource () {
    this._map.addSource(this._sourceId, this._source);
  }

  // This requires hooking into some undocumented methods
  // this gets called once per change, and maplibre replaces the bbox with the actual bbox.
  _updateSource () {
    const src = this._map.getSource(this._sourceId);
    src.tiles[0] = this._source.tiles[0];
    src._options = this._source;
    if (src.setTiles) {
      // New MapboxGL >= 2.13.0
      src.setTiles(this._source.tiles);
    } else if (this._map.style.sourceCaches) {
      // Old MapboxGL and MaplibreGL
      this._map.style.sourceCaches[this._sourceId].clearTiles();
      this._map.style.sourceCaches[this._sourceId].update(this._map.transform);
    } else if (this._map.style._otherSourceCaches) {
      this._map.style.sourceCaches[this._sourceId].clearTiles();
      this._map.style.sourceCaches[this._sourceId].update(this._map.transform);
    }
  }

  setDate (from, to) {
    if (+this.esriServiceOptions.from === +from && +this.esriServiceOptions.to === +to) return;
    this.esriServiceOptions.from = from;
    this.esriServiceOptions.to = to;
    this._updateSource();
  }

  setRenderingRule (rule) {
    this.esriServiceOptions.renderingRule = rule;
    this._updateSource();
  }

  setMosiacRule (rule) {
    this.esriServiceOptions.mosaicRule = rule;
    this._updateSource();
  }
  
  // this breaks the backwards compatibility for when maplibre used sourceCaches
  get _tiles() {
    return this._map.style.tileManagers[this._sourceId]._inViewTiles.getAllTiles();
  }
  
  _countTileStates(tiles) {
    // available states: maplibre-gl-js/src/tiles/tiles.ts TileState = 'loading' | 'loaded' | 'reloading' | 'unloaded' | 'errored' | 'expired';
    return tiles.reduce((acc, tile) => {
      const state = tile.state;
      if (!acc[state]) acc[state] = 0;
      acc[state]++;
      return acc;
    }, {});
  }

  // Calls callback(true) when tiles for this source start loading and callback(false)
  // once they are all done (loaded or errored). Returns { on, off } to start/stop listening.
  onLoadingChange (callback) {
    let loading = false;
    // https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/ example
    const check = (e) => {
      // only check for this source
      if (e.sourceId !== this._sourceId) return;
      if (e.sourceDataType === 'metadata') return;
      const isLoading = !e.isSourceLoaded;
      // did it change?
      if (isLoading !== loading) {
        loading = isLoading;
        // then do a thing
        callback(loading);
      }
    };
    // watch source data events
    const events = ['sourcedataloading', 'sourcedata', 'sourcedataabort', 'error'];
    return {
      on: () => events.forEach(type => this._map.on(type, check)),
      off: () => events.forEach(type => this._map.off(type, check)),
    };
  }
  
  onLoadingProgress (callback) {
    // watch source data events
    const events = ['sourcedataloading', 'sourcedata', 'sourcedataabort', 'error'];
    const check = (e) => {
      // only check for this source
      if (e.sourceId !== this._sourceId) return;
      if (e.sourceDataType === 'metadata') return;
      if (e.type === 'sourcedataloading' && e.tile === undefined) return;

      const tiles = this._tiles;
      const states = this._countTileStates(tiles);
      callback(states['loaded'], states['errored'], tiles.length);
    };
    return {
      on: () => events.forEach(type => this._map.on(type, check)),
      off: () => events.forEach(type => this._map.off(type, check)),
    };
  }

  setAttributionFromService () {
    // check for the copyright text. the service 
    // may not actually have copyrightText as a key
    if (this._serviceMetadata?.copyrightText) {
      updateAttribution(this._serviceMetadata.copyrightText, this._sourceId, this._map);
    } else {
      this.getMetadata() // just get the fresh metadata from the promise instead of hoping it it synced internally
        .then((metadata) => {
          if (metadata?.copyrightText) {
            updateAttribution(metadata.copyrightText, this._sourceId, this._map);
          }
        });
    }
  }
  
  // update to better handle esri's error (it returns valid json, but not what you expect)
  getMetadata() {
    if (this._serviceMetadata !== null) return Promise.resolve(this._serviceMetadata);
    // getServiceDetails is now a Promise, we can return it directly
    return getServiceDetails(this.esriServiceOptions.url, this.esriServiceOptions.fetchOptions)
      .then((data) => {
        if (!data) {
          throw new Error(`Service metadata was falsy: ${data}`);
        }
        this._serviceMetadata = data;
        return this._serviceMetadata;
      });
  }

  identify (lnglat, returnGeometry) {
    const canvas = this._map.getCanvas();
    const bounds = this._map.getBounds().toArray();
    returnGeometry = returnGeometry ? returnGeometry : false;
    const params = new URLSearchParams({
      sr: 4326,
      geometryType: 'esriGeometryPoint',
      geometry: JSON.stringify({
        x: lnglat.lng,
        y: lnglat.lat,
        spatialReference: {
          wkid: 4326
        }
      }),
      tolerance: 3,
      returnGeometry,
      imageDisplay: `${canvas.width},${canvas.height},96`,
      mapExtent: `${bounds[0][0]},${bounds[0][1]},${bounds[1][0]},${bounds[1][1]}`,
      layers: this._layersStr,
      layerDefs: this._layerDefs,
      time: this._time,
      f: 'json'
    });

    return new Promise((resolve, reject) => {
      fetch(`${this.esriServiceOptions.url}/identify?${params.toString()}`, this.esriServiceOptions.fetchOptions)
        .then(response => response.json())
        .then(data => resolve(data))
        .catch(error => reject(error));
    });
  }
}
