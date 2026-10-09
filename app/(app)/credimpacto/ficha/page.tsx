import { redirect } from 'next/navigation'

export default async function FichaPage({
  searchParams
}: {
  searchParams?: Promise<{ colaborador?: string }>
}) {
  const params = await searchParams
  if (params?.colaborador) {
    redirect(`/credimpacto?tab=ficha_colaborador&colaborador=${encodeURIComponent(params.colaborador)}`)
  }
  redirect('/credimpacto?tab=ficha_colaborador')
}
