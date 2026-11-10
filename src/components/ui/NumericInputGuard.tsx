"use client";

import { useEffect } from "react";

// Central numeric handling for every field that used to be <input type="number">.
// Those are now type="text" (so the value can never be changed by the spinner,
// the arrow keys, or the mouse wheel) and carry inputMode="decimal" for a numeric
// on-screen keypad. This guard is the single place that keeps their *content*
// numeric: it blocks any non-numeric keystroke or paste before it lands, so the
// existing parseFloat/Number code downstream always sees a clean value.
//
// Scope is limited to inputs explicitly tagged inputMode="decimal", so ordinary
// text fields are never affected.

function isNumericField(el: EventTarget | null): el is HTMLInputElement {
  return (
    el instanceof HTMLInputElement &&
    (el.inputMode === "decimal" || el.getAttribute("inputmode") === "decimal")
  );
}

// What the field's value would become if this insertion went through — used to
// reject a second decimal point or a misplaced minus sign.
function projectedValue(el: HTMLInputElement, insert: string): string {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  return el.value.slice(0, start) + insert + el.value.slice(end);
}

export function NumericInputGuard() {
  useEffect(() => {
    const onBeforeInput = (e: Event) => {
      const ie = e as InputEvent;
      const el = ie.target;
      if (!isNumericField(el)) return;
      // Deletions, cursor moves, composition, etc. carry no inserted data.
      if (ie.data == null) return;
      // Only digits, a single dot and a leading minus are allowed.
      if (/[^0-9.\-]/.test(ie.data)) {
        ie.preventDefault();
        return;
      }
      const next = projectedValue(el, ie.data);
      // At most one dot; a minus only at the very start.
      if ((next.match(/\./g) ?? []).length > 1 || /(?!^)-/.test(next)) {
        ie.preventDefault();
      }
    };

    // Belt-and-braces: a focused field shouldn't react to the scroll wheel.
    // (type="text" already ignores it, but this also stops the page-scroll from
    // being swallowed while hovering a former number input.)
    const onWheel = (e: WheelEvent) => {
      if (isNumericField(document.activeElement) && document.activeElement === e.target) {
        (document.activeElement as HTMLElement).blur();
      }
    };

    document.addEventListener("beforeinput", onBeforeInput, true);
    document.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      document.removeEventListener("beforeinput", onBeforeInput, true);
      document.removeEventListener("wheel", onWheel);
    };
  }, []);

  return null;
}
