import ClienteAtendimentoDetalheScreen from '@/screens/cliente/ClienteAtendimentoDetalheScreen'

export default function Page({ params }: { params: { id: string } }) {
  return <ClienteAtendimentoDetalheScreen id={params.id} />
}
