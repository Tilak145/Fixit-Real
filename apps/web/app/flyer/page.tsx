import type { Metadata } from "next";

import { FlyerPage } from "@/components/fixit/flyer";

export const metadata: Metadata = {
  title: "FixIt flyer — Akron home repair, one place",
  description: "A printable flyer for FixIt: local home repair pros in Akron, compared quotes, emergency reply, and free first months for pros.",
};

export default function Page() {
  return <FlyerPage />;
}
