import { watch, computed, type Ref } from "vue";
import { useShepherd } from "vue-shepherd";
import type { Step, StepOptionsButton, Tour, StepOptions } from "shepherd.js";

import type { TempoStore } from "@/stores/app";
import { storeToRefs } from "pinia";

interface TourInfo {
  maxStepReached?: number;
  gatedSteps?: Set<number>;
}

const GLOBAL_TOUR_INFO: TourInfo = {};


const backButton: StepOptionsButton = {
  action() { return this.back(); },
  classes: "shepherd-button-back",
  text: "Back",
};

const nextButton: StepOptionsButton = {
  action() { return this.next(); },
  classes: "shepherd-button-next",
  text: "Next",
};

export interface CosmicDSDirectionalButtonOptions {
  classes?: string;
  text?: string;
  disabled?: boolean | (() => boolean);
}
function createBackButton(options?: CosmicDSDirectionalButtonOptions): StepOptionsButton {
  return {
    action() { return this.back(); },
    classes: options?.classes ?? "shepherd-button-back",
    text: options?.text ?? "Back",
    disabled: options?.disabled ?? false,
  };
}

function createNextButton(options?: CosmicDSDirectionalButtonOptions): StepOptionsButton {
  return {
    action() { return this.next(); },
    classes: options?.classes ?? "shepherd-button-next",
    text: options?.text ?? "Next",
    disabled: options?.disabled ?? false,
  };
}

const endButton: StepOptionsButton = {
  action() { return this.next(); },
  classes: "shepherd-button-next",
  text: "Finish",
};

const defaultButtons: StepOptionsButton[] = [backButton, nextButton];



export function addProgressDots(step: Step) {
  const stepElement = step.getElement();
  const tour = step.tour;
  if (!stepElement) {
    return;
  }
  const footer = stepElement.querySelector(".shepherd-footer");
  if (!footer) {
    return;
  }
  const dotsContainer = document.createElement("div");
  dotsContainer.classList.add("progress-dots");
  const currentIndex = tour.steps.indexOf(step);
  
  const maxStepReached = getMaxStepReached(tour);
  const hasAnyGated = getGatedSteps(tour).size > 0;
  tour.steps.forEach((_, index) => {
    const dot = document.createElement("div");
    dot.classList.add("progress-dot");
    if (index === currentIndex) {
      dot.classList.add("active");
    }
    dot.setAttribute("role", "button");
    dot.setAttribute("tabindex", "0");
    dot.setAttribute("aria-label", `Go to step ${index + 1}`);
    
    // todo, check if getGatedSteps.has(index)
    if (hasAnyGated && getGatedSteps(tour).has(index) && (index > maxStepReached)) {
      dot.classList.add("disabled");
    } else {
      const goToStep = () => tour.show(index);
      dot.addEventListener("click", goToStep);
      dot.addEventListener("keyup", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          goToStep();
        }
      });
    }
    
    dotsContainer.appendChild(dot);
  });
  footer.appendChild(dotsContainer);
}

function useMdiCloseIcon(step: Step) {
  const stepElement = step.getElement();
  const cancelIcon = stepElement?.querySelector(".shepherd-cancel-icon");
  if (!cancelIcon) {
    return;
  }
  cancelIcon.replaceChildren();
  const icon = document.createElement("span");
  icon.classList.add("mdi", "mdi-close");
  icon.setAttribute("aria-hidden", "true");
  cancelIcon.appendChild(icon);
}

function addImage(step: Step, src: URL) {
  const stepElement = step.getElement();
  const textContainer = stepElement?.querySelector(".shepherd-text");
  if (!(stepElement && textContainer)) {
    return;
  }
  const img = document.createElement("img");
  const width = stepElement.getBoundingClientRect().width;
  img.src = src.href;
  img.style.width = `${width - 20}px`;
  img.style.display = "block";
  img.style.marginTop = "12px";
  img.style.marginLeft = "auto";
  img.style.marginRight = "auto";
  img.style.marginBottom = "10px";
  img.style.border = "1px solid rgba(255, 255, 255, 0.35)";
  img.style.borderRadius = "4px";
  textContainer.appendChild(img);
}

function getGatedSteps(tour: Tour): Set<number> {
  const id = tour.id;
  if (id === undefined) { throw new Error("Tour is missing an ID field!"); }
  const info = GLOBAL_TOUR_INFO;
  if (info == undefined) {
    const gatedSteps = new Set<number>();
    GLOBAL_TOUR_INFO['gatedSteps'] = gatedSteps ;
    return gatedSteps;
  } else {
    if (info.gatedSteps == undefined) {
      info.gatedSteps = new Set<number>();
    }
    return info.gatedSteps;
  }
}

