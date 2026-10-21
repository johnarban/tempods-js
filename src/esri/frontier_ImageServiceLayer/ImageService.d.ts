/* eslint-disable @typescript-eslint/no-explicit-any */
import M from "maplibre-gl";


export declare class ImageService {
  constructor(sourceId: string, map: M.Map, esriServiceOptions: object, rasterSrcOptions: object);
  get options(): any;
  get _time(): string | false;
  get _source(): any;
  _createSource(): void;
  _updateSource(): void;
  setDate(from: Date, to: Date): void;
  setRenderingRule(rule: object): void;
  setMosiacRule(rule: object): void;
  _countTileStates(tiles: any[]): Record<string, number>;
  onLoadingChange(callback: (loading: boolean) => void): { on: () => void; off: () => void };
  onLoadingProgress(callback: (loaded: number, errored: number, total: number) => void): { on: () => void; off: () => void };
  setAttributionFromService(): void;
  getMetadata(): Promise<any>;
  identify(lnglat: any, returnGeometry: any): Promise<unknown>;
  esriServiceOptions: any;
  rasterSrcOptions: any;
  _map: M.Map;
}