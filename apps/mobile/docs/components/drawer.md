# Drawer

ExaSpark composition guide. `AddItemSheet` in `app/components/drawer.tsx` is a
bottom sheet on React Native's `Modal`: a dimmed backdrop that closes it, a
panel with a handle, a title, fields and a primary action.

- Pass `onRequestClose` so Android Back (and Escape on the web) closes it.
- Pad the panel's bottom by the safe-area inset (`useSafeAreaInsets()`).
- Give the panel `role="dialog"`, `aria-modal` and an `aria-label`.
- Use a sheet for a short task on top of a screen; a longer flow is its own
  screen.
