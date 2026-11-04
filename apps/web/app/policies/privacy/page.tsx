import { POLICY_LINKS, POLICY_UPDATED, PolicyLayout, policyMetadata, type PolicySection } from "@/components/fixit/policy-page";
import { SITE_EMAIL } from "@/lib/site-contact";

export const metadata = policyMetadata("Privacy Policy", "What FixIt collects, why, who can see it and how to have it removed.");

const sections: PolicySection[] = [
  {
    heading: "Who we are",
    paragraphs: [
      "FixIt is a local home services marketplace serving Akron, Ohio and nearby communities. We connect homeowners with independent professionals and keep the quotes, visits and messages for each job in one place. This policy explains what information we hold about you and how it is used.",
    ],
  },
  {
    heading: "What we collect",
    items: [
      "Account details you give us: your name, email address, phone number and password (stored only in hashed form by our sign-in provider).",
      "Your home address and city, when you add them to your profile or a request, so a request goes to professionals who work in your area.",
      "What you ask for: the repair category, description, photos or video, urgency, budget and the address for the job.",
      "Your activity: requests posted, quotes received and accepted, appointments, messages with professionals, reviews you leave, and your six-digit customer number.",
      "Professional details for pros: business name, contact details, licence and insurance information, and Ohio business registration number.",
      "Payment information, which is handled by our payment provider. We receive confirmation of a plan, a payment and a subscription status, never your full card number.",
      "Technical information such as the browser you use, so the site works in it and so we can keep it secure.",
    ],
  },
  {
    heading: "How we use it",
    items: [
      "To match your request with professionals who serve your city and trade, and to show each quote side by side.",
      "To keep a record of each job so you, the professional and our support team can see what was agreed.",
      "To show a professional your name, phone and address only after you accept their quote, and to keep them hidden before that.",
      "To verify professionals' licences, insurance and business registration before their profile is marked verified.",
      "To send service messages, such as a professional sending you a quote or a visit being confirmed. Marketing email is only sent when you ask for it, and every one has an unsubscribe link.",
      "To detect fake, duplicate or abusive requests and keep the marketplace fair for everyone.",
      "To meet our legal obligations and to prevent fraud.",
    ],
  },
  {
    heading: "Your customer number",
    paragraphs: [
      "Every customer gets a six-digit customer number. You can give it to our team by phone or email and we will pull up your account. The number is never shared with professionals, and it does not replace your email address for signing in.",
    ],
  },
  {
    heading: "Who sees what",
    items: [
      "Professionals see a request's category, description, photos, city and your first name while they are deciding whether to quote.",
      "A professional sees your full contact details only after you accept their quote, and only for that job.",
      "Other professionals never see your contact details, your address or another pro's quote.",
      "Our support and management team can see the details of an account, including a customer's full history by customer number, to answer questions and resolve disputes. Manager access is limited to the team who runs the site and to their support and dispute work.",
      "We do not sell your personal information.",
    ],
  },
  {
    heading: "Who we share it with",
    paragraphs: [
      "We share information only with the people and services needed to run FixIt: the professional you hire, our hosting and database provider, our email provider, and our payment provider. We may also share information when the law requires it or when we must protect someone from harm.",
    ],
  },
  {
    heading: "How long we keep it",
    paragraphs: [
      "We keep account and job records while your account is open and for as long as needed to answer disputes, keep accurate payment and business records, and meet legal requirements. If you close your account, we delete or anonymise personal information that is not needed for those reasons.",
    ],
  },
  {
    heading: "Your choices",
    items: [
      "You can change your name, phone and address from your account page at any time.",
      "You can ask for a copy of the information we hold about you, ask us to correct it, or ask us to delete your account.",
      "You can turn off marketing emails, or stop messages from a particular professional.",
      "You may disable cookies in your browser; parts of sign-in may stop working without them.",
    ],
  },
  {
    heading: "Children",
    paragraphs: [
      "FixIt is for people aged 18 and over. We do not knowingly collect information from children.",
    ],
  },
  {
    heading: "Security",
    paragraphs: [
      "Access to data is limited by who you are. Customers see only their own account, professionals see only their own business and the jobs they are working on, and managers sign in through a separate door. Card details never reach our servers.",
    ],
  },
  {
    heading: "Changes and contact",
    paragraphs: [
      `When this policy changes we update the date at the top and, for important changes, tell you by email. Write to ${SITE_EMAIL} with any question about this policy.`,
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <PolicyLayout
      eyebrow="Privacy"
      title="Privacy Policy"
      href="/policies/privacy"
      updated={POLICY_UPDATED}
      intro="FixIt only works if you trust us with the details of your home. This policy says plainly what we collect, who can see it, and how to get it removed."
      sections={sections}
      related={POLICY_LINKS}
    />
  );
}
