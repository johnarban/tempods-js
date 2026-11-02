<template>
  <cds-dialog title="Credits" v-model="showCredits" :color="accentColor2" width="50%" max-width="600px">
    <div class="team-credits">
      <p>This app was created by the Cosmic Data Stories team in partnership with the Smithsonian BEST AQI Program. </p>
      <div class="team cosmic-data-stories">
        <h2>Cosmic Data Stories</h2>
        <a href="https://cosmicds.cfa.harvard.edu" target="_blank">cosmicds.cfa.harvard.edu</a>
        <span class="affiliation">Center for Astrophysics | Harvard &amp; Smithsonian</span>
        <div class="person">
         <span class="name">John Lewis</span>
         <span class="role">Educator/Developer</span>
         <span class="affiliation">Center for Astrophysics | Harvard &amp; Smithsonian</span>
        </div>
        <div class="person">
          <span class="name">Pat Udomprasert</span>
          <span class="role">Science-PI</span>
          <span class="affiliation">Center for Astrophysics | Harvard &amp; Smithsonian</span>
        </div>
        <div class="person">
          <span class="name">Jon Carifio</span>
          <span class="role">Developer</span>
          <span class="affiliation">Center for Astrophysics | Harvard &amp; Smithsonian</span>
        </div>
        <div class="person">
          <span class="name">Alyssa Goodman</span>
          <span class="role">PI</span>
          <span class="affiliation">Center for Astrophysics | Harvard &amp; Smithsonian</span>
        </div>
        <div class="funding-acknowledgement">
          The material contained on this website is based upon work supported by NASA under award No. 80NSSC21M0002.
        </div>
      </div>
      <div class="team best-aqi">
        <h2>BEST AQI</h2>
        <a href="https://bestaqi.sites.cfa.harvard.edu/" target="_blank">bestaqi.sites.cfa.harvard.edu/</a>
        <span class="affiliation">Smithsonian Astrophysical Observatory</span>
        <div class="person">
          <span class="name">Erika Wright</span>
          <span class="role">PI</span>
          <span class="affiliation">Smithsonian Astrophysical Observatory</span>
        </div>
        <div class="funding-acknowledgement">
          BEST AQI is supported by the Smithsonian Institution’s Together We Thrive initiative and funded in part by the Jeff Bezos gift to the National Air and Space Museum.
        </div>
      </div>
      <div class="team">
        <h2>Data Credits</h2>
        <p>
          The TEMPO data displayed in this app has been provided by the 
          TEMPO Science Team (<a href="https://tempo.si.edu/" target="_blank">tempo.si.edu</a>), led by PI Xiong Liu,
          and NASA Earthdata GIS (<a href="https://gis.earthdata.nasa.gov/" target="_blank">gis.earthdata.nasa.gov</a>)
          with assistance from Georgina Hayes-Crepps (NASA Atmospheric Science Data Center) and her team.</p>
        
        <p><i>Individual data citations can be found in the <v-icon>mdi-information-outline</v-icon> button connected to each layer</i>.</p>
        <!-- <div v-for="(layer, key) in layerInfo" :key="key" class="layer">
          <h3 v-html="layer.title"></h3>
          <p v-html="layer.source"></p>
          <p v-html="layer.da"></p>
        </div> -->
      </div>
    </div>
  </cds-dialog>
      
</template>

<script setup lang="ts">
import { storeToRefs } from "pinia";

import { useTempoStore } from "@/stores/app";
const store = useTempoStore();
const {
  accentColor2,
} = storeToRefs(store);


const showCredits = defineModel<boolean>({default: false});



</script>

<style lang="less">


.credits-cds-dialog {
  font-size: 0.8em;

  h2 {
      display: inline-block;
      font-size: 1em;
      margin-right: 1em;
    }
  
  .funding-acknowledgement {
    font-size: 0.8em;
    font-style: italic;
    margin-top: 0.5em;
  }
  
  .team-credits {
    .team {
      margin-block: 1em;
      border: 1px solid #ffcc335a;
      border-radius: 5px;
      padding: 1em;
      
      > .affiliation {
      display: block;
      font-size: 0.9em;
      font-style: italic;
    }
    }
    
    .person {
      margin-block: 0.5em;
      padding-left: 1em;
      font-size: 0.9em;
      display: flex;
      flex-direction: row;
    }
    .person.pi {
      font-weight: bold;
    }
    // .person > .name::after {
    //   content: " - "; 
    // }
    // .person > .role::after {
    //   content: ","; 
    // }
    .person > .role::before {
      content: "(";
    }
    .person > .role::after {
      content: ")";
    }
    
    .person > .affiliation {
      display: none;
    }
    
    span {
      margin-right: 0.5em;
    }
    
  }
  
  .data-credits {
    font-size: 0.9em;
  }
}
</style>