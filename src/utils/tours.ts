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
  // The dots are a toolbar, which is the ARIA pattern for a row of buttons that
  // belong together: the group is a single tab stop and the arrow keys move
  // between the buttons inside it (roving tabindex, below). With one tab stop
  // each, tabbing out of the popup to the step's own target took 12 presses
  // (close, back, 8 dots, next, target) and would grow with every step added;
  // as a toolbar it is 5, whatever the tour's length.
  dotsContainer.setAttribute("role", "toolbar");
  dotsContainer.setAttribute("aria-label", "Tour steps");
  const currentIndex = tour.steps.indexOf(step);
  tour.steps.forEach((_, index) => {
    const dot = document.createElement("div");
    dot.classList.add("progress-dot");
    if (index === currentIndex) {
      dot.classList.add("active");
      dot.setAttribute("aria-current", "step");
    }
    dot.setAttribute("role", "button");
    // Roving tabindex: the dot for the step you are on is the one tab stop, and
    // the handler below moves that 0 along as focus moves. The dots are rebuilt
    // on every step, so the current step is always the right place to start.
    dot.setAttribute("tabindex", index === currentIndex ? "0" : "-1");
    dot.setAttribute("aria-label", `Go to step ${index + 1}`);
    const goToStep = () => tour.show(index);
    dot.addEventListener("click", goToStep);
    dot.addEventListener("keydown", (event) => {
      // Space would scroll the page behind the tour before the keyup fires.
      if (event.key === " ") {
        event.preventDefault();
      }
    });
    dot.addEventListener("keyup", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        goToStep();
      }
    });
    dotsContainer.appendChild(dot);
  });

  // Arrows move focus only; Enter or Space is what jumps to a step. Moving and
  // activating are kept apart on purpose - arrowing along the dots to look at
  // where you are should not tear the tour out from under you.
  //
  // stopPropagation matters here: Shepherd's keyboardNavigation option (on by
  // default) puts its own keydown handler on the step dialog and treats Left
  // and Right as previous/next step. This container sits inside that dialog,
  // so without stopping the event, arrowing along the dots also walked the
  // tour and threw focus onto the newly built dialog. Arrows keep their
  // step-changing meaning everywhere else in the popup - inside the toolbar
  // they move within it, which is what the toolbar pattern asks for.
  dotsContainer.addEventListener("keydown", (event) => {
    const dots = Array.from(dotsContainer.querySelectorAll<HTMLElement>(".progress-dot"));
    const from = dots.findIndex((dot) => dot === document.activeElement);
    if (from < 0) {
      return;
    }
    let to: number;
    switch (event.key) {
    case "ArrowLeft":
      to = (from - 1 + dots.length) % dots.length;
      break;
    case "ArrowRight":
      to = (from + 1) % dots.length;
      break;
    case "Home":
      to = 0;
      break;
    case "End":
      to = dots.length - 1;
      break;
    default:
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dots[from].setAttribute("tabindex", "-1");
    dots[to].setAttribute("tabindex", "0");
    dots[to].focus();
  });

  // Shepherd snapshots the step's focusable elements while it builds the element
  // (_setupElements runs before the "show" event that calls this function), so the
  // dots are never in that list. Its Tab handler preventDefaults once focus reaches
  // the last element it knows about -- the Next button -- and wraps back to the
  // start, so anything appended after the buttons can't be tabbed to at all.
  // Inserting before Next puts the dots inside the range Shepherd tabs through,
  // which is still what gets the toolbar's one tab stop reached at all.
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
  // Only name targets that have nothing to say for themselves. A target that
  // already carries a role is a real control - the Timezone step attaches to a
  // combobox - and overwriting that with role="group" would take its semantics
  // away for the length of the step.
  if (target.getAttribute("role") !== null) {
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

  // Attached to the dropdown's own <input>, not the .timezone-dropdown wrapper.
  // Shepherd puts tabindex="0" on whatever it attaches to (see the NOTE above -
  // that stop is its focus trap's backward boundary and has to stay). On the
  // wrapper, which is a plain layout div, that was an extra tab stop in front
  // of the real control: the first Tab landed on the wrapper, where the arrow
  // keys do nothing, and it took a second Tab to reach the combobox. Outside
  // the tour the wrapper has no tabindex and one Tab is enough, which is why
  // this only happened during the tour.
  //
  // The input is already a tab stop, so attaching here adds none, and it is
  // still the element the trap bounces Shift+Tab off.
  const timeZone = document.querySelector(".timezone-dropdown input") as HTMLElement;
  tour.addStep({
    title: "Timezone",
    attachTo: { element: timeZone, on: "left" },
    // The cutout is now the input rather than the whole field, so pad it back
    // out to cover the field's border and label.
    modalOverlayOpeningPadding: 8,
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

  // The toggle itself, not the .open-close-container around it, for the same
  // reason as the Timezone step: Shepherd gives its target tabindex="0", and
  // on the container - a layout div holding the icon and an <hr> - that was an
  // extra tab stop in front of the control. Measured, it took two Tabs to
  // reach the icon, the first landing on the container where nothing responds.
  // The icon is a v-icon, which already renders with tabindex="0", so
  // attaching here adds no stop and it is still the focus trap's boundary.
  const openCloseLayers = layersPanelWrapper.querySelector(".open-close-icon") as HTMLElement;
  tour.addStep({
    title: "Collapse & Expand Layers",
    attachTo: { element: openCloseLayers, on: "right" },
    // The cutout is the icon rather than the container, so pad it back out.
    modalOverlayOpeningPadding: 8,
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

  // The toggle itself rather than its container - see the Layers step above.
  const openCloseDatasets = datasetsPanel.querySelector(".open-close-icon") as HTMLElement;
  tour.addStep({
    title: "Collapse & Expand Datasets",
    attachTo: { element: openCloseDatasets, on: "left" },
    modalOverlayOpeningPadding: 8,
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
