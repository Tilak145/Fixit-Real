# Component and design rules

Read the current DESIGN.md and installed component source before composing a
screen. This is ExaSpark's adaptation of the official shadcn AI guidance:
https://ui.shadcn.com/docs/skills and https://ui.shadcn.com/llms.txt.

- Use semantic background, foreground, primary, muted, border and status tokens.
  Start neutral; use brand color for the primary action, charts and status.
- One visually dominant action per screen. Secondary tasks use outline or ghost
  buttons; destructive actions explain the effect before confirmation.
- Use Geist and Lucide. Use 12/14/16/20/24/32 px type and 4/8/12/16/24/32/40 px
  spacing; adapt the shared tokens when the product has a confirmed design.
- Prefer existing Card, Field/Label, Input, Button, Dialog and list primitives.
  Keep composition APIs, labels, focus, keyboard and disabled behavior intact.
- Mobile primary controls are 48 dp high; inputs are 44 dp. Respect safe areas,
  Back and the keyboard. Dark mode uses tokens, never an inverted screenshot.
- Put loading, empty, error and success states beside the action that caused them.
  Preserve drafts and explain retry. Do not render raw provider diagnostics.
- Use local documentation and examples. Check a registry item's dependencies,
  platform support and license before adding it. Never overwrite an edited UI
  directory with a registry's defaults. Lock dependency versions.

## Styling on phones

- Style with Tailwind 4 classes through Uniwind. Colors, radius and fonts come
  from DESIGN.md as tokens (`bg-primary`, `text-muted-foreground`,
  `border-border`, `rounded-2xl`); never hard-code a hex color.
- A color needed in JavaScript, such as an SVG stroke or chart fill, comes from
  `useCSSVariable('--color-primary')` so it follows the theme.
- `className` on a third-party component needs `withUniwind(Component)`, as
  `components/screen.tsx` does for `SafeAreaView`.
- Every string renders inside `<Text>`. Write conditions as
  `{done ? <Badge /> : null}`, never `{count && <Badge />}`: a `0` or empty
  string outside `<Text>` crashes the Android app. `npm run typecheck` reports
  these.
- Hover and focus classes are web-only; wrap them in
  `Platform.select({ web: '…' })` as the installed components do.

## Optional website registries

Choose only when an installed component cannot express the requested interface:
[Tailark](https://tailark.com/) for marketing compositions,
[Origin UI](https://originui.com/) for form and application patterns, and
[Magic UI](https://magicui.design/) for restrained presentation effects.
These are website references; do not import DOM-only components into Expo.
