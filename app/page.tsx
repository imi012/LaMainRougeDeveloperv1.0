// app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  // A valódi appod az /app alatt van
  redirect("/app");
}