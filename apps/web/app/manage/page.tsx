import { Suspense } from "react";
import { ManageApp } from "@/components/manage/manage-app";
import { Loading } from "@/components/manage/ui";

export const metadata = { title: "Property Dashboard — FixIt", robots: { index: false, follow: false } };

export default function ManagePage() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <ManageApp />
    </Suspense>
  );
}
