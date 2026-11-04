---
schema: spk.product.v1
screens:
  - id: home
    title: Home
    path: /
    viewport:
      width: 1440
      height: 2400
    requirements:
      - req-search
      - req-services
      - req-how-it-works
      - req-top-pros
      - req-availability
  - id: services
    title: Service Category
    path: /services/[slug]
    viewport:
      width: 1440
      height: 1600
    requirements:
      - req-pro-listing
      - req-availability
  - id: pro-profile
    title: Professional Profile
    path: /pros/[id]
    viewport:
      width: 1440
      height: 1800
    requirements:
      - req-pro-detail
      - req-quote-request
      - req-reviews-write
      - req-availability
      - req-trust
  - id: request-quote
    title: Request a Quote
    path: /request
    viewport:
      width: 1440
      height: 1500
    requirements:
      - req-quote-request
      - req-request-media
      - req-lead-budget
  - id: account
    title: Customer Account
    path: /account
    viewport:
      width: 1440
      height: 1200
    requirements:
      - req-account
      - req-my-requests
      - req-appointments
      - req-messaging
      - req-quotes
      - req-quote-compare
      - req-request-media
  - id: pro-signup
    title: Provider Sign Up
    path: /for-businesses
    viewport:
      width: 1440
      height: 900
    requirements:
      - req-pro-onboarding
  - id: pro-onboarding
    title: Provider Onboarding Wizard
    path: /pro/onboarding
    viewport:
      width: 1440
      height: 900
    requirements:
      - req-pro-onboarding
  - id: pro-dashboard
    title: Provider Dashboard
    path: /pro/dashboard
    viewport:
      width: 1440
      height: 1600
    requirements:
      - req-leads
      - req-appointments
      - req-messaging
      - req-reviews
      - req-subscription
      - req-quotes
      - req-availability
      - req-request-media
      - req-trust
      - req-fair-lead
      - req-lead-conversion
  - id: admin
    title: Management Dashboard
    path: /admin
    viewport:
      width: 1440
      height: 1000
    requirements:
      - req-admin
      - req-trust
      - req-lead-integrity
flows:
  - id: customer-finds-pro
    from: home
    to: request-quote
    action: Search or pick a service, then request a quote
  - id: customer-photographs-job
    from: request-quote
    to: request-quote
    action: Photograph or record the problem and attach it to the job before sending
  - id: customer-sets-budget
    from: request-quote
    to: request-quote
    action: Say roughly what the job should cost, choosing a band or typing an amount
  - id: customer-checks-availability
    from: services
    to: services
    action: Filter to pros available today, tomorrow or for emergency work, and open the one who can come soonest
  - id: customer-reads-trust
    from: pro-profile
    to: pro-profile
    action: Read the trust score and the evidence behind it, including which checks are still missing
  - id: pro-joins
    from: pro-signup
    to: pro-dashboard
    action: Complete the 5-step onboarding wizard and choose a plan
  - id: owner-verifies-pro
    from: admin
    to: admin
    action: Confirm a licence against the state register and verify the insurance certificate, which is what earns the verified badge
  - id: pro-pauses-work
    from: pro-dashboard
    to: pro-dashboard
    action: Pause new leads with one switch when busy, then go available again
  - id: pro-filters-leads
    from: pro-dashboard
    to: pro-dashboard
    action: Filter leads by trade, area, urgency and the customer's budget, so only the work worth taking is shown
  - id: pro-reviews-media
    from: pro-dashboard
    to: pro-dashboard
    action: Open the customer's photos to understand the job before pricing it
  - id: pro-quotes-lead
    from: pro-dashboard
    to: pro-dashboard
    action: Send an itemised price on any open job you match, without claiming it first
  - id: pro-reports-lead
    from: pro-dashboard
    to: pro-dashboard
    action: Report a lead that is fake, duplicated or outside the trade, and a person decides
  - id: owner-reviews-leads
    from: admin
    to: admin
    action: Clear or confirm a flagged request, and uphold or reject a reported lead
  - id: customer-compares-quotes
    from: account
    to: account
    action: Compare every pro's itemised price side by side, then accept one
  - id: customer-accepts-quote
    from: account
    to: account
    action: Accept a price, which awards the job to that pro, closes the other quotes and releases your contact details
  - id: customer-tracks-request
    from: account
    to: account
    action: Follow each quote request from collecting quotes to chosen to completed
