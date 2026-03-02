import { redirect } from "next/navigation";

export default function AppIndexPage() {
  // Ide döntsd el, mi legyen az alap landing:
  // redirect("/app/tagok");   // ha inkább a taglista legyen a kezdő
  redirect("/app/profile");   // ha inkább a profil legyen a kezdő
}