function setStepGated(tour: Tour, stepIndex: number, gated: boolean) {
  if (tour.id === undefined) { throw new Error("Tour is missing an ID field!"); }
  const steps = getGatedSteps(tour);
  if (gated) {
    steps.add(stepIndex);
  } else {
    steps.delete(stepIndex);
  }
}

function setDisabled(element: HTMLElement, disabled: boolean) {
  if (disabled) {
    element.setAttribute("disabled", "");
  } else {
    element.removeAttribute("disabled");
  }
}

function setNextEnabled(step: Step, enabled: boolean) {
  const element = step?.getElement();
  if (!(step && element)) { return; }

  const nextButton = element.querySelector(".shepherd-button-next") as HTMLElement;
  if (nextButton) {
    setDisabled(nextButton, !enabled);
  }
}

function getMaxStepReached(tour: Tour): number {
  const id = tour.id;
  if (id === undefined) { throw new Error("Tour is missing an ID field!"); }
  return GLOBAL_TOUR_INFO?.maxStepReached ?? 0;
}


function setMaxStepReached(tour: Tour, maxStep: number) {
  const id = tour.id;
  if (id === undefined) { throw new Error("Tour is missing an ID field!"); }
  const info = GLOBAL_TOUR_INFO;
  if (info == undefined) {
    GLOBAL_TOUR_INFO['maxStepReached'] = maxStep ;
  } else {
    info.maxStepReached = maxStep;
  }
}

function onAllowNextChange(tour: Tour, allow: boolean) {
  if (tour.currentStep) {
    setNextEnabled(tour.currentStep, allow);
  }
}

export type CosmicDSStepOptions = StepOptions & {
  allowNext?: Ref<boolean>;
};

export function addStep(tour: Tour, options: CosmicDSStepOptions) {
  const allowNext = options.allowNext;
  if (allowNext != null) {
    watch(allowNext, (allow: boolean) => onAllowNextChange(tour, allow));

    if (!allowNext.value) {
      setStepGated(tour, tour.steps.length, true);  // The new step will be added at the end
    }

    const buttons = options.buttons;
    if (buttons) {
      const nextButton = buttons.find(button => button.classes?.includes("shepherd-button-next"));
      if (nextButton) {
        nextButton.disabled = !allowNext.value;
      }
    } else {
      options.buttons = [createBackButton(), createNextButton({ disabled: () => !allowNext.value })];
    }
  }

  tour.addStep(options);
}


