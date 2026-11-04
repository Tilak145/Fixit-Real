import { POLICY_LINKS, POLICY_UPDATED, PolicyLayout, policyMetadata, type PolicySection } from "@/components/fixit/policy-page";

export const metadata = policyMetadata("Professional Agreement", "How FixIt works with local professionals: verification, plans, free trial, leads and conduct.");

const sections: PolicySection[] = [
  {
    heading: "What you are signing up for",
    paragraphs: [
      "You are an independent business using FixIt to find local customers. FixIt is not your employer, does not set your prices, and does not control how you do the work. You keep your own licence, insurance, taxes and employees.",
    ],
  },
  {
    heading: "Getting approved",
    items: [
      "Your business profile is reviewed before it appears. Until it is approved, customers cannot see it.",
      "You must hold any licence your trade requires for the work you accept, and any contractor registration Ohio requires.",
      "We check your Ohio business registration number against the Secretary of State register, and we may ask for proof of licence and insurance.",
      "We only mark a profile verified after the relevant checks pass. If your registration or insurance lapses, we may remove the verified mark.",
      "You agree that your business details, licence number and insurance status are accurate, and that you will update them if anything changes.",
    ],
  },
  {
    heading: "Plans and the free trial",
    items: [
      "The first 100 professionals who join receive three months free. You choose the plan you want, and it starts to cost money when the free period ends.",
      "After the free period, plans are billed monthly through our payment provider at the price shown before checkout: Starter $99, Professional $199, Business $399.",
      "Your plan sets your listing placement and how many cities and services you can cover. A plan change takes effect at the start of the next billing period.",
      "We tell you before your free period ends, so a charge is never a surprise.",
      "FixIt does not currently charge a commission on jobs. If that ever changes, we will show the full terms and ask for a separate agreement before anything is charged.",
      "Cancel from your dashboard. Cancelled plans stay active until the end of the period you have paid for and do not renew.",
    ],
  },
  {
    heading: "Leads and quotes",
    items: [
      "A request is shared with professionals who serve the customer's city and trade, and who are accepting work.",
      "Send a quote with honest pricing, what is included, how soon you can start and what warranty you offer.",
      "If you cannot take a job, decline it rather than leave the customer waiting.",
      "Customer contact details become visible only after the customer accepts your quote. Before that, keep it in FixIt.",
      "You may pause new leads whenever you like, including for holidays or a full schedule.",
    ],
  },
  {
    heading: "Complaints about a lead",
    paragraphs: [
      "If a lead looks fake, duplicated or outside your area, report it from your dashboard. We review reports and, where a lead was invalid, we may refund or credit it. Repeatedly reporting leads as invalid without cause may lead to review of your account.",
    ],
  },
  {
    heading: "Conduct",
    items: [
      "Do not ask a customer to accept your quote just to get their contact details and then change the price.",
      "Do not pressure a customer, or contact them outside FixIt before they have chosen you.",
      "Do not use a customer's details for anything except the job they asked about.",
      "Do not misrepresent your licence, insurance, reviews or past work.",
      "FixIt may suspend or remove a professional who breaks these rules, or whose work gives customers serious grounds for complaint.",
    ],
  },
  {
    heading: "Money and taxes",
    paragraphs: [
      "You invoice and are paid by the customer for the work, unless you both agree otherwise. You are responsible for collecting and paying any sales tax that applies to your work. Plan fees are for using FixIt and are separate from the customer's job.",
    ],
  },
  {
    heading: "Ending the agreement",
    paragraphs: [
      "You can cancel at any time. We can end an account for a serious breach, fraud or repeated poor conduct, after telling you the reason. Records of past jobs are kept as described in the Privacy Policy.",
    ],
  },
];

export default function ProAgreementPage() {
  return (
    <PolicyLayout
      eyebrow="For professionals"
      title="Professional Agreement"
      href="/policies/pro-agreement"
      updated={POLICY_UPDATED}
      intro="The terms for local businesses that work through FixIt: how approval works, what the plan costs after the free period, how leads are shared, and the conduct that keeps the marketplace fair."
      sections={sections}
      related={POLICY_LINKS}
    />
  );
}
