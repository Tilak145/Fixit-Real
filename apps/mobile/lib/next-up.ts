import type { Appointment } from './fixit.ts';
import type { BusinessLead } from './my-business.ts';

/**
 * The short version of "where do I start today": visits on the calendar right
 * now, what is waiting to be priced, and prices sent that the homeowner has
 * not answered. Pure, so the same figures can be checked without a screen.
 */
export function nextUpFor(input: {
  businessId: string;
  leads: BusinessLead[];
  appointments: Appointment[];
  now: Date;
}) {
  const { businessId, leads, appointments, now } = input;
  const mine = leads.filter(lead => lead.claimed_by === businessId);
  const scheduled = appointments
    .filter(visit => visit.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime());
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const today = scheduled.filter(visit => {
    const at = new Date(visit.scheduled_for).getTime();
    return at >= startOfToday && at <= endOfToday;
  });
  const next = scheduled.find(visit => new Date(visit.scheduled_for).getTime() >= now.getTime()) ?? scheduled[0] ?? null;
  const openQuotes = mine.filter(
    lead =>
      lead.quote?.amount_cents != null &&
      lead.status !== 'completed' &&
      lead.status !== 'cancelled' &&
      lead.status !== 'lost',
  );
  const newLeads = leads.filter(lead => !lead.claimed_by);
  const emergencies = newLeads.filter(lead => lead.is_emergency);
  return { today, next, openQuotes, newLeads, emergencies };
}
