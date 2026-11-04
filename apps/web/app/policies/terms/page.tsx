import { POLICY_LINKS, POLICY_UPDATED, PolicyLayout, policyMetadata, type PolicySection } from "@/components/fixit/policy-page";
import { SITE_EMAIL } from "@/lib/site-contact";

export const metadata = policyMetadata("Terms of Use", "The rules for using FixIt as a homeowner or a visitor.");

const sections: PolicySection[] = [
  {
    heading: "What FixIt is",
    paragraphs: [
      "FixIt is a marketplace. We help you describe a repair, find local professionals who serve your area, compare their quotes and keep the job organised. Professionals on FixIt are independent businesses, not our employees, and the contract for any work is between you and the professional you hire.",
    ],
  },
  {
    heading: "Your account",
    items: [
      "You must be 18 or over, and the information you give us must be accurate.",
      "You are responsible for what happens through your account, so keep your password private.",
      "One person, one account: do not create accounts for other people or post requests on their behalf without their permission.",
      `You can close your account at any time by writing to ${SITE_EMAIL}.`,
    ],
  },
  {
    heading: "Posting a request",
    items: [
      "Post only real jobs at an address where you are allowed to arrange work.",
      "Photos and videos you upload must be of your own property or taken with permission, and must not show anything unlawful.",
      "Describe the job honestly. A professional who quotes on an inaccurate description may change their price after seeing the work.",
      "Do not post contact details in a description, and do not take conversations off FixIt before you have chosen a professional.",
      "Requests that look fake, duplicated or automated may be withheld while we check them.",
    ],
  },
  {
    heading: "Quotes and hiring",
    items: [
      "Professionals send their own prices. FixIt does not set, guarantee or negotiate them, and estimates shown on a request are guidance only.",
      "Accepting a quote shares your contact details with that professional for that job, and closes the other quotes.",
      "Prices, start dates, warranties and payment terms are what the professional states in their quote. Read them before you accept.",
      "Agree any change in scope or price with the professional directly, and keep it in writing.",
    ],
  },
  {
    heading: "Reviews and messages",
    items: [
      "Review only work you actually had done, and keep it about the work.",
      "No threats, harassment, hate speech, spam or reviews written to harm a competitor.",
      "We may remove content that breaks these rules or the law, and we may suspend an account that keeps doing it.",
    ],
  },
  {
    heading: "Emergencies",
    paragraphs: [
      "FixIt can mark a request as an emergency and show it to professionals who accept emergency work, but a request is not a 911 call. For a gas leak, fire, live electrical hazard or a medical emergency, call 911 first.",
    ],
  },
  {
    heading: "Problems with a job",
    paragraphs: [
      `Talk to the professional first. If that does not resolve it, write to ${SITE_EMAIL} with the customer number or request details and we will look at what was agreed and help find a fair outcome. Because the work contract is with the professional, FixIt does not warrant their work.`,
    ],
  },
  {
    heading: "Our responsibility",
    paragraphs: [
      "We work to keep the site available, accurate and safe, but it is provided as it is. We are not responsible for a professional's work, their licences beyond what we checked and stated, or for loss caused by something outside our reasonable control. Nothing here limits rights you have under Ohio or federal law.",
    ],
  },
  {
    heading: "Changes and law",
    paragraphs: [
      "We may update these terms; the date at the top shows the latest version, and continued use after a change means you accept it. These terms are governed by the laws of Ohio, and disputes are handled in the courts of Summit County, Ohio, unless the law gives you another right.",
    ],
  },
];

export default function TermsOfUsePage() {
  return (
    <PolicyLayout
      eyebrow="Terms"
      title="Terms of Use"
      href="/policies/terms"
      updated={POLICY_UPDATED}
      intro="These are the rules for using FixIt as a homeowner. They are written to be read, not to hide anything: what we do, what you agree to, and what happens when something goes wrong."
      sections={sections}
      related={POLICY_LINKS}
    />
  );
}
