import { PublicPresentation } from "@/components/public-presentation";
import { getPublicProperty } from "@/features/properties/public-service";
import { publicTours } from "@/features/tours/presentation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ButtonLink } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Experimente um tour 360°",
  description:
    "Explore ambientes conectados em uma demonstração real do ImobView°.",
};
export default async function Demo() {
  const slug = process.env.DEMO_PROPERTY_SLUG || "casa-modelo-tour-360";
  const property = await getPublicProperty(slug);
  if (property)
    return (
      <PublicPresentation
        demo
        property={property}
        tours={await publicTours(slug)}
      />
    );
  return (
    <>
      <SiteHeader />
      <main id="conteudo" className="container legal-page">
        <h1>Conheça o tour 360°</h1>
        <p>
          A demonstração está sendo preparada. Entre em contato para conhecer o
          produto em uma apresentação acompanhada.
        </p>
        <ButtonLink href="/contato">Agendar demonstração</ButtonLink>
      </main>
      <SiteFooter />
    </>
  );
}
