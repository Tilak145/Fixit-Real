"use client";

import { useEffect, useRef, useState } from "react";
import { questionsFor, toggleAnswer, cleanAnswers, type JobAnswers } from "@/lib/job-questions";
import { clickedScrollbar, useBodyScrollLock } from "@/components/fixit/use-scroll-lock";

/**
 * Its own popup for the quick questions about a job, shown before the quote
 * form: one question at a time, with tap-to-choose answers. What the customer
 * chooses goes to the request. Every question can be skipped, and closing the
 * popup keeps whatever was chosen so far.
 */
export function JobQuestionsDialog({
  categorySlug,
  serviceName,
  initial,
  onDone,
}: {
  categorySlug: string;
  serviceName: string;
  initial: JobAnswers;
  /** Called with the answers when the customer finishes, skips or closes. */
  onDone: (answers: JobAnswers) => void;
}) {
  const questions = questionsFor(categorySlug);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<JobAnswers>(() => cleanAnswers(categorySlug, initial));
  const boxRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useBodyScrollLock();

  const last = step >= questions.length - 1;
  const question = questions[Math.min(step, questions.length - 1)];

  // The popup opens with focus inside it, and Escape closes it.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDone(answers);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answers, onDone]);

  if (!question) return null;
  const chosen = answers[question.id] ?? [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Questions about your ${serviceName.toLowerCase()} job`}
      data-testid="job-questions-dialog"
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 p-4"
      onMouseDown={(event) => {
        // Grabbing the popup's own scrollbar is not a click on the background.
        if (clickedScrollbar(event)) return;
        if (!boxRef.current?.contains(event.target as Node)) onDone(answers);
      }}
    >
      <div ref={boxRef} className="relative my-auto w-full max-w-[560px] rounded-2xl border border-border bg-card p-6 shadow-2xl sm:p-7">
        <button
          type="button"
          onClick={() => onDone(answers)}
          aria-label="Close and keep my answers"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <span aria-hidden="true">×</span>
        </button>

        <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-primary">
          {serviceName} · question {step + 1} of {questions.length}
        </p>
        <div className="mb-5 flex gap-1.5" aria-hidden="true">
          {questions.map((item, index) => (
            <span
              key={item.id}
              className={"h-1.5 flex-1 rounded-full " + (index <= step ? "bg-primary" : "bg-border")}
            />
          ))}
        </div>

        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mb-1 pr-8 font-display text-[22px] font-semibold leading-snug outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
        >
          {question.label}
        </h2>
        <p className="mb-4 text-[13px] text-muted-foreground">
          {question.kind === "multi" ? "Choose any that apply." : "Choose one."} Skip it if none fit.
        </p>

        <div className="flex flex-wrap gap-2" role="group" aria-label={question.label}>
          {question.options.map((option) => {
            const on = chosen.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={on}
                onClick={() => setAnswers((current) => toggleAnswer(categorySlug, current, question.id, option.id))}
                className={
                  "min-h-[42px] rounded-full border px-4 py-2 text-left text-[14px] font-semibold transition-colors " +
                  (on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground/80 hover:border-primary")
                }
              >
                {on ? <span aria-hidden="true">✓ </span> : null}
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="mt-7 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((current) => current - 1)}
              className="rounded-md px-3 py-2.5 text-sm font-bold text-foreground/70 hover:text-primary"
            >
              ← Back
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onDone({})}
              className="rounded-md px-3 py-2.5 text-sm font-bold text-foreground/60 hover:text-primary"
            >
              Skip these questions
            </button>
          )}
          <button
            type="button"
            data-testid="job-questions-next"
            onClick={() => (last ? onDone(answers) : setStep((current) => current + 1))}
            className="h-[46px] rounded-md bg-accent px-7 font-display text-[15px] font-semibold text-accent-foreground hover:bg-accent/90"
          >
            {last ? "Continue to my request →" : chosen.length > 0 ? "Next →" : "Skip this one →"}
          </button>
        </div>
      </div>
    </div>
  );
}
