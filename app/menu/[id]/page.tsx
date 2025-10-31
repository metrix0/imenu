type Props = {
  params: Promise<{ id: string }>;
};

export default async function Menu({ params }: Props) {
  const { id } = await params;

  return (
    <div>
      <h1>Id do menu: {id}</h1>
    </div>
  );
}
