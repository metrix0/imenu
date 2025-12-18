import { redirect } from "next/navigation";

export function GET(
    request: Request,
    { params }: { params: { slug: string } }
) {
    const { slug } = params;
    redirect(`https://imenuapp.com.br/${slug}?utm_source=instagram`);
}