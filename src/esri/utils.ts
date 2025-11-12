import { extractTimeSteps, fetchEsriTimeSteps, VariableNames } from "./ImageLayerConfig";

export const ESRI_URLS = {
  'no2': {
    url: "https://gis.earthdata.nasa.gov/image/rest/services/C2930763263-LARC_CLOUD/TEMPO_NO2_L3_V03_HOURLY_TROPOSPHERIC_VERTICAL_COLUMN/ImageServer",
    variable: "NO2_Troposphere",
  },
  // 'no2Monthly': {
  //   url: "https://gis.earthdata.nasa.gov/gp/rest/services/Hosted/TEMPO_NO2_L3_V03_Monthly_Mean/ImageServer",
  //   variable: "NO2_Troposphere",
  // },
  // 'no2DailyMax' : {
  //   url: "https://gis.earthdata.nasa.gov/gp/rest/services/Hosted/TEMPO_NO2_L3_V03_Daily_Maximum/ImageServer",
  //   variable: "NO2_Troposphere",
  // },
  'o3': {
    url: "https://gis.earthdata.nasa.gov/image/rest/services/C2930764281-LARC_CLOUD/TEMPO_O3TOT_L3_V03_HOURLY_OZONE_COLUMN_AMOUNT/ImageServer",
    variable: "Ozone_Column_Amount",
  },
  'hcho': {
    url: "https://gis.earthdata.nasa.gov/image/rest/services/C2930761273-LARC_CLOUD/TEMPO_HCHO_L3_V03_HOURLY_VERTICAL_COLUMN/ImageServer",
    variable: "HCHO",
  },
  // 'hchoMonthly': {
  //   url: "https://gis.earthdata.nasa.gov/gp/rest/services/Hosted/TEMPO_HCHO_L3_V03_Monthly_Mean/ImageServer",
  //   variable: "HCHO",
  // },
  // 'hchoDailyMax': {
  //   url: "https://gis.earthdata.nasa.gov/gp/rest/services/Hosted/TEMPO_HCHO_L3_V03_Daily_Maximum/ImageServer",
  //   variable: "HCHO",
  // },
} as const as Record<string, { url: string; variable: VariableNames }>;


export const MOLECULE_OPTIONS = [
  { title: 'NO₂', value: 'no2' },
  // { title: 'Monthly Mean NO₂', value: 'no2Monthly' },
  // { title: 'Daily Max NO₂', value: 'no2DailyMax' },
  { title: 'O₃', value: 'o3' },
  { title: 'HCHO', value: 'hcho' },
  // { title: 'Monthly Mean HCHO', value: 'hchoMonthly' },
  // { title: 'Daily Max HCHO', value: 'hchoDailyMax' },
] as const;

export type MoleculeType = keyof typeof ESRI_URLS;

export function moleculeName(molecule: MoleculeType): string {
  return MOLECULE_OPTIONS.find(m => m.value == molecule)?.title ?? "";
}

export async function getEsriTimesteps(url: string, variable: VariableNames): Promise<number[]> {
  return fetchEsriTimeSteps(url, variable).then(extractTimeSteps);
}
