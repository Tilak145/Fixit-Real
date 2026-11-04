"use client";

import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PAID_PLANS } from "@/features/plans";
import { SITE_HOST as SITE, SITE_URL } from "@/lib/site-contact";

const CUSTOMER_POINTS = [
  { title: "Tell us what needs fixing", text: "Describe the problem, add a photo or short video, and say how urgent it is — water everywhere counts as an emergency." },
  { title: "Compare real quotes", text: "See labour, materials, service call and emergency fees, the start date, the warranty and the payment terms side by side." },
  { title: "Emergency help, fast", text: "Mark a leak or a burst pipe as an emergency and we find the nearest available crew for that trade." },
  { title: "Know who you are hiring", text: "Business registration, licence checks, real customer reviews and the job history behind them, not just stars." },
  { title: "One place for the whole job", text: "Quotes, messages, photos, the appointment and the finished job stay together in your account." },
  { title: "Your details stay private", text: "Your phone and address reach the professional only once you accept their quote and the job is agreed." },
];

const SERVICES = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Garage Doors",
  "Roofing",
  "Appliance Repair",
  "Handyman",
  "Cleaning",
  "Pest Control",
  "Landscaping",
  "Painting",
  "Other",
];

const PRO_POINTS = [
  { title: "Free for the first three months", text: "The first 100 Founding Pros pay nothing for three months. After that: Starter $99, Professional $199, Business $399 a month." },
  { title: "Leads that fit your trade", text: "Requests arrive by service and city, with photos, the problem and a budget range — so you know what you are quoting before you spend time on it." },
  { title: "Your own dashboard", text: "Logo, profile, service area, availability calendar, quoting, appointments, messages and job records in one place." },
  { title: "Fair lead rules", text: "Every lead is counted once. Dispute a lead that is fake or was not yours, see how many become quotes and completed jobs." },
  { title: "Show customers you are real", text: "Add your Ohio business registration and licence. Customers see what has actually been checked, never an unearned 'verified' badge." },
  { title: "Your own nine-digit number", text: "Every business gets a permanent FixIt business number you can give over the phone; every customer gets a six-digit one." },
];

const STEPS = [
  { n: "1", title: "Tell us the job", text: "Photo, address, urgency." },
  { n: "2", title: "Compare quotes", text: "Clear prices, side by side." },
  { n: "3", title: "Get it done", text: "Book, chat, finish, review." },
];

/** How many cities and services each paid plan includes, for the price strip. */
const PLAN_DETAIL: Record<string, string> = {
  starter: "1 city · 2 services",
  professional: "5 cities · first look",
  business: "Top placement · unlimited",
};

function FixItMark({ dark = false }: { dark?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="40" height="34" viewBox="0 0 40 34" aria-hidden="true">
        <path d="M20 1 2 16h6v17h24V16h6z" fill={dark ? "#4D8FE0" : "#1565C0"} />
        <circle cx="20" cy="17" r="10" fill={dark ? "#0D2C54" : "#FFFFFF"} />
        <path
          d="M25.5 11.5a7 7 0 1 0 3 7.5l-4-1a3 3 0 1 1-2-3.5z"
          fill={dark ? "#F59A3D" : "#F57C00"}
        />
      </svg>
      <span>
        <span className={`block font-display text-[26px] font-bold leading-none ${dark ? "text-white" : "text-secondary"}`}>
          Fix<span className="text-accent">It</span>
        </span>
        <span className={`block text-[11px] font-bold tracking-[0.22em] ${dark ? "text-[#4D8FE0]" : "text-primary"}`}>
          LOCAL SERVICES
        </span>
      </span>
    </span>
  );
}

function Pill({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "dark" }) {
  return (
    <span
      className={
        tone === "dark"
          ? "inline-flex items-center rounded-full border border-white/25 px-3 py-1 text-[12px] font-semibold text-white"
          : "inline-flex items-center rounded-full border border-[#C6DBF4] bg-[#E9F1FB] px-3 py-1 text-[12px] font-semibold text-[#1565C0]"
      }
    >
      {children}
    </span>
  );
}

function Point({ title, text, dark = false }: { title: string; text: string; dark?: boolean }) {
  return (
    <li className="flex gap-2.5">
      <span
        className={`mt-[7px] h-2 w-2 flex-none rounded-full ${dark ? "bg-accent" : "bg-primary"}`}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <strong className={`block text-[13.5px] font-bold ${dark ? "text-white" : "text-secondary"}`}>{title}</strong>
        <span className={`block text-[12.5px] leading-[1.5] ${dark ? "text-[#B9C8DC]" : "text-[#4A5A70]"}`}>
          {text}
        </span>
      </span>
    </li>
  );
}


