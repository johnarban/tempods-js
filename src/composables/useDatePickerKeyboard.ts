import { nextTick, type Ref } from "vue";

/**
 * Keyboard handling shared by every @vuepic/vue-datepicker in the app.
 *
 * Out of the box the picker opens its calendar without moving focus into it, so
 * a keyboard user is left on the input with a calendar they cannot reach, and
 * its arrow-key navigation walks onto dates with no data. This wires up the
 * four things that fix that, so the pickers in the map view and in the date
 * range creator behave the same way.
 *
 * Use it with `:arrow-navigation="true"` and `:teleport="true"` on the picker,
 * and a Cancel button in the #action-buttons slot if that slot is overridden -
 * overriding it drops the picker's own Cancel, which otherwise leaves Escape as
 * the only way out with nothing on screen to say so.
 */

interface DatePickerInstance {
  closeMenu: () => void;
}

/** How many frames to wait for the calendar to settle before giving up. */
const FOCUS_ATTEMPTS = 20;

/**
 * How long to keep an eye on focus after claiming it, in frames. The picker
 * moves focus itself a few frames after opening, later than a single
 * next-frame check would catch. ~20 frames is a third of a second: long enough
 * to cover that, short enough that it is over before anyone has tabbed away.
 */
const SETTLE_FRAMES = 20;

/**
 * The calendar is teleported to the end of the body, so it cannot be found by
 * walking up from the picker. Only open menus are in the DOM (measured: zero
 * when all the pickers are closed), and the newest is last, which is the one
 * that just opened.
 */
function currentMenu(): HTMLElement | null {
  const menus = document.querySelectorAll<HTMLElement>(".dp__menu");
  return menus.length > 0 ? menus[menus.length - 1] : null;
}

/** Is focus on a day cell, rather than the calendar's header or nowhere? */
function onACalendarDay(): boolean {
  return document.activeElement instanceof HTMLElement
    && document.activeElement.classList.contains("dp__calendar_item");
}

/** The first day in the grid that is not greyed out, if there is one. */
function firstPickableCell(menu: HTMLElement | null | undefined): HTMLElement | null {
  if (!menu) {
    return null;
  }
  const items = menu.querySelectorAll<HTMLElement>(".dp__calendar_item");
  for (const item of items) {
    if (!item.querySelector(".dp__cell_inner.dp__cell_disabled")) {
      return item;
    }
  }
  return items.length > 0 ? items[0] : null;
}

export function useDatePickerKeyboard(calendar: Ref<DatePickerInstance | null>) {

  // The element the calendar was opened from, so closing it can hand focus
  // back. It is captured on open rather than looked up on close because every
  // picker carries the same .cds__date-picker class: querying the document for
  // one would find whichever picker happens to come first, which with the map
  // view and the range creator both on screen is the wrong one.
  let opener: HTMLElement | null = null;

  /**
   * Dates with no data are rendered as disabled cells but stay in the tab
   * order, so Tab stops on days that cannot be picked. The library builds its
   * arrow-key grid from its own refs and ignores tabindex, so this only fixes
   * Tab; arrow keys still cross unavailable days.
   */
  function markUnavailableDates(menu: HTMLElement) {
    menu.querySelectorAll<HTMLElement>(".dp__calendar_item").forEach((item) => {
      const cell = item.querySelector(".dp__cell_inner");
      item.tabIndex = cell?.classList.contains("dp__cell_disabled") ? -1 : 0;
    });
  }

  /** Bind to @open. Moves focus into the calendar, onto the selected day. */
  function onOpen() {
    const active = document.activeElement;
    opener = active instanceof HTMLElement && active !== document.body ? active : null;

    let attemptsLeft = FOCUS_ATTEMPTS;
    const claimFocus = () => {
      if (attemptsLeft-- <= 0) {
        return;
      }
      const menu = currentMenu();
      // The selected day if there is one, which is also where the picker's own
      // arrow navigation starts, so the two agree rather than fight. A picker
      // with nothing selected yet falls back to the first day that can
      // actually be picked: the first cell in the grid is usually a greyed-out
      // day from the neighbouring month, and focusing that got bounced onto
      // the month-navigation arrows instead.
      const cell = menu?.querySelector<HTMLElement>(".dp__cell_inner.dp__active_date")
        ?.closest<HTMLElement>(".dp__calendar_item")
        ?? firstPickableCell(menu);
      if (!menu || !cell) {
        requestAnimationFrame(claimFocus);
        return;
      }
      // Reapplied alongside the focus claim rather than once on open: the same
      // re-render that steals focus also rebuilds the cells with tabindex="0",
      // which is what wiped this pass when it was hung off `open` on its own.
      markUnavailableDates(menu);
      cell.focus();
      requestAnimationFrame(() => {
        // Re-claim unless focus has settled on a day. Checking only that focus
        // is somewhere in the menu is not enough: with arrow-navigation on,
        // some of the pickers take focus to the month-navigation arrow a few
        // frames after this, which leaves the user in the calendar's header
        // rather than on the calendar. The check runs over several frames
        // because that happens later than the frame right after the focus.
        if (!onACalendarDay()) {
          claimFocus();
        }
      });
    };
    requestAnimationFrame(claimFocus);
    // The focus the picker does for itself can land several frames after ours,
    // so one check on the next frame sees our own cell and stops. This watches
    // a short window instead, and is bounded by the same attempt budget.
    let settleChecks = SETTLE_FRAMES;
    const watchForSteal = () => {
      if (settleChecks-- <= 0) {
        return;
      }
      if (!onACalendarDay() && currentMenu() !== null) {
        claimFocus();
      }
      requestAnimationFrame(watchForSteal);
    };
    requestAnimationFrame(watchForSteal);
  }

  /** Bind to @update-month-year. Paging the calendar rebuilds every cell. */
  function onMonthChange() {
    requestAnimationFrame(() => {
      const menu = currentMenu();
      if (menu) {
        markUnavailableDates(menu);
      }
    });
  }

  /** Bind to @closed. Puts focus back where the calendar was opened from. */
  function onClosed() {
    nextTick(() => {
      if (opener !== null && opener.isConnected) {
        opener.focus();
      }
      opener = null;
    });
  }

  /**
   * Call instead of closeMenu() when a date has been chosen. Picking a date
   * triggers a re-render that takes focus back, and closing inside that - on
   * nextTick, or straight away - gets undone by it, leaving the calendar open
   * with focus on the day just chosen. Two frames is past the re-render.
   */
  function closeAfterSelection() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => calendar.value?.closeMenu());
    });
  }

  return { onOpen, onMonthChange, onClosed, closeAfterSelection };
}
