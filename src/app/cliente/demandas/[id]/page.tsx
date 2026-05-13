import ClienteDemandaDetalheScreen from '@/screens/cliente/ClienteDemandaDetalheScreen'

export default function Page({ params }: { params: { id: string } }) {
  return <ClienteDemandaDetalheScreen id={params.id} />
}
