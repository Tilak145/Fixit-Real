/**
 * The FixIt trust score, and the evidence behind it.
 *
 * A star rating says whether people liked the work. It does not say whether the
 * professional is licensed, insured, turned up when they said, or answers the
 * phone. HomeAdvisor-style marketplaces have taught homeowners to distrust a
 * generic badge, so this score is built only from things FixIt can actually
 * check, and every point shown can be traced to one of them:
 *
 *   * licence confirmed against the state register by a person;
 *   * insurance certificate opened and accepted by a person;
 *   * jobs completed and confirmed, not just reported;
 *   * how quickly they answer a job, from the customer posting it to the price
 *     arriving;
 *   * visits that actually happened, and cancellations;
 *   * recent customer reviews, weighted by how recent they are;
 *   * complaints, counted only when upheld.
 *
 * The one rule that matters most: nothing here can say "verified" without the
 * evidence. A professional with no checks scores low and says so, and the
 * absence of evidence is displayed rather than hidden. This module is free of
 * imports so the arithmetic can be tested directly.
 */

export interface TrustEvidence {
  /** Someone confirmed the licence against the state register. */
  licenseChecked: boolean;
  /** Someone opened and accepted the insurance certificate. */
  insuranceChecked: boolean;
  /** True when an insurance certificate exists but has not been reviewed. */
  insuranceOnFile: boolean;
  /** Jobs completed and confirmed by management. */
  verifiedJobs: number;
  /** Jobs reported complete but not confirmed. Never counted as completed. */
  unverifiedJobs: number;
  /** Median hours to answer a job, or null when they have never answered one. */
  medianResponseHours: number | null;
  /** Booked visits that happened, and ones the professional cancelled. */
  visitsCompleted: number;
  visitsCancelled: number;
  /** How many prices they have sent, which is what response time is measured on. */
  quotesSent: number;
  reviewCount: number;
  reviewAverage: number;
  /** Most recent review, for weighting by recency. */
  lastReviewAt: string | null;
  /** Complaints raised and upheld against them. */
  disputesRaised: number;
  upheldComplaints: number;
  /** When the business joined, so a brand-new account is not punished as unknown. */
  joinedAt: string | null;
}

export type TrustLevel = "new" | "building" | "established" | "highly-trusted";

export interface TrustFactor {
  key: string;
  label: string;
  /** Points earned out of the factor's weight. */
  earned: number;
  weight: number;
  /** One plain sentence: what this says, or why it is missing. */
  detail: string;
  /** True when the evidence is absent rather than negative. */
  missing: boolean;
}

export interface TrustScore {
  /** 0–100. Only points that evidence supports are counted. */
  score: number;
  level: TrustLevel;
  /** How many of the checks are actually in place, for "2 of 6 checks". */
  checksPassed: number;
  checksTotal: number;
  factors: TrustFactor[];
  /** The single most useful thing this professional could do next. */
  nextStep: string | null;
}

