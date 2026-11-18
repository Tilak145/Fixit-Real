/**
 * Whether a press at `clientX` landed on a popup's own scrollbar: the strip at
 * the right edge of the element, past the area its content fills. A press there
 * is not a click on the dim background, so it must not close the popup.
 */
export function pointOnScrollbar(clientX: number, left: number, clientWidth: number): boolean {
  return clientX >= left + clientWidth;
}
