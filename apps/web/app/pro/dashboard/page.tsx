import { Suspense } from "react";
import { ProviderDashboard } from "@/components/fixit/provider-dashboard";

export const metadata = { title: "Pro Dashboard — FixIt" };

export default function Page() {
  return (
    <Suspense>
      <ProviderDashboard />
    </Suspense>
  );
}
