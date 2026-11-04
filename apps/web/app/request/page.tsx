import { Suspense } from "react";
import { RequestQuotePage } from "@/components/fixit/request-quote";

export const metadata = { title: "Request a Free Quote — FixIt" };

export default function Page() {
  return (
    <Suspense>
      <RequestQuotePage />
    </Suspense>
  );
}
