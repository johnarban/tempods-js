<template>
<v-app
  id="app"
  :style="cssVars"
>
  <v-overlay
    :model-value="inIntro"
    :style="cssVars"
    id="intro-background"
  >

      <v-dialog 
        v-model="inIntro"
        >
        <div v-if="inIntro" id="introduction-overlay" class="elevation-10 gradient-background">
          <v-window v-model="introSlide">
            <template v-slot:additional>
              <div id="intro-window-close-button">
              <font-awesome-icon
                size="xl"
                class="ma-3"
                color="#b3d5e6"
                icon='square-xmark'
                @click="inIntro = !inIntro"
                @keyup.enter="inIntro = !inIntro"
                tabindex="0"
                tooltip-location="start"
              /> 
            </div>
            </template>

            <v-window-item :value="1"
              id="splash-screen"
            >
              <div
                id="first-splash-row"
              >
                <div id="splash-screen-text">
                  What Is in the Air You Breathe?
                </div>
                <div>
                  Explore daily pollution maps over North America and find out.
                </div>
              </div>

              <div>
                <v-btn
                  class="splash-get-started"
                  @click="introSlide++"
                  @keyup.enter="introSlide++"
                  :color="accentColor"
                  :density="display.smAndDown ? 'compact' : 'default'"
                  size="x-large"
                  variant="elevated"
                  rounded="lg"
                >
                  Get Started
                </v-btn>
              </div>
            
              <div id="splash-screen-acknowledgements">
                Brought to you by <a href="https://www.cosmicds.cfa.harvard.edu/" target="_blank" rel="noopener noreferrer">Cosmic Data Stories</a>.
                
                <div id="splash-screen-logos">
                  <a href="https://www.si.edu/" target="_blank" rel="noopener noreferrer"
                  ><img alt="Smithsonian Logo" src="220px-Smithsonian_sun_logo_no_text.svg.png"></a>
                  <credit-logos/>
                </div>
              </div>
            </v-window-item>
            
            <v-window-item :value="2">
              <div class="intro-text">
                <p class="mb-5">
                  The TEMPO satellite mission (Tropospheric Emissions: Monitoring Pollution), launched in April 2023, is the first space-based instrument to measure major air pollutants across the North American continent every daylight hour at high spatial resolution. A collaboration between NASA and the Smithsonian Astrophysical Observatory, the TEMPO instrument gathers hourly daytime scans of the atmosphere over North America from the Atlantic Ocean to the Pacific Coast and from the Yucatán Peninsula to central Canada.
                </p>
              </div>
            </v-window-item>
            
            <v-window-item :value="3">
              <div class="intro-text mb-3">
                <p class="mb-3">
                  This Data Story provides an introduction to what can be learned from TEMPO's data, which became publicly available May 20, 2024. The map here visualizes hourly Nitrogen Dioxide (NO<sub>2</sub>) data over time. NO<sub>2</sub> can be produced by:
                </p> 
                <ul>
                  <li>Burning of fossil fuels&#8212;for example from vehicles, power plants, manufacturing sites, and oil refineries</li>
                  <li>Fires and biomass burning&#8212;including wildfires and prescribed burns, as well as burning of vegetation for land clearing</li>
                  <li>Bacteria, which naturally convert nitrogen in soil into compounds that can form NO<sub>2</sub>. Agricultural use of nitrogen-based fertilizers increases the amount of NO<sub>2</sub> produced by these bacteria.</li>
                  <li>Lightning, which triggers a chemical reaction that turns harmless N<sub>2</sub> in the atmosphere into NO<sub>2</sub>.
