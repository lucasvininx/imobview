import { PublicPresentation } from "@/components/public-presentation";
export const metadata = {
  title: "Explore uma nova perspectiva",
  description: "Conheça uma apresentação demonstrativa de imóvel no ImobView°.",
};
export default function Demo() {
  return (
    <PublicPresentation
      demo
      property={{
        title: "Apartamento Jardim",
        slug: "demonstracao",
        description:
          "Ambientes que se conectam, luz natural em cada detalhe e espaço para viver no seu ritmo. Conheça uma nova forma de apresentar um imóvel.\n\nEsta é uma experiência demonstrativa com informações fictícias e imagens ilustrativas. Não representa um imóvel à venda.",
        city: "São Paulo",
        state: "SP",
        neighborhood: "Jardins",
        priceCents: BigInt(98000000),
        area: 145,
        bedrooms: 3,
        bathrooms: 3,
        parkingSpaces: 2,
        cover: "/images/living.jpg",
        organizationName: "Imobiliária Demo",
      }}
    />
  );
}
