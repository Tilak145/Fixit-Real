import { AlertCircle, BadgeCheck, Check, ShieldCheck } from "lucide-react";

import { isVerified, trustScore, TRUST_LEVEL_LABEL, type TrustEvidence } from "@/lib/trust-score";

/** The colour and icon a level gets. Deliberately restrained: no gold medals. */
function levelStyle(level: ReturnType<typeof trustScore>["level"]): string {
  if (level === "highly-trusted") return "bg-[#E6F4EA] text-[#2E9E4F] border-[#BCE3C8]";
  if (level === "established") return "bg-[#E9F1FB] text-[#1565C0] border-[#C3D9F0]";
  if (level === "building") return "bg-[#FFF4E5] text-[#B26A00] border-[#F0DCB6]";
  return "bg-muted text-muted-foreground border-border";
}

/**
 * The trust panel on a professional's profile.
 *
 * It shows the score, then the evidence each point came from, including what is
 * missing. That last part is the point: a homeowner can see that the licence
 * has been checked against the state register, or that it has not, instead of
 * trusting a badge that means nothing. Nothing is displayed as verified unless
 * the evidence behind it exists.
 */
export function TrustPanel({
  evidence,
  now = new Date(),
}: {
  evidence: TrustEvidence | null;
  now?: Date;
}) {
  if (!evidence) {
    // No evidence view means no claim either way, which is the honest state.
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-1 font-display text-lg font-semibold">Trust &amp; checks</h2>
        <p className="text-[13px] text-muted-foreground">
          FixIt has not recorded checks for this professional yet.
        </p>
      </div>
    );
  }

  const result = trustScore(evidence, now);
  const verified = isVerified(evidence);

  return (
    <div className="rounded-xl border border-border bg-card p-6" data-testid="trust-panel">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg font-semibold">Trust &amp; checks</h2>
        <span
          className={
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11.5px] font-bold " +
            levelStyle(result.level)
          }
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          {TRUST_LEVEL_LABEL[result.level]}
        </span>
      </div>

      {/* The score, and the one sentence that keeps it honest. */}
      <div className="mb-4 flex items-end gap-3">
        <span className="font-display text-4xl font-bold tabular-nums leading-none">{result.score}</span>
        <span className="pb-0.5 text-[13px] text-muted-foreground">
          out of 100 · {result.checksPassed} of {result.checksTotal} checks in place
        </span>
      </div>
      <div
        className="mb-5 h-2 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={"Trust score " + result.score + " out of 100"}
      >
        <span
          className="block h-full rounded-full bg-[#2E9E4F]"
          style={{ width: result.score + "%" }}
        />
      </div>

      {/* The badge, only when both checks have actually passed. */}
      {verified ? (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-[#E6F4EA] px-3.5 py-2.5 text-[13px] font-bold text-[#2E9E4F]">
          <BadgeCheck className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          Licence and insurance both checked by FixIt.
        </p>
      ) : (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-muted px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          <span>
            This professional is not marked verified. Approval to list on FixIt is not the same as a
            licence or insurance check, and we only say verified when both have passed.
          </span>
        </p>
      )}

      <dl className="space-y-2.5">
        {result.factors.map((factor) => (
          <div key={factor.key} className="flex items-start gap-3">
            <span
              className={
                "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full " +
                (factor.earned < 0
                  ? "bg-[#FDECEA] text-[#D93025]"
                  : factor.missing
                    ? "bg-muted text-muted-foreground"
                    : "bg-[#E6F4EA] text-[#2E9E4F]")
              }
              aria-hidden="true"
            >
              {factor.missing ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <dt className="text-[13.5px] font-semibold">{factor.label}</dt>
              <dd className="text-[12.5px] text-muted-foreground">{factor.detail}</dd>
            </span>
          </div>
        ))}
      </dl>
    </div>
  );
}
