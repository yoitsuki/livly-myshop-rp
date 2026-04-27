export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="pt-6 text-center text-muted">
      <p className="text-[15px]">詳細ページ（id: {id}）は次のステップで実装します。</p>
    </div>
  );
}
