---
schema: spk.design.v1
name: FixIt Local Services
defaultTheme: light
brand:
  primary: '#1565C0'
typography:
  body:
    family: ["Nunito Sans", "Segoe UI", sans-serif]
    size: 15px
    weight: 400
    lineHeight: 1.55
  heading:
    family: ["Poppins", "Segoe UI", sans-serif]
    size: 28px
    weight: 600
    lineHeight: 1.2
  mono:
    family: ["ui-monospace", "SFMono-Regular", monospace]
    size: 13px
    weight: 400
    lineHeight: 1.5
radius:
  sm: 6px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  control: 12px
  panel: 24px
  section: 64px
layout:
  contentMaxWidth: 1280px
themes:
  light:
    background: '#F5F7FA'
    foreground: '#1A2333'
    card: '#FFFFFF'
    card-foreground: '#1A2333'
    primary: '#1565C0'
    primary-foreground: '#FFFFFF'
    secondary: '#0D2C54'
    secondary-foreground: '#FFFFFF'
    muted: '#EEF2F7'
    muted-foreground: '#5A6B80'
    accent: '#F57C00'
    accent-foreground: '#FFFFFF'
    destructive: '#D93025'
    destructive-foreground: '#FFFFFF'
    border: '#DCE4EE'
    input: '#FFFFFF'
    ring: '#1565C0'
  dark:
    background: '#101722'
    foreground: '#EDF2F9'
    card: '#1A2333'
    card-foreground: '#EDF2F9'
    primary: '#4D8FE0'
    primary-foreground: '#0B1420'
    secondary: '#22334D'
    secondary-foreground: '#EDF2F9'
    muted: '#1E2A3C'
    muted-foreground: '#9FB0C4'
    accent: '#F59A3D'
    accent-foreground: '#1A1206'
    destructive: '#E4574C'
    destructive-foreground: '#FFFFFF'
    border: '#2A3A52'
    input: '#1E2A3C'
    ring: '#4D8FE0'
---

# FixIt visual language

## Brand
FixIt is a friendly, trustworthy local home-services marketplace. The look is clean
and confident: crisp white cards on a soft blue-grey ground, a strong service blue
(#1565C0) for primary actions and links, and a warm orange (#F57C00) reserved for
the single most important call to action on each screen (hero search, Continue,
Select Plan). Deep navy (#0D2C54) is the provider-app chrome color.

## Typography
- Headings: "Poppins" (600/700) — rounded, bold, approachable.
- Body: "Nunito Sans" (400/600) — highly legible at small sizes.
- Sizes: hero 44–52px, section titles 26–30px, card titles 17–18px, body 14–15px, captions 12–13px.

## Components
- Cards: white, 12px radius, 1px #DCE4EE border, subtle shadow on hover-capable cards.
- Buttons: 44px+ height, 8px radius. Primary blue; accent orange for primary conversion actions; green (#2E9E4F) only for positive lead actions (Accept Lead).
- Badges: pill, 999px radius. Green "Available Today"/"Verified", orange "Most Popular".
- Stepper: numbered blue circles connected by a line; current step filled, future steps outlined.
- Form fields: white, 1px border, 8px radius, 44px height, grey placeholder.
- Icons: inline stroke SVG, 2px stroke, current color. Never emoji.

## Imagery
Real photography of homes and technicians at work. Hero photos sit under a dark
navy gradient overlay so white text stays at 4.5:1 contrast.

## Layout
- Max content width 1280px, 24px gutters; sections separated by 64–80px.
- Fluid pages stack to a single column below 768px; the dashboard sidebar collapses to a top bar.