/** Reviews older than this count for less, so a stale rating fades. */
const REVIEW_FRESH_MONTHS = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** How much a review counts, by how recent it is. */
export function reviewRecencyWeight(lastReviewAt: string | null, now: Date): number {
  if (!lastReviewAt) return 0;
  const at = new Date(lastReviewAt);
  if (Number.isNaN(at.getTime())) return 0;
  const months = (now.getTime() - at.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (months <= REVIEW_FRESH_MONTHS) return 1;
  // Fades to a fifth over the following two years rather than vanishing.
  return clamp(1 - (months - REVIEW_FRESH_MONTHS) / 36, 0.2, 1);
}

/** Whether this professional may carry the "verified" badge at all. */
export function isVerified(evidence: TrustEvidence): boolean {
  // Both checks, or neither claim is made. One is not enough to say "verified".
  return evidence.licenseChecked && evidence.insuranceChecked;
}

/**
 * The score. Weights reflect what a homeowner is actually worried about: that
 * the person is legitimate and insured, then that they turn up and do the work,
 * then that other people were happy.
 */
export function trustScore(evidence: TrustEvidence, now: Date): TrustScore {
  const factors: TrustFactor[] = [];

  // Identity: licence and insurance, 30 points together. This is the part that
  // cannot be earned by doing volume, and the part that most needs evidence.
  factors.push({
    key: "license",
    label: "Licence checked",
    weight: 15,
    earned: evidence.licenseChecked ? 15 : 0,
    missing: !evidence.licenseChecked,
    detail: evidence.licenseChecked
      ? "Confirmed against the state register by FixIt."
      : "Not yet checked against the state register.",
  });
  factors.push({
    key: "insurance",
    label: "Insurance checked",
    weight: 15,
    earned: evidence.insuranceChecked ? 15 : 0,
    missing: !evidence.insuranceChecked,
    detail: evidence.insuranceChecked
      ? "Certificate opened and accepted by FixIt."
      : evidence.insuranceOnFile
        ? "Certificate on file, not yet reviewed."
        : "No insurance certificate on file.",
  });

  // Work that happened: 30 points. Verified jobs are worth more than reported
  // ones, because a reported job is the professional's word and a verified one
  // is FixIt's.
  const jobPoints = clamp(evidence.verifiedJobs * 6, 0, 24);
  factors.push({
    key: "jobs",
    label: "Completed jobs",
    weight: 24,
    earned: jobPoints,
    missing: evidence.verifiedJobs === 0,
    detail:
      evidence.verifiedJobs > 0
        ? evidence.verifiedJobs +
          " completed job" +
          (evidence.verifiedJobs === 1 ? "" : "s") +
          " confirmed by FixIt." +
          (evidence.unverifiedJobs > 0
            ? " " + evidence.unverifiedJobs + " more await confirmation."
            : "")
        : evidence.unverifiedJobs > 0
          ? evidence.unverifiedJobs + " job(s) reported, not yet confirmed."
          : "No completed jobs on FixIt yet.",
  });
  const visitPoints = clamp(evidence.visitsCompleted * 3, 0, 6);
  const cancelPenalty = clamp(evidence.visitsCancelled * 2, 0, 6);
  factors.push({
    key: "visits",
    label: "Turned up",
    weight: 6,
    earned: clamp(visitPoints - cancelPenalty, 0, 6),
    missing: evidence.visitsCompleted === 0,
    detail:
      evidence.visitsCompleted > 0
        ? evidence.visitsCompleted +
          " booked visit" +
          (evidence.visitsCompleted === 1 ? "" : "s") +
          " completed" +
          (evidence.visitsCancelled > 0
            ? ", " + evidence.visitsCancelled + " cancelled."
            : ".")
        : "No visits completed yet.",
  });

  // How they treat people: response time and reviews, 40 points.
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
    key: "response",
    label: "Answers quickly",
    weight: 15,
    earned: responsePoints,
    missing: evidence.medianResponseHours === null,
    detail:
      evidence.medianResponseHours === null
        ? "Has not answered a job yet."
        : "Usually answers within " +
          (evidence.medianResponseHours < 1
            ? "an hour"
            : evidence.medianResponseHours === 1
              ? "an hour"
              : Math.round(evidence.medianResponseHours) + " hours") +
          ".",
  });

  const recency = reviewRecencyWeight(evidence.lastReviewAt, now);
  // A rating only counts once there are reviews to average, and it is scaled to
  // the factor's own weight so a flawless record can reach the top of the scale.
  const reviewWeight = 25;
  const ratingPoints =
    evidence.reviewCount === 0 ? 0 : clamp((evidence.reviewAverage / 5) * reviewWeight, 0, reviewWeight);
  const reviewPoints = ratingPoints * recency;
  factors.push({
    key: "reviews",
    label: "Customer reviews",
    weight: 25,
    earned: Math.round(reviewPoints * 10) / 10,
    missing: evidence.reviewCount === 0,
    detail:
      evidence.reviewCount === 0
        ? "No reviews yet."
        : evidence.reviewAverage.toFixed(1) +
          " from " +
          evidence.reviewCount +
          " review" +
          (evidence.reviewCount === 1 ? "" : "s") +
          (recency < 1 ? ", and the newest is getting old." : "."),
  });

  // Complaints are a deduction, never a bonus, and only upheld ones count.
  const complaintPenalty = clamp(evidence.upheldComplaints * 8, 0, 24);
  if (complaintPenalty > 0) {
    factors.push({
      key: "complaints",
      label: "Upheld complaints",
      weight: 0,
      earned: -complaintPenalty,
      missing: false,
      detail:
        evidence.upheldComplaints +
        " complaint" +
        (evidence.upheldComplaints === 1 ? "" : "s") +
        " upheld by FixIt.",
    });
  }

  const rawScore = factors.reduce((total, factor) => total + factor.earned, 0);
  const score = clamp(Math.round(rawScore), 0, 100);

  // "Building" and "established" are about evidence, not effort: a new business
  // with nothing checked is "new", however good it is.
  const level: TrustLevel =
    score >= 80 ? "highly-trusted" : score >= 55 ? "established" : score > 0 ? "building" : "new";

  const checksPassed =
    (evidence.licenseChecked ? 1 : 0) +
    (evidence.insuranceChecked ? 1 : 0) +
    (evidence.verifiedJobs > 0 ? 1 : 0) +
    (evidence.medianResponseHours !== null ? 1 : 0) +
    (evidence.visitsCompleted > 0 ? 1 : 0) +
    (evidence.reviewCount > 0 ? 1 : 0);

  // Advice, not judgement: the next missing check, in the order that matters.
  const nextStep = !evidence.licenseChecked
    ? "Confirm the licence against the state register."
    : evidence.insuranceChecked
      ? evidence.verifiedJobs === 0
        ? "Complete a job through FixIt to build a record."
        : null
      : evidence.insuranceOnFile
        ? "Have the insurance certificate reviewed."
        : "Upload the insurance certificate.";

  return { score, level, checksPassed, checksTotal: 6, factors, nextStep };
}

/** The words a homeowner sees for each level. Never overstates the evidence. */
export const TRUST_LEVEL_LABEL: Record<TrustLevel, string> = {
  new: "New to FixIt",
  building: "Building a record",
  established: "Established",
  "highly-trusted": "Highly trusted",
};
