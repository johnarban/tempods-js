
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/naming-convention */
import { useEsriImageServiceLayer } from "@/composables/useEsriMapLayer";
import { type MaybeRef } from 'vue';


// https://www.arcgis.com/home/item.html?id=cfcb7609de5f478eb7666240902d4d3d

// Esri Image Service URL for GPWv4 Population Density
// const url = ;

const configs = {
  adg : {
    url: `https://gis.earthdata.nasa.gov/image/rest/services/GESDISC/PACE_OCI_L3M_IOP_ADG_442/ImageServer`,
    // rr: {"rasterFunction": "ADG_442_scaled"},
    rr: {"rasterFunctionArguments":{"colorRamp":{"type":"multipart","colorRamps":[{"type":"algorithmic","algorithm":"esriHSVAlgorithm","fromColor":[39,32,122,255],"toColor":[74,80,181,255]},{"type":"algorithmic","algorithm":"esriHSVAlgorithm","fromColor":[74,80,181,255],"toColor":[255,255,191,255]},{"type":"algorithmic","algorithm":"esriHSVAlgorithm","fromColor":[255,255,191,255],"toColor":[240,149,12,255]},{"type":"algorithmic","algorithm":"esriHSVAlgorithm","fromColor":[240,149,12,255],"toColor":[135,38,38,255]}]},"Raster":{"rasterFunctionArguments":{"StretchType":3,"Statistics":[[0,5,0,1]],"DRA":false,"UseGamma":true,"Gamma":[5.35],"ComputeGamma":false,"Min":0,"Max":255,"NumberOfStandardDeviations":2,"Raster":{"rasterFunctionArguments":{"BandIds":[0],"Raster":{"rasterFunction":"ADG_442_scaled"}},"rasterFunction":"ExtractBand"}},"rasterFunction":"Stretch","outputPixelType":"U8","variableName":"Raster"}},"rasterFunction":"Colormap","variableName":"Raster"},
    var: 'adg_442'
  },
  chlor : {
    url: `https://gis.earthdata.nasa.gov/image/rest/services/GESDISC/PACE_OCI_L3M_CHL/ImageServer`,
    // rr: {"rasterFunction": "chlor_a"},
    // rr: {"rasterFunctionArguments":{"colorRamp":{"type":"multipart","colorRamps":[{"type":"algorithmic","algorithm":"esriHSVAlgorithm","fromColor":[12,16,120,255],"toColor":[26,147,171,255]},{"type":"algorithmic","algorithm":"esriHSVAlgorithm","fromColor":[26,147,171,255],"toColor":[56,224,9,255]},{"type":"algorithmic","algorithm":"esriHSVAlgorithm","fromColor":[56,224,9,255],"toColor":[255,255,128,255]}]},"Raster":{"rasterFunctionArguments":{"StretchType":3,"Statistics":[[0,20,5,10]],"DRA":false,"UseGamma":true,"Gamma":[3.39],"ComputeGamma":false,"Min":0,"Max":255,"NumberOfStandardDeviations":2},"rasterFunction":"Stretch","outputPixelType":"U8","variableName":"Raster"}},"rasterFunction":"Colormap","variableName":"Raster"},
    rr: {"rasterFunctionArguments":{"colorRamp":{"type":"multipart","colorRamps":[{"type":"algorithmic","algorithm":"esriHSVAlgorithm","fromColor":[12,16,120,255],"toColor":[26,147,171,255]},{"type":"algorithmic","algorithm":"esriHSVAlgorithm","fromColor":[26,147,171,255],"toColor":[56,224,9,255]},{"type":"algorithmic","algorithm":"esriHSVAlgorithm","fromColor":[56,224,9,255],"toColor":[255,255,128,255]}]},"Raster":{"rasterFunctionArguments":{"StretchType":5,"Statistics":[[0.1,20,5,10]],"DRA":false,"UseGamma":true,"Gamma":[6.00],"ComputeGamma":false,"Min":0,"Max":255},"rasterFunction":"Stretch","outputPixelType":"U8","variableName":"Raster"}},"rasterFunction":"Colormap","variableName":"Raster"},
    var: 'chlor_a'
  },
  ndvi : {
    url: `https://gis.earthdata.nasa.gov/image/rest/services/GESDISC/PACE_OCI_L3M_LANDVI/ImageServer`,
    rr: {"rasterFunction": "ndvi"},
    var: 'ndvi'
  },
  aod : {
    url: `https://gis.earthdata.nasa.gov/image/rest/services/GESDISC/PACE_OCI_L3M_AOD/ImageServer`,
    rr: {"rasterFunction": "Aerosol_Optical_Depth_550"},
    var: 'Aerosol_Optical_Depth_550'
  },
  avw : {
    url: `https://gis.earthdata.nasa.gov/image/rest/services/GESDISC/PACE_OCI_L3M_AVW/ImageServer`,
    rr: {"rasterFunctionArguments":{"colorRamp":{"type":"multipart","colorRamps":[{"type":"algorithmic","fromColor":[0,0,255,255],"toColor":[0,255,255,255],"algorithm":"esriCIELabAlgorithm"},{"type":"algorithmic","fromColor":[0,255,255,255],"toColor":[255,255,0,255],"algorithm":"esriCIELabAlgorithm"},{"type":"algorithmic","fromColor":[255,255,0,255],"toColor":[255,0,0,255],"algorithm":"esriCIELabAlgorithm"}]},"Raster":{"rasterFunctionArguments":{"StretchType":5,"Statistics":[[440,600,0,1]],"DRA":false,"UseGamma":false,"Gamma":[1],"ComputeGamma":false,"Min":0,"Max":255},"rasterFunction":"Stretch","outputPixelType":"U8","variableName":"Raster"}},"rasterFunction":"Colormap","variableName":"Raster"},
    var: 'avw'
  },
} as const;

const whichConfig: keyof typeof configs = 'avw';





export function addPaceLayer(which: keyof typeof configs, label, timestamp: MaybeRef<number | null>) {
  const url = configs[which].url;

  const layerOptions = {};
  layerOptions['visible'] = false;
  layerOptions['clickValue'] = true;
  layerOptions['renderingRule']  = configs[which].rr;
  layerOptions['exportImageOptions'] = {
    "format": "jpgpng" // to get transparency
  };
  const popLayer = useEsriImageServiceLayer(
    url,
    label,
    1,
    configs[which].var,
    timestamp,
    layerOptions,
  );
  return popLayer;
}
