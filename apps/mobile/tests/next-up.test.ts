import assert from 'node:assert/strict';
import test from 'node:test';
import { nextUpFor } from '../lib/next-up.ts';
import type { BusinessLead } from '../lib/my-business.ts';
import type { Appointment } from '../lib/fixit.ts';

const ME = 'shop-me';
const OTHER = 'shop-other';

function lead(overrides: Partial<BusinessLead>): BusinessLead {
  return {
    id: Math.random().toString(36),
    category_slug: 'plumbing',
    description: 'Leak',
    customer_name: 'Sam',
    city: 'Akron, OH',
    status: 'new',
    claimed_by: null,
    created_at: '2026-11-01T12:00:00Z',
    is_emergency: false,
    quote: null,
    budget_min_cents: null,
    budget_max_cents: null,
    media: [],
    ...overrides,
  };
}

function visit(overrides: Partial<Appointment>): Appointment {
  return {
    id: Math.random().toString(36),
    quote_request_id: 'r1',
    title: 'Plumbing visit',
    customer_name: 'Sam',
    city: 'Akron, OH',
    scheduled_for: '2026-11-02T15:00:00Z',
    status: 'scheduled',
    notes: null,
    ...overrides,
  };
}

// Noon in Ohio on Nov 2, whatever time zone the test machine uses.
const NOW = new Date('2026-11-02T17:00:00Z');
// Visits in local time, built the way the app compares them.
const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0, 0).toISOString();

test('Next up counts today’s visits and picks the next one', () => {
  const result = nextUpFor({
    businessId: ME,
    leads: [],
    appointments: [
      visit({ scheduled_for: at(2, 9) }),
      visit({ scheduled_for: at(2, 23) }),
      visit({ scheduled_for: at(4, 10) }),
      visit({ scheduled_for: at(1, 10) }),
    ],
    now: NOW,
  });
  assert.equal(result.today.length, 2);
  // The next visit is the soonest one still ahead, not the first of the day.
  assert.equal(result.next?.scheduled_for, at(2, 23));
});

test('Next up only counts leads left for this business', () => {
  const result = nextUpFor({
    businessId: ME,
    leads: [
      lead({ is_emergency: true }),
      lead({}),
      lead({ claimed_by: ME }),
      lead({ claimed_by: OTHER, is_emergency: true }),
    ],
    appointments: [],
    now: NOW,
  });
  assert.equal(result.newLeads.length, 2);
  assert.equal(result.emergencies.length, 1);
});

test('Next up counts a sent price until the job is finished or lost', () => {
  const quote = { amount_cents: 24_000 } as BusinessLead['quote'];
  const result = nextUpFor({
    businessId: ME,
    leads: [
      lead({ claimed_by: ME, quote }),
      lead({ claimed_by: ME, quote, status: 'completed' }),
      lead({ claimed_by: ME, quote, status: 'cancelled' }),
      lead({ claimed_by: OTHER, quote }),
      lead({ claimed_by: ME }),
    ],
    appointments: [],
    now: NOW,
  });
  assert.equal(result.openQuotes.length, 1);
});
