/**
 * The FixIt trust score, mirrored for the phone.
 *
 * The rules are the same as the website's: a score built only from evidence
 * FixIt can check — a licence confirmed against the state register, an insurance
 * certificate a person opened, jobs confirmed complete, how fast a
 * professional answers, visits that happened, recent reviews, and upheld
 * complaints. Nothing says "verified" without the evidence, and the absence of
 * evidence is shown rather than hidden.
 *
 * Kept free of imports so the arithmetic can be tested directly.
 */

export interface TrustEvidence {
  licenseChecked: boolean;
  insuranceChecked: boolean;
  insuranceOnFile: boolean;
  verifiedJobs: number;
  unverifiedJobs: number;
  medianResponseHours: number | null;
  visitsCompleted: number;
  visitsCancelled: number;
  quotesSent: number;
  reviewCount: number;
  reviewAverage: number;
  lastReviewAt: string | null;
  disputesRaised: number;
  upheldComplaints: number;
  joinedAt: string | null;
}

export type TrustLevel = 'new' | 'building' | 'established' | 'highly-trusted';

export interface TrustFactor {
  key: string;
  label: string;
  earned: number;
  weight: number;
  detail: string;
  missing: boolean;
}

export interface TrustScore {
  score: number;
  level: TrustLevel;
  checksPassed: number;
  checksTotal: number;
  factors: TrustFactor[];
  nextStep: string | null;
}

