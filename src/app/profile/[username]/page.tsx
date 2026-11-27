import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PortfolioView } from "@/components/portfolio-view";
import { getCurrentUser } from "@/lib/auth";
import { getProfile } from "@/lib/queries";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewer = await getCurrentUser();
  const data = await getProfile(username, viewer?.id);
  if (!data) notFound();
  return <PortfolioView data={data} />;
}
