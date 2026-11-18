# Field

shadcn/ui's Field for phones: a label, its control, a description and an
error, stacked or side by side. Installed in `components/ui/field.tsx`.

## Usage

```tsx
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
```

```tsx
<FieldGroup>
  <Field>
    <FieldLabel nativeID="email">Email</FieldLabel>
    <Input aria-labelledby="email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} />
    <FieldError>{errors.email}</FieldError>
  </Field>
  <Field orientation="horizontal">
    <FieldContent>
      <FieldLabel nativeID="reminders">Daily reminder</FieldLabel>
      <FieldDescription>A nudge at 9:00 if nothing is logged.</FieldDescription>
    </FieldContent>
    <Switch aria-labelledby="reminders" checked={reminders} onCheckedChange={setReminders} />
  </Field>
</FieldGroup>
```

- Link the label to its control: `nativeID` on `FieldLabel`, the same value in
  the control's `aria-labelledby`.
- `FieldError` renders nothing without a message, so it can stay in place.
  Show an error after the person leaves the field or submits, and keep their
  input.
- `orientation="horizontal"` puts the label and description on the left and a
  switch, checkbox or small control on the right.
