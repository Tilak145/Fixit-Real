"use client";

import { SITE_EMAIL } from "@/lib/site-contact";

// Route-level crash containment. A thrown error in a page or server component
// must render a card a visitor can act on instead of a blank 500. Styles stay
// inline so the card renders coherently even when global styles are unavailable.

const errorCss = `
  .spk-error-root {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background-color: #f6f5f1;
    background-image: radial-gradient(120% 85% at 50% 40%, #f7f6f2 0%, #f4f3ed 100%);
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", "Microsoft YaHei", "Segoe UI", sans-serif;
    color: #1c1a17;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  .spk-error-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 24px;
    max-width: 560px;
  }

  .spk-error-heading {
    margin: 0;
    font-size: 22px;
    line-height: 1.4;
    font-weight: 600;
    color: #1c1a17;
  }

  .spk-error-detail {
    margin: 14px 0 0;
    font-size: 13px;
    line-height: 1.6;
    color: #6f6a61;
    max-height: 160px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    background: rgba(28, 26, 23, 0.045);
    border-radius: 10px;
    padding: 10px 14px;
  }

  .spk-error-digest {
    margin: 10px 0 0;
    font-size: 11px;
    color: #9b968c;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .spk-error-retry {
    margin-top: 18px;
    padding: 8px 20px;
    font-size: 13px;
    font-weight: 600;
    color: #f7f6f2;
    background: #1c1a17;
    border: none;
    border-radius: 999px;
    cursor: pointer;
  }

  .spk-error-retry:hover {
    opacity: 0.88;
  }

  .spk-error-hint {
    margin: 16px 0 0;
    font-size: 12px;
    color: #9b968c;
  }
`;

export default function ErrorBoundary(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { error, reset } = props;
  return (
    <main className="spk-error-root" role="alert">
      <style>{errorCss}</style>
      <div className="spk-error-stack">
        <h1 className="spk-error-heading">Something went wrong on our side</h1>
        <p className="spk-error-detail">
          This page could not load. Nothing you entered has been shared. Please try again in a moment.
        </p>
        {error.digest ? (
          <p className="spk-error-digest">Reference: {error.digest}</p>
        ) : null}
        <button type="button" className="spk-error-retry" onClick={() => reset()}>
          Try again
        </button>
        <p className="spk-error-hint">
          <a href="/">Go to the home page</a> or email <a href={`mailto:${SITE_EMAIL}`}>{SITE_EMAIL}</a>.
        </p>
      </div>
    </main>
  );
}
