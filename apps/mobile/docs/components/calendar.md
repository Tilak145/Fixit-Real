# Calendar

ExaSpark composition guide. `MonthCalendar` in `app/components/data.tsx` is a
month grid with previous and next month, today and a selected day;
`app/examples/calendar.tsx` adds an agenda for the selected day.

- Keep the selected date in state as year, month and day (or a `YYYY-MM-DD`
  string). Date-only values must not shift with the time zone, so do not
  round-trip them through `new Date(string)` in UTC.
- Each day is a button with an accessible label such as "Thursday, October 15"
  and a visible selected state (`bg-primary` with `text-primary-foreground`).
- Use the user's locale for month and weekday names when the app is localized.
