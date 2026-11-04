import { POLICY_LINKS, POLICY_UPDATED, PolicyLayout, policyMetadata, type PolicySection } from "@/components/fixit/policy-page";

export const metadata = policyMetadata("Cookie Policy", "The cookies FixIt uses, what each one is for, and how to turn them off.");

const sections: PolicySection[] = [
  {
    heading: "What cookies are",
    paragraphs: [
      "A cookie is a small file a website stores in your browser. FixIt uses them sparingly, and never to follow you around other websites for advertising.",
    ],
  },
  {
    heading: "The cookies we use",
    items: [
      "Sign-in: cookies from our sign-in provider keep you logged in between pages and sign you out when you sign out.",
      "Security: cookies that help us block automated abuse and keep your session safe.",
      "Remembered choices: the city you picked in the header and the last page you were on may be remembered so you do not have to pick them again.",
      "Payments: when you start a plan, our payment provider uses its own cookies on its checkout page, under its own policy.",
    ],
  },
  {
    heading: "What we do not use",
    paragraphs: [
      "We do not use advertising cookies, and we do not sell data to advertisers. If we ever add analytics or advertising tools, this policy will list them and ask for your consent first.",
    ],
  },
  {
    heading: "Turning them off",
    paragraphs: [
      "Every browser lets you block or delete cookies in its settings. If you block cookies, sign-in, saved cities and checkout may stop working. Deleting cookies signs you out.",
    ],
  },
];

export default function CookiePolicyPage() {
  return (
    <PolicyLayout
      eyebrow="Cookies"
      title="Cookie Policy"
      href="/policies/cookies"
      updated={POLICY_UPDATED}
      intro="FixIt uses a small number of cookies, all to keep you signed in and the site secure. This page lists them and how to switch them off."
      sections={sections}
      related={POLICY_LINKS}
    />
  );
}
