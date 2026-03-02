// app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  // A “főoldalról” az app shell-re dobunk.
  // Az AppGate / beléptetés ott úgyis elintézi a /login redirectet, ha kell.
  redirect("/app");
}