export function getIntroTour(store: TempoStore): Tour {

  const { datasetControlsOpen, layerControlsOpen, regionsCreatedCount } = storeToRefs(store);

  function defaultStepShow(step: Step) {
    if (!step) { return; } // need to check because we use ! type assertion
    addProgressDots(step);
    useMdiCloseIcon(step);
  }

  const tour: Tour = useShepherd({
    useModalOverlay: true,
    defaultStepOptions: {
      buttons: defaultButtons,
      cancelIcon: {
        enabled: true,
      },
      when: {
        show() {
          defaultStepShow(this as Step);
        },
      },
    },
  });
  
  

  const map = document.querySelector(".map-contents") as HTMLElement;
  addStep(tour, ({
    title: "Map",
    attachTo: { element: map, on: "bottom" },
    text: "<p>TEMPO and other spatial datasets are displayed here. By default, you see TEMPO's NO₂ (nitrogen dioxide) data.</p><p>Pan around the map and zoom to specific locations, or use the location search box to go directly to a place of your choice.</p>",
    buttons: [nextButton],
  }));

  const timeSlider = document.querySelector(".slider-row") as HTMLElement;
  addStep(tour, ({
    title: "Time Controls",
    attachTo: { element: timeSlider, on: "top" },
    text: "<p>Use the slider or play / pause button to control time.</p><p>The TEMPO data files are large, so you might notice a lag in the displayed data if you advance time before a timestep has fully loaded.</p>",
  }));

  const mapControls = document.querySelector(".date-view-controls") as HTMLElement;
  addStep(tour, ({
    title: "Date",
    attachTo: { element: mapControls, on: "top" },
    text: "<p>Use the calendar picker to choose a specific date or the double blue arrows to advance to the previous or next available date.</p>",
  }));

  const timeZone = document.querySelector(".timezone-dropdown") as HTMLElement;
  addStep(tour, ({
    title: "Timezone",
    attachTo: { element: timeZone, on: "top" },
    text: "<p>Use the dropdown to change the timezone displayed on the time controls. It helps to match the timezone to the region being viewed.</p>",
  }));

  const layersPanelWrapper = document.querySelector("#layers-panel") as HTMLElement;
  // The panel's content (".comparison-data-controls") only exists in the DOM while the
  // panel is open (it's behind a v-if), so it may not be there yet if the user starts the
  // tour with the panel collapsed. Fall back to the always-present wrapper in that case.
  const layersPanel = (document.querySelector(".comparison-data-controls") as HTMLElement | null) ?? layersPanelWrapper;
  addStep(tour, ({
    title: "Layers Panel",
    attachTo: { element: layersPanel, on: "right" },
    text: "<p>Each card in this panel shows a different data layer.</p><p><strong>Checkbox:</strong> controls whether a layer is being displayed on the map.</p><p><strong>Legend:</strong> shows the numerical values or categories represented by each color (if layer is visible).</p><p><strong>i:</strong> tells you more about the layer.</p><p><strong>Hamburger</strong> (3 lines) icon: drag the layers into a new order. The layer at the top of the list will be visible on top of layers lower down in the list.</p><p><strong>Slider:</strong> controls the opacity of the displayed layer.</p><p><strong>SHOW ME MORE/LESS:</strong> display or hide additional layers.</p>",
    when: {
      show: () => {
        defaultStepShow(tour.currentStep!);
        layerControlsOpen.value = true;
      },
    },
  }));

  const openCloseLayers = layersPanelWrapper.querySelector(".open-close-container") as HTMLElement;
  addStep(tour, ({
    title: "Collapse & Expand",
    attachTo: { element: openCloseLayers, on: "right" },
    text: "The layers panel can be opened and closed",
    when: {
      show: () => {
        defaultStepShow(tour.currentStep!);
        layerControlsOpen.value = false;
      },
    },
  }));

  const datasetsPanel = document.querySelector("#datasets-panel") as HTMLElement;
  addStep(tour, ({
    title: "Datasets Panel",
    attachTo: { element: datasetsPanel, on: "left" },
    text: "<p>From this panel you can create and view graphs that look like this.</p><p>(A more detailed tour of this section will be available soon)</p>",
    when: {
      show: () => {
        addImage(tour.currentStep!, new URL("@/assets/example_graph.png", import.meta.url));
        defaultStepShow(tour.currentStep!);
        datasetControlsOpen.value = true;
      },
    },
  }));

  
  const myRegions = () => document.querySelector("#dc-my-regions") as HTMLElement;
  addStep(tour, ({
    title: "My Regions",
    attachTo: { element: myRegions, on: "top" },
    text: "My Regions",
    extraHighlights: ['.tempo-map'], // make the map interactive too.
    allowNext: computed(() => regionsCreatedCount.value > 0),
    // i don't think we want to actually skip it, but  this is how you would do it
    // showOn: () => regionsCreatedCount.value === 0, 
  }));
  const myTimeRanges = () => document.querySelector("#dc-my-time-ranges") as HTMLElement;
  addStep(tour, ({
    title: "My Time Ranges",
    attachTo: { element: myTimeRanges, on: "left" },
    text: "My Time Ranges",
  }));
  const myDatasets = () => document.querySelector("#dc-my-datasets") as HTMLElement;
  addStep(tour, ({
    title: "My Datasets",
    attachTo: { element: myDatasets, on: "left" },
    text: "My Datasets",
  }));


  const openCloseDatasets = datasetsPanel.querySelector(".open-close-container") as HTMLElement;
  addStep(tour, ({
    title: "Collapse & Expand",
    attachTo: { element: openCloseDatasets, on: "left" },
    text: "The datasets panel can also be opened and closed",
    buttons: [backButton, endButton],
    when: {
      show: () => {
        defaultStepShow(tour.currentStep!);
        datasetControlsOpen.value = false;
      },
    },
  }));
  
  tour.on("cancel", () => {
    store.showTourHint = true;
  });

  tour.on("complete", () => {
    store.showTourHint = true;
  });
  
  tour.on("show", (event: { step: Step }) => {
    const newStep = event.step;
    if (!newStep) { return; }
    const newIndex = tour.steps.indexOf(newStep);
    setMaxStepReached(tour, Math.max(newIndex, getMaxStepReached(tour)));
  });

  return tour;
}
