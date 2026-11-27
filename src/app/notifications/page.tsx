import Link from "next/link";
import { NotificationsView } from "@/components/notifications-view";
import { getCurrentUser } from "@/lib/auth";
import { getNotifications } from "@/lib/queries";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-medium">Notifications</h1>
        <p className="mt-2 text-sm text-secondary">Sign in to see fills, resolutions, and replies.</p>
        <Link href="/signin?next=/notifications" className="btn-primary mt-5">
          Sign in
        </Link>
      </div>
    );
  }
  const items = await getNotifications(user.id);
  return <NotificationsView items={items} />;
}