/** Colours from the site's own design tokens, so the image matches the page. */
const INK = {
  navy: "#0D2C54",
  deep: "#0A2244",
  blue: "#1565C0",
  orange: "#F57C00",
  paper: "#FFFFFF",
  ground: "#F5F7FA",
  line: "#DCE4EE",
  body: "#4A5A70",
  soft: "#B9C8DC",
  softBlue: "#A7BBD3",
  chip: "#EEF2F7",
};

const HEADING_FONT = '"Poppins", "Segoe UI", sans-serif';
const BODY_FONT = '"Nunito Sans", "Segoe UI", sans-serif';

/** A canvas sized for letter paper at 96 dpi, doubled for a crisp photo. */
function blankSheet(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = 816 * 2;
  canvas.height = 1056 * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.scale(2, 2);
  ctx.fillStyle = INK.paper;
  ctx.fillRect(0, 0, 816, 1056);
  return { canvas, ctx };
}

/**
 * Draws the same one-page flyer onto a canvas, for sharing on a phone.
 * It uses the same words and plan prices as the printed sheet above.
 */
function drawFlyer(): HTMLCanvasElement {
  const { canvas, ctx } = blankSheet();
  const W = 816;
  const pad = 56;
  const right = W - pad;
  let y = 0;

  const font = (weight: number | string, size: number, family = BODY_FONT) => `${weight} ${size}px ${family}`;
  const text = (value: string, x: number, at: number, maxWidth: number, color: string, f: string, lineHeight: number) => {
    ctx.font = f;
    ctx.fillStyle = color;
    const words = value.split(/\s+/);
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        ctx.fillText(line, x, at);
        at += lineHeight;
        line = word;
      } else {
        line = next;
      }
    }
    if (line) {
      ctx.fillText(line, x, at);
      at += lineHeight;
    }
    return at;
  };
  const bullet = (title: string, body: string, x: number, at: number, width: number) => {
    ctx.beginPath();
    ctx.arc(x + 4, at - 4, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = INK.orange;
    ctx.fill();
    ctx.font = font(700, 13.5);
    ctx.fillStyle = INK.navy;
    ctx.fillText(title, x + 16, at);
    return text(body, x + 16, at + 17, width - 16, INK.body, font(400, 12.5), 16);
  };

  // Header
  const headerHeight = 250;
  ctx.fillStyle = INK.navy;
  ctx.fillRect(0, 0, W, headerHeight);
  // The FixIt mark: a blue roof over a white disc and an orange wrench hook.
  ctx.fillStyle = "#4D8FE0";
  ctx.beginPath();
  ctx.moveTo(pad + 20, 24); ctx.lineTo(pad - 4, 46); ctx.lineTo(pad + 6, 46);
  ctx.lineTo(pad + 6, 66); ctx.lineTo(pad + 34, 66); ctx.lineTo(pad + 34, 46);
  ctx.lineTo(pad + 44, 46); ctx.closePath();
  ctx.fill();
  ctx.beginPath(); ctx.arc(pad + 20, 48, 11, 0, Math.PI * 2); ctx.fillStyle = INK.navy; ctx.fill();
  ctx.beginPath(); ctx.arc(pad + 20, 48, 5, 0.6, 5.2); ctx.strokeStyle = INK.orange; ctx.lineWidth = 3; ctx.stroke();
  ctx.font = font(700, 27, HEADING_FONT);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("Fix", pad + 54, 46);
  const fixWidth = ctx.measureText("Fix").width;
  ctx.fillStyle = "#F59A3D";
  ctx.fillText("It", pad + 54 + fixWidth, 46);
  ctx.font = font(700, 10);
  ctx.fillStyle = "#4D8FE0";
  ctx.fillText("L O C A L   S E R V I C E S", pad + 54, 60);

  text("Akron home repairs,", pad, 100, 430, "#FFFFFF", font(600, 27, HEADING_FONT), 31);
  text("judged on the job, not the ad.", pad, 131, 430, "#F59A3D", font(600, 27, HEADING_FONT), 31);
  text(
    "One place to describe what is broken, compare written quotes from local professionals, and keep the whole job together.",
    pad, 176, 430, INK.soft, font(400, 12.5), 17,
  );
  ctx.font = font(700, 11);
  ctx.fillStyle = INK.softBlue;
  ctx.textAlign = "right";
  ctx.fillText("VISIT US", right, 44);
  ctx.font = font(600, 12, "ui-monospace, monospace");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(SITE, right, 62);
  ctx.textAlign = "left";

  // Strip of what is included
  ctx.fillStyle = INK.deep;
  ctx.fillRect(0, headerHeight, W, 34);
  let chipX = pad;
  for (const chip of ["Akron, OH & nearby towns", "Free to ask & compare", "Emergency plumbing, electrical & HVAC"]) {
    ctx.font = font(600, 12);
    const width = ctx.measureText(chip).width + 22;
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(chipX, headerHeight + 7, width, 20, 10);
    ctx.stroke();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(chip, chipX + 11, headerHeight + 21);
    chipX += width + 8;
  }
  y = headerHeight + 34 + 26;

  // Three steps
  const stepWidth = (W - pad * 2 - 24) / 3;
  STEPS.forEach((step, index) => {
    const x = pad + index * (stepWidth + 12);
    ctx.fillStyle = INK.ground;
    ctx.strokeStyle = INK.line;
    ctx.beginPath();
    ctx.roundRect(x, y, stepWidth, 52, 8);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 20, y + 22, 10, 0, Math.PI * 2);
    ctx.fillStyle = INK.blue;
    ctx.fill();
    ctx.font = font(700, 12);
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center";
    ctx.fillText(step.n, x + 20, y + 26);
    ctx.textAlign = "left";
    ctx.font = font(700, 13);
    ctx.fillStyle = INK.navy;
    ctx.fillText(step.title, x + 36, y + 20);
    ctx.font = font(400, 12);
    ctx.fillStyle = "#5A6B80";
    ctx.fillText(step.text, x + 36, y + 37);
  });
  y += 52 + 24;

  // Homeowners
  ctx.font = font(600, 17, HEADING_FONT);
  ctx.fillStyle = INK.navy;
  ctx.fillText("For homeowners", pad, y);
  ctx.font = font(600, 12);
  ctx.fillStyle = INK.blue;
  ctx.textAlign = "right";
  ctx.fillText("Free to use · no obligation to hire", right, y);
  ctx.textAlign = "left";
  y += 20;
  const colWidth = (W - pad * 2 - 28) / 2;
  CUSTOMER_POINTS.forEach((point, index) => {
    const x = pad + (index % 2) * (colWidth + 28);
    const columnY = y + Math.floor(index / 2) * 62;
    bullet(point.title, point.text, x, columnY, colWidth);
  });
  y += 3 * 62 + 10;

  // Services
  ctx.fillStyle = INK.paper;
  ctx.strokeStyle = INK.line;
  ctx.beginPath();
  ctx.roundRect(pad, y, W - pad * 2, 92, 8);
  ctx.fill();
  ctx.stroke();
  ctx.font = font(700, 11);
  ctx.fillStyle = "#5A6B80";
  ctx.fillText("JOBS WE TAKE", pad + 16, y + 22);
  let tagX = pad + 16;
  let tagY = y + 34;
  for (const service of SERVICES) {
    ctx.font = font(600, 12);
    const width = ctx.measureText(service).width + 16;
    if (tagX + width > right - 16) {
      tagX = pad + 16;
      tagY += 22;
    }
    ctx.fillStyle = INK.chip;
    ctx.beginPath();
    ctx.roundRect(tagX, tagY - 13, width, 20, 4);
    ctx.fill();
    ctx.fillStyle = INK.navy;
    ctx.fillText(service, tagX + 8, tagY + 1);
    tagX += width + 6;
  }
  text(
    "Some trades are still filling up. Ask anyway — your request is kept and reaches the first professional who joins for it.",
    pad + 16, tagY + 26, W - pad * 2 - 32, "#5A6B80", font(400, 11.5), 15,
  );
  y += 92 + 18;

  // Professionals
  const proHeight = 272;
  ctx.fillStyle = INK.navy;
  ctx.beginPath();
  ctx.roundRect(pad, y, W - pad * 2, proHeight, 8);
  ctx.fill();
  ctx.font = font(600, 17, HEADING_FONT);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("For local professionals", pad + 20, y + 30);
  const badge = "First 100 pros: 3 months free";
  ctx.font = font(700, 11.5);
  const badgeWidth = ctx.measureText(badge).width + 24;
  ctx.fillStyle = INK.orange;
  ctx.beginPath();
  ctx.roundRect(right - 20 - badgeWidth, y + 14, badgeWidth, 24, 12);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(badge, right - 20 - badgeWidth + 12, y + 30);
  const proCol = (W - pad * 2 - 40 - 24) / 2;
  PRO_POINTS.forEach((point, index) => {
    const x = pad + 20 + (index % 2) * (proCol + 24);
    const columnY = y + 58 + Math.floor(index / 2) * 54;
    ctx.beginPath();
    ctx.arc(x + 4, columnY - 4, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#F59A3D";
    ctx.fill();
    ctx.font = font(700, 13.5);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(point.title, x + 16, columnY);
    text(point.text, x + 16, columnY + 16, proCol - 16, INK.soft, font(400, 12), 15);
  });
  // Plan prices, read from the same list the site uses.
  const planY = y + 176;
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.beginPath();
  ctx.roundRect(pad + 20, planY, W - pad * 2 - 40, 52, 6);
  ctx.stroke();
  const planWidth = (W - pad * 2 - 40) / 3;
  PAID_PLANS.forEach((plan, index) => {
    const x = pad + 32 + index * planWidth;
    ctx.font = font(700, 11);
    ctx.fillStyle = INK.softBlue;
    ctx.fillText(plan.label.toUpperCase(), x, planY + 18);
    ctx.font = font(600, 16, HEADING_FONT);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`$${plan.price}`, x, planY + 35);
    const priceWidth = ctx.measureText(`$${plan.price}`).width;
    ctx.font = font(400, 11);
    ctx.fillStyle = INK.soft;
    ctx.fillText(" /mo", x + priceWidth, planY + 35);
    ctx.fillStyle = INK.soft;
    ctx.fillText(PLAN_DETAIL[plan.key] ?? "", x, planY + 48);
  });
  y += proHeight + 16;

  // Footer
  ctx.fillStyle = INK.ground;
  ctx.fillRect(0, y, W, 62);
  ctx.font = font(700, 11);
  ctx.fillStyle = "#5A6B80";
  ctx.fillText("NEED A REPAIR?", pad, y + 22);
  ctx.font = font(600, 15, HEADING_FONT);
  ctx.fillStyle = INK.navy;
  ctx.fillText("Start at", pad, y + 42);
  const startWidth = ctx.measureText("Start at ").width;
  ctx.fillStyle = INK.blue;
  ctx.fillText(SITE, pad + startWidth, y + 42);
  ctx.textAlign = "right";
  ctx.font = font(700, 11);
  ctx.fillStyle = "#5A6B80";
  ctx.fillText("SERVING", right, y + 22);
  ctx.font = font(600, 12);
  ctx.fillStyle = INK.navy;
  ctx.fillText("Akron, OH", right, y + 40);
  ctx.textAlign = "left";

  text(
    "Licences and business registrations are shown only once checked. Finding a professional and comparing quotes is free; you pay the professional you hire. Plan prices in US dollars per month after any free period.",
    pad, y + 82, W - pad * 2, "#5A6B80", font(400, 11), 14,
  );
  return canvas;
}