requirements:
  - id: req-search
    title: Hero job search with location
    scope: included
  - id: req-services
    title: Popular service categories grid
    scope: included
  - id: req-how-it-works
    title: How FixIt works 3-step explainer
    scope: included
  - id: req-top-pros
    title: Top rated professionals carousel
    scope: included
  - id: req-pro-listing
    title: Filterable list of pros in a category
    scope: included
  - id: req-pro-detail
    title: Pro profile with reviews and photos
    scope: included
  - id: req-trust
    title: "FixIt Trust Score built only on evidence that can be checked: licence confirmed against the state register by a person, insurance certificate reviewed, confirmed completed jobs, median response time, visits that happened, recent reviews and upheld complaints. A professional is never labelled verified until both the licence and the insurance checks have passed."
    scope: included
  - id: req-quote-request
    title: Quote request form routed to matching pros, with photos and a short video attached to the job
    scope: included
  - id: req-request-media
    title: "Photo-first requests: up to eight photos and one short video sent with a job, stored privately and visible only to the customer and the professionals who can see the job"
    scope: included
  - id: req-lead-budget
    title: "An optional budget on the quote request: a band such as Under $250 or $500-$1,000, a typed range, or Not sure. Shown to matching pros so they can judge the job before quoting."
    scope: included
  - id: req-fair-lead
    title: "A fair-lead guarantee: a professional sees the trade, location, budget, photos and description before they commit, can filter leads to the work they want, and is never charged per lead because the subscription is flat"
    scope: included
  - id: req-lead-integrity
    title: Screening that refuses an exact duplicate sent within minutes and flags disposable emails, test text, missing contact details and flood posting. A suspicious request is withheld from professionals until a person clears or confirms it.
    scope: included
  - id: req-lead-disputes
    title: A professional can report a lead as fake, duplicated, out of area, the wrong trade, already done or unreachable; an owner upholds or rejects it and the decision is recorded against the lead
    scope: included
  - id: req-lead-conversion
    title: "Each professional sees their own lead record, counted from their own leads: how many reached them, how many they priced, how many chose them, how many completed, and the quote and win rates"
    scope: included
  - id: req-pro-onboarding
    title: 5-step provider onboarding (account, business, services, area, verify, profile, plan)
    scope: included
  - id: req-leads
    title: Lead inbox with accept flow and estimated value
    scope: included
  - id: req-quotes
    title: Several matching pros each send one itemised price (labour, materials, service call, emergency fee, other), with start date, duration, warranty, payment terms and validity
    scope: included
  - id: req-quote-compare
    title: Homeowners compare every price for one job side by side, with differing rows marked, gaps flagged as questions, and accepting one award the job and close the others
    scope: included
  - id: req-availability
    title: "Live availability: a pro's one-tap pause switch, real available-now and next-opening badges, availability-first ranking, and today/tomorrow/emergency filters"
    scope: included
  - id: req-appointments
    title: Schedule a visit for an accepted lead, with upcoming and past visits
    scope: included
  - id: req-reviews
    title: Recent customer reviews
    scope: included
  - id: req-subscription
    title: "Subscription management: a flat monthly fee with no per-lead charge and no commission (the commission dial exists but is set to zero)"
    scope: included
  - id: req-account
    title: Customer account area with a sign-in prompt
    scope: included
  - id: req-my-requests
    title: Customer's own quote requests with live status
    scope: included
  - id: req-messaging
    title: Customer and professional message thread per job
    scope: included
  - id: req-reviews-write
    title: Signed-in customer leaves a review on a pro profile
    scope: included
  - id: req-admin
    title: Owner dashboard to approve professionals, record licence and insurance verification, and watch requests, reviews, visits and messages
    scope: included
---

# FixIt

FixIt is a two-sided local home-services marketplace. Homeowners describe a job and
receive quotes from trusted local professionals across plumbing, electrical, HVAC,
garage doors, roofing, cleaning and more. Providers join through a guided onboarding
wizard, pick a plan, and manage leads, appointments, reviews and billing from a
dashboard.

A professional is never charged per lead: the subscription is a flat monthly fee and
the commission dial is set to zero. The fair-lead guarantee is therefore about
transparency and control — what a pro knows before they commit, what they can filter
out, and how their own leads convert — rather than refunds.

## Users
- **Homeowners** need a fast, trustworthy way to find and hire a local pro without cold calls.
- **Providers** (plumbers, electricians, HVAC techs, cleaners…) want a steady flow of qualified local leads they can trust.

## Design demonstrates
- The customer landing experience: hero job search, service categories, how it works, top-rated pros.
- The full provider onboarding journey as a 9-card flow (sign up → account type → business info → services → service area → verification → profile → plan → success).
- The provider dashboard: KPI stats, lead inbox with accept actions, service-area map, appointments, reviews, subscription and performance chart.

## Build must implement
- Real search, quote requests, and lead routing with a managed backend.
- Provider auth, onboarding persistence, document upload, plan selection via Stripe Checkout.
- Live dashboard data; the design's numbers are sample fixtures, not real metrics.
- Lead screening, disputes and conversion reporting, all reading real rows.

## Planned for later
- **Pro side in the Android app.** The phone app is customer-only today. A professional
  should sign in on the phone and reach the same dashboard the website offers: dashboard
  stats, leads with accept, messages, jobs and appointments (with the customer's phone,
  email and address), availability, reviews, commissions, plan and profile. The shared
  backend, accounts, tables and rules already support all of it, so no new tables are
  needed; the work is a phone data layer plus the screen, reusing the website's reads.
  Not started.
