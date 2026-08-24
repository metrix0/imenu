import MenuPage from "@/app/[slug]/page";

export default async function QrTableUniversalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ p?: string; c?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);

  return (
    <MenuPage
      params={Promise.resolve({ slug })}
      searchParams={Promise.resolve({
        p: query.p,
        c: query.c,
        origem: "mesa",
      })}
    />
  );
}
