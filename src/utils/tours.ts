import { useShepherd } from "vue-shepherd";
import type { Step, StepOptionsButton, Tour } from "shepherd.js";

import type { TempoStore } from "@/stores/app";
import { storeToRefs } from "pinia";

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
  tour.steps.forEach((_, index) => {
    const dot = document.createElement("div");
    dot.classList.add("progress-dot");
    if (index === currentIndex) {
      dot.classList.add("active");
    }
    dot.setAttribute("role", "button");
    dot.setAttribute("tabindex", "0");
    dot.setAttribute("aria-label", `Go to step ${index + 1}`);
    const goToStep = () => tour.show(index);
    dot.addEventListener("click", goToStep);
    dot.addEventListener("keyup", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        goToStep();
      }
    });
    dotsContainer.appendChild(dot);
  });

  // Shepherd snapshots the step's focusable elements while it builds the element
  // (_setupElements runs before the "show" event that calls this function), so the
  // dots are never in that list. Its Tab handler preventDefaults once focus reaches
  // the last element it knows about -- the Next button -- and wraps back to the
  // start, so anything appended after the buttons can't be tabbed to at all.
  // Inserting before Next puts the dots inside the range Shepherd tabs through.
  // The footer is a grid and .progress-dots is positioned by grid-column, so this
  // changes tab order without moving them on screen. insertBefore(node, null) is
  // just appendChild, which covers the first step (no Back button) fine.
  const nextButton = footer.querySelector(".shepherd-button-next");
  footer.insertBefore(dotsContainer, nextButton);
}

// NOTE: do not set tabindex="-1" on a step's target to skip past it.
// The tabindex="0" Shepherd puts there looks like a pointless extra tab stop,
// but it is the backward boundary of Shepherd's focus trap. Its Tab handler
// only intercepts Shift+Tab when focus is on the target itself:
//     else if (document.activeElement === f) { preventDefault(); v.focus(); }
// (f = the target, v = the last control in the popup). Take the target out of
// the tab order and that branch can never fire, so Shift+Tab from a control
// inside the target falls through to the browser and walks out of the tour
// into the page behind it, with nothing to bring focus back.
// Measured, Shift+Tab from inside the time-slider on step 2:
//   tabindex="0"  -> ... icon-wrapper -> slider-row  (boundary, bounces to popup)
//   tabindex="-1" -> ... icon-wrapper -> OUTSIDE the tour, stuck in the map
//
// So the stop stays. What we can do is make it say something: the targets are
// layout wrappers with no role and no accessible name, so landing on one
// announces nothing. labelTarget below borrows the step's own title, turning a
// silent stop into "Time Controls, group".

// Only one step is on screen at a time, so only one target is ever labelled.
// Holding the previous values here means the app's own markup is put back
// exactly as it was, rather than left with tour attributes after the tour ends.
let labelledTarget: {
  element: HTMLElement;
  role: string | null;
  label: string | null;
} | null = null;

function restoreTargetLabel() {
  if (!labelledTarget) {
    return;
  }
  const { element, role, label } = labelledTarget;
  if (role === null) {
    element.removeAttribute("role");
  } else {
    element.setAttribute("role", role);
  }
  if (label === null) {
    element.removeAttribute("aria-label");
  } else {
    element.setAttribute("aria-label", label);
  }
  labelledTarget = null;
}