</li>
                </ul>
                <p class="mt-3">
                For each date, you can see the scans beginning on the East Coast in the morning, and ending on the West Coast as the Sun sets.
                </p> 
              </div>
            </v-window-item>
            <v-window-item :value="4">
              <div class="intro-text mb-3">      
                <p class="mb-3">
                  In this interactive page you can:
                </p>
                <ul>
                  <li>
                    Use the search box to navigate a location of your choice.
                  </li>
                  <li>
                    Select a date and press the "Play" button or scroll the time slider to view the changing concentrations of NO<sub>2</sub> on those dates. 
                  </li>
                  <li>
                    Click <v-icon style="color: #ffcc33">mdi-share-variant</v-icon> to share your selected location, date, and time with others.
                  </li>
                  <li v-bind:style="cssVars">
                    Press the <v-icon style="font-size: 1.3em; color: var(--accent-color)" elevation="1">mdi-information-variant-circle-outline</v-icon> button next to each Notable Date to get an overview of what to look for on that date
                  </li>
                  <li>
                    For each Notable Date, select one of two zoomed-in Locations to investigate specific pollution events.
                  </li>
                  <li>
                    You can use the "Timezone" setting to investigate how pollution evolves over the day in different parts of the country, for example as rush hour progresses in large cities.
                  </li>
                </ul>
                <!-- add do not show introduction again button -->
                <v-checkbox
                  v-model="dontShowIntro"
                  @keyup.enter="dontShowIntro = !dontShowIntro"
                  label="Don't show this introduction at launch"
                  color="#c10124"
                  hide-details
                />
              </div>
            </v-window-item>
          </v-window>

          <div id="intro-bottom-controls">
            <div>
              <v-btn
                v-if="(introSlide > 1)"
                id="intro-next-button"
                :color="accentColor"
                @click="introSlide--"
                @keyup.enter="introSlide--"
                elevation="0"
                >
                Back
              </v-btn>
              <v-btn
                @click="showAggregationDialog = true"
                color="secondary"
                variant="outlined"
                size="small"
                :disabled="!currentUserSelection?.region"
              >
                <v-icon class="mr-1">mdi-chart-timeline-variant</v-icon>
                Advanced Aggregation
              </v-btn>
            </div>
            
            <v-btn
              v-if="(introSlide > 1)"
              id="intro-next-button"
              :color="accentColor"
              @click="introSlide++"
              @keyup.enter="introSlide++"
              elevation="0"
              >
              {{ introSlide < 4 ? 'Next' : 'Get Started' }}
            </v-btn>
          </div>
        </div>
      </v-dialog>
    </v-overlay>
  <div
    id="main-content"
  > 
    <div class="content-with-sidebars">
      <!-- tempo logo -->
      <div id="logo-title">
      <a href="https://tempo.si.edu" target="_blank" rel="noopener noreferrer" >
        <img 
          src="./assets/TEMPO-Logo-Small.png"
          alt="TEMPO Logo"
          style="width: 100px; height: 100px;"
        >
      </a>

      <h1 id="title">What is in the Air You Breathe?</h1>
      <!-- <cds-dialog
        title="Time Series"
        v-model="samplesGraph"
        :color="accentColor2"
        draggable
        :scrim="false"
        :drag-predicate="(element: HTMLElement) => element.closest('.plotly') == null"
      >
        <timeseries-graph
          v-if="userSelections.length > 0"
          :data="userSelections"
        />
      </cds-dialog> -->

      <!-- </div> -->
      <cds-dialog title="What's new" v-model="showChanges" :color="accentColor2">
        <ul class="snackbar-alert-ul">
          <li class="change-item mb-5" v-for="change in changes" :key="change.date" :data-date="change.date">
            <span :style='{"font-weight":"bold", "color": `${change.highlight ? "var(--smithsonian-yellow)" : "currentColor"}` }'>{{ change.date }}</span><br> <span v-html="change.html">  </span>{{ change.text }}
          </li>
        </ul>
        <!-- <template v-slot:activator="{ onClick, id }">
          <v-btn :id="id" @click="onClick" color="primary">
            Custom Activator
          </v-btn>
        </template>  -->
      </cds-dialog>

      <div id="menu-area">
        <v-btn 
          v-if="(new Date('2025-05-7 00:00:00') > new Date())"
          class='whats-new-button pulse' 
          aria-label="What's new" 
          @click="showChanges = true" 
          @keyup.enter="showChanges = true" 
          variant="outlined" 
          rounded="lg" 
          :color="accentColor2" 
          elevation="0"
          size="lg"
          >
          <v-tooltip location="bottom" activator="parent" :disabled="mobile" text="What's new"></v-tooltip>
          <v-icon>mdi-creation</v-icon>
        </v-btn>
        <share-button
            :source="currentUrl"
            buttonColor="black"
            :iconColor="accentColor2"
            elevation="0"
            size="small"
            rounded="1"
            :tooltip-disabled="mobile"
            @click="shareButtonClickedCount += 1"
            alert
          />
        <v-btn aria-role="menu" aria-label="Show menu" class="menu-button" variant="outlined" rounded="lg" :color="accentColor2" elevation="5">
          <v-icon size="x-large">mdi-menu</v-icon>
          <v-menu
            activator="parent"
            >
            <v-list>
              <v-list-item 
                tabindex="0"
                aria-label="See recent changes"
                @click="showChanges = true"
                @keyup.enter="showChanges = true"
                >
                What's New
              </v-list-item>

              <v-list-item 
                tabindex="0" 
                aria-label="Show introduction"
                @click="() => {introSlide = 1; inIntro = true;}"
                @keyup.enter="() => {introSlide = 1; inIntro = true;}"
                >
                  Introduction
              </v-list-item>
              
              <v-list-item 
                tabindex="0"
                aria-label="Show user guide"
                @click="() => {introSlide = 4; inIntro = true;}"
                @keyup.enter="() => {introSlide = 4; inIntro = true;}"
                >
                User Guide
              </v-list-item>
              
              <v-list-item 
                tabindex="0"
                aria-label="Show dialog telling about the data"
                @click="showAboutData = true"
                @keyup.enter="showAboutData = true"
                >
                About the Data
              </v-list-item>
              
              <v-list-item 
                
                aria-label="Leave Page to Educator Resources"
                >
                <a style="font-weight: normal;" tabindex="0"  href="https://www.cosmicds.cfa.harvard.edu/resources/tempo" target="_blank" rel="noopener">Educator Resources<v-icon>mdi-open-in-new</v-icon></a>
              </v-list-item>
              
              <v-list-item 
                tabindex="0" 
                aria-label="Show credits"
                @click="showCredits = true"
                @keyup.enter="showCredits = true"
                >
                  Credits
              </v-list-item>
              
            </v-list>
          </v-menu>
        </v-btn>
      </div>
    </div>
    <div id="where" class="big-label">where</div>
      <div id="map-container">
        <map-colorbar-wrap
          :horizontal="display.width.value <= 750"
          :current-colormap="currentColormap"
          :color-map="colorMap"
          :start-value="colorbarOptions[whichMolecule].stretch[0] / colorbarOptions[whichMolecule].cbarScale"
          :end-value="colorbarOptions[whichMolecule].stretch[1] / colorbarOptions[whichMolecule].cbarScale"
          :molecule-label="colorbarOptions[whichMolecule].label"
          :cbar-scale="colorbarOptions[whichMolecule].cbarScale"
        >
          <v-card id="map-contents" style="width:100%; height: 100%;">
            <v-toolbar
              density="compact"
              color="var(--info-background)"
            >
              <v-toolbar-title :text="`TEMPO Data Viewer: ${mapTitle}`"></v-toolbar-title>
              <v-spacer></v-spacer>
              <!-- swtichf ro preview points -->
               <v-switch
                v-if="regions.length > 0"
                v-model="showSamplingPreviewMarkers"
                :label="showSamplingPreviewMarkers ? 'Showing Sample Markers' : 'Hide Sample Markers'"
              ></v-switch>
            </v-toolbar>
          </v-card>
        </map-colorbar-wrap>
      </div>
    </div>
  </div>

  <!-- Advanced Aggregation Dialog -->
  <cds-dialog
    v-model="showAggregationDialog"
    title="Advanced Time Series Aggregation"
    :color="accentColor2"
    draggable
    :scrim="false"
    max-width="1200"
  >
    <AggregationWorkflow
      v-if="showAggregationDialog"
      :available-timestamps="availableTimestamps"
      :current-region="currentUserSelection?.region"
      @workflow-complete="onAggregationComplete"
      @pattern-saved="onPatternSaved"
    />
  </cds-dialog>
</v-app>
</template>

<script setup lang="ts">
import { useDisplay } from 'vuetify';
import { AggregationWorkflow } from './components/aggregation';

const display = useDisplay();
</script>