const REVIEW_FRESH_MONTHS = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function reviewRecencyWeight(lastReviewAt: string | null, now: Date): number {
  if (!lastReviewAt) return 0;
  const at = new Date(lastReviewAt);
  if (Number.isNaN(at.getTime())) return 0;
  const months = (now.getTime() - at.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (months <= REVIEW_FRESH_MONTHS) return 1;
  return clamp(1 - (months - REVIEW_FRESH_MONTHS) / 36, 0.2, 1);
}

/** Whether this professional may carry the "verified" badge at all. */
export function isVerified(evidence: TrustEvidence): boolean {
  return evidence.licenseChecked && evidence.insuranceChecked;
}

export function trustScore(evidence: TrustEvidence, now: Date): TrustScore {
  const factors: TrustFactor[] = [];

  factors.push({
    key: 'license',
    label: 'Licence checked',
    weight: 15,
    earned: evidence.licenseChecked ? 15 : 0,
    missing: !evidence.licenseChecked,
    detail: evidence.licenseChecked
      ? 'Confirmed against the state register by FixIt.'
      : 'Not yet checked against the state register.',
  });
  factors.push({
    key: 'insurance',
    label: 'Insurance checked',
    weight: 15,
    earned: evidence.insuranceChecked ? 15 : 0,
    missing: !evidence.insuranceChecked,
    detail: evidence.insuranceChecked
      ? 'Certificate opened and accepted by FixIt.'
      : evidence.insuranceOnFile
        ? 'Certificate on file, not yet reviewed.'
        : 'No insurance certificate on file.',
  });

  factors.push({
    key: 'jobs',
    label: 'Completed jobs',
    weight: 24,
    earned: clamp(evidence.verifiedJobs * 6, 0, 24),
    missing: evidence.verifiedJobs === 0,
    detail:
      evidence.verifiedJobs > 0
        ? evidence.verifiedJobs +
          (evidence.verifiedJobs === 1 ? ' completed job' : ' completed jobs') +
          ' confirmed by FixIt.' +
          (evidence.unverifiedJobs > 0 ? ' ' + evidence.unverifiedJobs + ' more await confirmation.' : '')
        : evidence.unverifiedJobs > 0
          ? evidence.unverifiedJobs + ' job(s) reported, not yet confirmed.'
          : 'No completed jobs on FixIt yet.',
  });

  const cancelPenalty = clamp(evidence.visitsCancelled * 2, 0, 6);
  factors.push({
    key: 'visits',
    label: 'Turned up',
    weight: 6,
    earned: clamp(clamp(evidence.visitsCompleted * 3, 0, 6) - cancelPenalty, 0, 6),
    missing: evidence.visitsCompleted === 0,
    detail:
      evidence.visitsCompleted > 0
        ? evidence.visitsCompleted +
          (evidence.visitsCompleted === 1 ? ' booked visit' : ' booked visits') +
          ' completed' +
          (evidence.visitsCancelled > 0 ? ', ' + evidence.visitsCancelled + ' cancelled.' : '.')
        : 'No visits completed yet.',
  });

  const responsePoints =
    evidence.medianResponseHours === null
      ? 0
      : evidence.medianResponseHours <= 2
        ? 15
        : evidence.medianResponseHours <= 6
          ? 12
          : evidence.medianResponseHours <= 24
            ? 8
            : 4;
  factors.push({
    key: 'response',
    label: 'Answers quickly',
    weight: 15,
    earned: responsePoints,
    missing: evidence.medianResponseHours === null,
    detail:
      evidence.medianResponseHours === null
        ? 'Has not answered a job yet.'
        : 'Usually answers within ' +
          (evidence.medianResponseHours < 1
            ? 'an hour'
            : evidence.medianResponseHours === 1
              ? 'an hour'
              : Math.round(evidence.medianResponseHours) + ' hours') +
          '.',
  });

  const recency = reviewRecencyWeight(evidence.lastReviewAt, now);
  const reviewWeight = 25;
  const ratingPoints =
    evidence.reviewCount === 0 ? 0 : clamp((evidence.reviewAverage / 5) * reviewWeight, 0, reviewWeight);
  factors.push({
    key: 'reviews',
    label: 'Customer reviews',
    weight: 25,
    earned: Math.round(ratingPoints * recency * 10) / 10,
    missing: evidence.reviewCount === 0,
    detail:
      evidence.reviewCount === 0
        ? 'No reviews yet.'
        : evidence.reviewAverage.toFixed(1) +
          ' from ' +
          evidence.reviewCount +
          (evidence.reviewCount === 1 ? ' review' : ' reviews') +
          (recency < 1 ? ', and the newest is getting old.' : '.'),
  });

  const complaintPenalty = clamp(evidence.upheldComplaints * 8, 0, 24);
  if (complaintPenalty > 0) {
    factors.push({
      key: 'complaints',
      label: 'Upheld complaints',
      weight: 0,
      earned: -complaintPenalty,
      missing: false,
      detail:
        evidence.upheldComplaints +
        (evidence.upheldComplaints === 1 ? ' complaint' : ' complaints') +
        ' upheld by FixIt.',
    });
  }

  const rawScore = factors.reduce((total, factor) => total + factor.earned, 0);
  const score = clamp(Math.round(rawScore), 0, 100);
  const level: TrustLevel =
    score >= 80 ? 'highly-trusted' : score >= 55 ? 'established' : score > 0 ? 'building' : 'new';

  const checksPassed =
    (evidence.licenseChecked ? 1 : 0) +
    (evidence.insuranceChecked ? 1 : 0) +
    (evidence.verifiedJobs > 0 ? 1 : 0) +
    (evidence.medianResponseHours !== null ? 1 : 0) +
    (evidence.visitsCompleted > 0 ? 1 : 0) +
    (evidence.reviewCount > 0 ? 1 : 0);

  const nextStep = !evidence.licenseChecked
    ? 'Confirm the licence against the state register.'
    : evidence.insuranceChecked
      ? evidence.verifiedJobs === 0
        ? 'Complete a job through FixIt to build a record.'
        : null
      : evidence.insuranceOnFile
        ? 'Have the insurance certificate reviewed.'
        : 'Upload the insurance certificate.';

  return { score, level, checksPassed, checksTotal: 6, factors, nextStep };
}

export const TRUST_LEVEL_LABEL: Record<TrustLevel, string> = {
  new: 'New to FixIt',
  building: 'Building a record',
  established: 'Established',
  'highly-trusted': 'Highly trusted',
};