function labelTarget(step: Step) {
  restoreTargetLabel();
  const target = step.getTarget();
  const title = step.options.title;
  if (!target || typeof title !== "string") {
    return;
  }
  labelledTarget = {
    element: target,
    role: target.getAttribute("role"),
    label: target.getAttribute("aria-label"),
  };
  target.setAttribute("role", "group");
  target.setAttribute("aria-label", title);
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

export function getIntroTour(store: TempoStore): Tour {

  const { datasetControlsOpen, layerControlsOpen } = storeToRefs(store);

  function defaultStepShow(step: Step) {
    addProgressDots(step);
    labelTarget(step);
    useMdiCloseIcon(step);
  }

  const tour = useShepherd({
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
  tour.addStep({
    title: "Map",
    attachTo: { element: map, on: "bottom" },
    text: "<p>TEMPO and other spatial datasets are displayed here. By default, you see TEMPO's NO₂ (nitrogen dioxide) data.</p><p>Pan around the map and zoom to specific locations, or use the location search box to go directly to a place of your choice.</p>",
    buttons: [nextButton],
  });

  const timeSlider = document.querySelector(".slider-row") as HTMLElement;
  tour.addStep({
    title: "Time Controls",
    attachTo: { element: timeSlider, on: "top" },
    text: "<p>Use the slider or play / pause button to control time.</p><p>The TEMPO data files are large, so you might notice a lag in the displayed data if you advance time before a timestep has fully loaded.</p>",
  });

  const mapControls = document.querySelector(".date-view-controls") as HTMLElement;
  tour.addStep({
    title: "Date",
    attachTo: { element: mapControls, on: "top" },
    text: "<p>Use the calendar picker to choose a specific date or the double blue arrows to advance to the previous or next available date.</p>",
  });

  const timeZone = document.querySelector(".timezone-dropdown") as HTMLElement;
  tour.addStep({
    title: "Timezone",
    attachTo: { element: timeZone, on: "top" },
    text: "<p>Use the dropdown to change the timezone displayed on the time controls. It helps to match the timezone to the region being viewed.</p>",
  });

  const layersPanelWrapper = document.querySelector("#layers-panel") as HTMLElement;
  // The panel's content (".comparison-data-controls") only exists in the DOM while the
  // panel is open (it's behind a v-if), so it may not be there yet if the user starts the
  // tour with the panel collapsed. Fall back to the always-present wrapper in that case.
  const layersPanel = (document.querySelector(".comparison-data-controls") as HTMLElement | null) ?? layersPanelWrapper;
  tour.addStep({
    title: "Layers Panel",
    attachTo: { element: layersPanel, on: "right" },
    text: "<p>Each card in this panel shows a different data layer.</p><p><strong>Checkbox:</strong> controls whether a layer is being displayed on the map.</p><p><strong>Legend:</strong> shows the numerical values or categories represented by each color (if layer is visible).</p><p><strong>i:</strong> tells you more about the layer.</p><p><strong>Hamburger</strong> (3 lines) icon: drag the layers into a new order. The layer at the top of the list will be visible on top of layers lower down in the list.</p><p><strong>Slider:</strong> controls the opacity of the displayed layer.</p><p><strong>SHOW ME MORE/LESS:</strong> display or hide additional layers.</p>",
    when: {
      show: () => {
        defaultStepShow(tour.currentStep);
        layerControlsOpen.value = true;
      },
    },
  });

  const openCloseLayers = layersPanelWrapper.querySelector(".open-close-container") as HTMLElement;
  tour.addStep({
    title: "Collapse & Expand Layers",
    attachTo: { element: openCloseLayers, on: "right" },
    text: "The layers panel can be opened and closed",
    when: {
      show: () => {
        defaultStepShow(tour.currentStep);
        layerControlsOpen.value = false;
      },
    },
  });

  const datasetsPanel = document.querySelector("#datasets-panel") as HTMLElement;
  tour.addStep({
    title: "Datasets Panel",
    attachTo: { element: datasetsPanel, on: "left" },
    text: "<p>From this panel you can create and view graphs that look like this.</p><p>(A more detailed tour of this section will be available soon)</p>",
    when: {
      show: () => {
        addImage(tour.currentStep, new URL("@/assets/example_graph.png", import.meta.url));
        defaultStepShow(tour.currentStep);
        datasetControlsOpen.value = true;
      },
    },
  });

  const openCloseDatasets = datasetsPanel.querySelector(".open-close-container") as HTMLElement;
  tour.addStep({
    title: "Collapse & Expand Datasets",
    attachTo: { element: openCloseDatasets, on: "left" },
    text: "The datasets panel can also be opened and closed",
    buttons: [backButton, endButton],
    when: {
      show: () => {
        defaultStepShow(tour.currentStep);
        datasetControlsOpen.value = false;
      },
    },
  });

  // Both endings have to put the last step's target back: "complete" for
  // Finish, "cancel" for the X, Esc, or clicking away.
  tour.on("cancel", () => {
    restoreTargetLabel();
    store.showTourHint = true;
  });

  tour.on("complete", () => {
    restoreTargetLabel();
    store.showTourHint = true;
  });

  return tour;
}
