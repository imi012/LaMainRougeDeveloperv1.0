import type { Metadata } from "next";
import AppGate from "./_components/app-gate";

export const metadata: Metadata = {
  title: "LaMainRouge",
  description: "LaMainRouge frakció weboldala",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppGate>{children}</AppGate>;
}