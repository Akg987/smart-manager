import { redirect } from "next/navigation";

export default function ForbiddenPage(): never {
  redirect("/dashboard");
}
