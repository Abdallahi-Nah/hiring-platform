import { redirect } from "next/navigation";

export default function MeHome() {
  redirect("/me/applications");
}
