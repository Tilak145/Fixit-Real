import { OnboardingWizard } from "@/components/fixit/onboarding-wizard";

export const metadata = { title: "Set Up Your Business — FixIt" };

export default function Page() {
  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <OnboardingWizard />
    </div>
  );
}
