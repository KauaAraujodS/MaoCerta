import ProfissionalAtendimentoDetalheScreen from '@/screens/profissional/ProfissionalAtendimentoDetalheScreen'

export default function Page({ params }: { params: { id: string } }) {
  return <ProfissionalAtendimentoDetalheScreen id={params.id} />
}
