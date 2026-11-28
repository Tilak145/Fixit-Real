// The few building blocks the property dashboard shares.

export const field =
  "mt-1 h-11 w-full rounded-lg border border-[#D8DFEA] bg-white px-3 text-[14px] font-normal outline-none focus:border-[#F26B1D] focus:ring-2 focus:ring-[#F26B1D]/30";

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-[#D9560B] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[#C14B08] disabled:opacity-60";

export const quietButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#C9D3E3] bg-white px-3 py-2 text-[13px] font-bold text-[#33466B] hover:bg-[#F3F6FB] disabled:opacity-60";

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-[#E4E9F1] bg-white p-5 shadow-sm">
      <h2 className="mb-3 font-display text-[18px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function Loading({ label }: { label: string }) {
  return <p role="status" className="p-8 text-center text-[14px] text-[#475569]">{label}</p>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-[#F3B9B5] bg-[#FFF6F5] p-6 text-center">
      <p className="mb-3 text-[14px] text-[#B42318]">{message}</p>
      <button type="button" onClick={onRetry} className={quietButton}>Try again</button>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#C9D3E3] bg-white p-8 text-center">
      <p className="font-display text-[17px] font-bold">{title}</p>
      <p className="mt-1 text-[14px] text-[#475569]">{body}</p>
    </div>
  );
}
