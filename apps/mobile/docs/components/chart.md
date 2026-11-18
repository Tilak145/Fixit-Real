# Chart

ExaSpark composition guide. Charts are `react-native-svg` drawings colored by
the theme. `ActivityChart` and `Donut` in `app/components/data.tsx` show an
area chart and a donut; `components/progress-ring.tsx` is a progress ring;
`app/examples/stats.tsx` puts them on a screen.

- Read colors with `useCSSVariable('--color-chart-1')` … `--color-chart-5`,
  `--color-primary` or `--color-muted`, so dark mode and the DESIGN.md palette
  apply. Never hard-code hex colors.
- Wrap the drawing in `<View role="img" aria-label="…">` with a text summary of
  the values, and show the key numbers as text beside it.
- Draw the app's real data; label sample values as sample data.
