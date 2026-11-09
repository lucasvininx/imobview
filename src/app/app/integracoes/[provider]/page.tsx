import { notFound } from "next/navigation";
import { IntegrationDetail } from "@/features/integrations/provider-page";
import { integrationProviders } from "@/features/integrations/catalog";
type Props = {
  params: Promise<{ provider: string }>;
  searchParams: Promise<{ google?: string }>;
};
export async function generateMetadata({ params }: Props) {
  const { provider } = await params;
  return {
    title:
      integrationProviders.find((item) => item.slug === provider)?.title ??
      "Integrações",
  };
}
export default async function Page({ params, searchParams }: Props) {
  const { provider } = await params;
  const selected = integrationProviders.find((item) => item.slug === provider);
  if (!selected) notFound();
  return (
    <IntegrationDetail
      provider={selected.slug}
      googleResult={(await searchParams).google}
    />
  );
}
