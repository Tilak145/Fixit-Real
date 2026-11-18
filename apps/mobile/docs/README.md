# Component references

Read `design-rules.md` before changing visual composition. The installed
source in `components/` is the authority for each exact API. The phone
components are React Native Reusables (uniwind registry) restyled to shadcn/ui
Maia; the website uses the official radix-maia components with the same
DESIGN.md tokens.

Every component below is already installed with locked dependencies. Do not
run registry or `npx shadcn` commands; edit the installed source instead.

## Components

- [accordion](components/accordion.md)
- [alert-dialog](components/alert-dialog.md)
- [alert](components/alert.md)
- [aspect-ratio](components/aspect-ratio.md)
- [avatar](components/avatar.md)
- [badge](components/badge.md)
- [button](components/button.md)
- [card](components/card.md)
- [checkbox](components/checkbox.md)
- [collapsible](components/collapsible.md)
- [context-menu](components/context-menu.md)
- [dialog](components/dialog.md)
- [dropdown-menu](components/dropdown-menu.md)
- [empty](components/empty.md)
- [field](components/field.md)
- [hover-card](components/hover-card.md)
- [input-group](components/input-group.md)
- [input](components/input.md)
- [item](components/item.md)
- [label](components/label.md)
- [menubar](components/menubar.md)
- [popover](components/popover.md)
- [progress](components/progress.md)
- [radio-group](components/radio-group.md)
- [select](components/select.md)
- [separator](components/separator.md)
- [skeleton](components/skeleton.md)
- [switch](components/switch.md)
- [tabs](components/tabs.md)
- [text](components/text.md)
- [textarea](components/textarea.md)
- [toggle-group](components/toggle-group.md)
- [toggle](components/toggle.md)
- [tooltip](components/tooltip.md)

## ExaSpark composition guides

- [screen](components/screen.md): safe areas, headers, sections, pinned actions
- [tab-bar](components/tab-bar.md): the bottom tab bar
- [icon](components/icon.md)
- [calendar](components/calendar.md)
- [chart](components/chart.md)
- [drawer](components/drawer.md)
- [portal](components/portal.md)
- [account](components/account.md)
- [payment](components/payment.md)

## Examples

`app/index.tsx` is a catalogue of nine component demonstrations
(`app/components/`) and 21 page examples (`app/examples/`), plus an app shell
with a bottom tab bar (`app/tabs/`). Copy from them, then replace the
catalogue with the app's real first screen.
