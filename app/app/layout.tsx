import type { Metadata } from "next";
import AppGate from "./_components/app-gate";

export const metadata: Metadata = {
  title: "Tetsuryū-Kai",
  description: "Tetsuryū-Kai frakció weboldala",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppGate>{children}</AppGate>;
}