/**
 * One US-letter sheet that says, in the site's own words, what FixIt does for
 * homeowners and what it offers a local professional. It prints on paper and
 * saves as a PNG for sharing on a phone.
 */
export function FlyerPage() {
  const [saving, setSaving] = useState(false);

  async function saveImage() {
    setSaving(true);
    try {
      const canvas = drawFlyer();
      const link = document.createElement("a");
      link.download = "fixit-flyer.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Saved as fixit-flyer.png");
    } catch {
      toast.error("The image could not be made in this browser. Use Print and choose “Save as PDF” instead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#E4EAF2] px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto flex max-w-[8.5in] flex-wrap items-center justify-between gap-3 pb-4 print:hidden">
        <p className="text-sm text-[#4A5A70]">
          A one-page flyer for the fixit site. Print it on letter paper, or save it as an image to text or post.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void saveImage()} disabled={saving}>
            <Download className="h-4 w-4" aria-hidden="true" />
            {saving ? "Making image…" : "Save as image"}
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden="true" />
            Print flyer
          </Button>
        </div>
      </div>

      <article
        id="fixit-flyer"
        className="flyer-sheet mx-auto flex w-full max-w-[8.5in] flex-col overflow-hidden rounded-xl bg-white shadow-xl print:max-w-none print:rounded-none print:shadow-none"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-4 bg-secondary px-7 pt-5 pb-4 text-white">
          <div>
            <FixItMark dark />
            <p className="mt-2.5 font-display text-[25px] font-semibold leading-[1.15]">
              Akron home repairs,
              <br />
              <span className="text-accent">judged on the job, not the ad.</span>
            </p>
            <p className="mt-1.5 max-w-[6.2in] text-[12px] leading-[1.45] text-[#B9C8DC]">
              One place to describe what is broken, compare written quotes from local professionals, and keep the whole job together.
            </p>
          </div>
        </header>
        <div className="flex flex-wrap gap-2 bg-[#0A2244] px-7 py-2.5">
          <Pill tone="dark">Akron, OH &amp; nearby towns</Pill>
          <Pill tone="dark">Free to ask &amp; compare</Pill>
          <Pill tone="dark">Emergency plumbing, electrical &amp; HVAC</Pill>
          <span className="ml-auto self-center font-mono text-[12px] font-semibold text-white">{SITE}</span>
        </div>

        {/* How it works */}
        <section className="grid grid-cols-3 gap-3 px-7 pt-4">
          {STEPS.map((step) => (
            <div key={step.n} className="flex items-start gap-2.5 rounded-lg border border-[#DCE4EE] bg-[#F5F7FA] px-3 py-2.5">
              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-primary text-[12px] font-bold text-white">
                {step.n}
              </span>
              <span>
                <strong className="block text-[13px] font-bold text-secondary">{step.title}</strong>
                <span className="block text-[12px] text-[#5A6B80]">{step.text}</span>
              </span>
            </div>
          ))}
        </section>

        {/* For homeowners */}
        <section className="px-7 pt-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[17px] font-semibold text-secondary">For homeowners</h2>
            <span className="text-[11.5px] font-semibold text-primary">Free to use · no obligation to hire</span>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2">
            {CUSTOMER_POINTS.map((point) => (
              <Point key={point.title} title={point.title} text={point.text} />
            ))}
          </ul>
        </section>

        {/* Services */}
        <section className="mx-7 mt-3 rounded-lg border border-[#DCE4EE] px-4 py-2.5">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5A6B80]">Jobs we take</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SERVICES.map((service) => (
              <span key={service} className="rounded-md bg-[#EEF2F7] px-2 py-1 text-[11.5px] font-semibold text-secondary">
                {service}
              </span>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] leading-[1.5] text-[#5A6B80]">
            Some trades are still filling up. Ask anyway — your request is kept and reaches the first
            professional who joins for it.
          </p>
        </section>

        {/* For professionals */}
        <section className="mx-7 mt-3 rounded-lg bg-[#0D2C54] px-5 py-3.5 text-white">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-[17px] font-semibold">For local professionals</h2>
            <span className="rounded-full bg-accent px-3 py-1 text-[11.5px] font-bold text-white">
              First 100 pros: 3 months free
            </span>
          </div>
          <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5">
            {PRO_POINTS.map((point) => (
              <Point key={point.title} title={point.title} text={point.text} dark />
            ))}
          </ul>
          <div className="mt-2.5 flex items-center justify-between gap-3 rounded-md border border-white/15 bg-white/5 px-3 py-1.5">
            {PAID_PLANS.map((plan) => (
              <div key={plan.key} className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#A7BBD3]">{plan.label}</p>
                <p className="font-display text-[16px] font-semibold leading-tight text-white">
                  ${plan.price}
                  <span className="text-[11px] font-normal text-[#B9C8DC]"> /mo</span>
                </p>
                <p className="truncate text-[11px] text-[#B9C8DC]">{PLAN_DETAIL[plan.key] ?? ""}</p>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] leading-[1.45] text-[#A7BBD3]">
            After the free three months, you pay the plan you chose. Sign up at the site under
            &ldquo;Grow your business&rdquo;.
          </p>
        </section>

        {/* Footer */}
        <footer className="mt-auto flex items-center justify-between gap-4 bg-[#F5F7FA] px-7 py-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5A6B80]">Need a repair?</p>
            <p className="font-display text-[15px] font-semibold text-secondary">
              Start at <span className="text-primary">{SITE}</span> — pick what needs fixing and compare quotes.
            </p>
          </div>
          <div className="flex-none text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5A6B80]">Serving</p>
            <p className="text-[12px] font-semibold text-secondary">Akron, OH</p>
          </div>
        </footer>
        <p className="bg-white px-7 pb-3 text-[11px] leading-[1.45] text-[#5A6B80]">
          Licences and business registrations are shown only once checked. Finding a professional and
          comparing quotes is free; you pay the professional you hire. Plan prices in US dollars per
          month after any free period. {SITE_URL.replace("https://", "")}
        </p>
      </article>

      <style>{`
        @page { size: letter portrait; margin: 0; }
        @media print {
          .flyer-sheet { box-shadow: none !important; border-radius: 0 !important; max-width: none !important; }
          html, body { background: #fff !important; }
        }
      `}</style>
    </main>
  );
}
