import MenuPage from "@/app/[slug]/page";

export default async function QrTablePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ p?: string; c?: string }>;
}) {
  const [{ slug, token }, query] = await Promise.all([params, searchParams]);

  return (
    <MenuPage
      params={Promise.resolve({ slug })}
      searchParams={Promise.resolve({
        p: query.p,
        c: query.c,
        origem: "mesa",
        mesa: token,
      })}
    />
  );
}
