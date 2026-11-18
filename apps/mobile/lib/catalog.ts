// The starter's catalogue: component demonstrations in app/components and
// page examples in app/examples. Replace app/index.tsx with the real app.
export const componentExamples = [
  ['buttons', 'Button', 'Variants, sizes, icons and loading'],
  ['inputs', 'Input', 'Fields, input groups and text areas'],
  ['selection', 'Selection', 'Switch, checkbox, radio and toggles'],
  ['lists', 'Item', 'Rows, groups, avatars and actions'],
  ['cards', 'Card', 'Stats, badges, progress and empty states'],
  ['data', 'Chart and calendar', 'Bars, ring and a month view'],
  ['overlays', 'Dialog', 'Dialogs, alerts and confirmations'],
  ['drawer', 'Sheet', 'Bottom sheet with actions'],
  ['menu', 'Menu', 'Dropdown, select and tooltip'],
] as const;

export const pageExamples = [
  ['onboarding', 'Welcome', 'First launch'],
  ['sign-in', 'Sign in', 'Email and password'],
  ['sign-up', 'Create account', 'Sign up with email'],
  ['verify-email', 'Verify email', 'Code from the email'],
  ['forgot-password', 'Reset password', 'Email a reset link'],
  ['home', 'Home', 'Today at a glance'],
  ['list', 'List', 'Search, filters and rows'],
  ['detail', 'Detail', 'Hero, stats and tabs'],
  ['search', 'Search', 'Results and recent searches'],
  ['create', 'Create', 'A form with a primary action'],
  ['calendar', 'Calendar', 'Month view and agenda'],
  ['stats', 'Insights', 'Chart and categories'],
  ['notifications', 'Notifications', 'Unread and earlier'],
  ['inbox', 'Inbox', 'Conversations'],
  ['conversation', 'Conversation', 'Messages and a composer'],
  ['profile', 'Profile', 'Account and sign out'],
  ['settings', 'Settings', 'Appearance and preferences'],
  ['paywall', 'Plans', 'Subscriptions through Stripe'],
  ['purchase-success', 'Purchase status', 'After checkout'],
  ['offline', 'Offline', 'No connection'],
  ['update', 'Update required', 'Minimum version'],
] as const;
