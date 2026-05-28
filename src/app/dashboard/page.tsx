import Dashboard from "@/components/Dashboard";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <Dashboard />;
}
