import SegurancaScreen from '@/screens/configuracoes/SegurancaScreen'

export default function SegurancaPage() {
  return (
    <SegurancaScreen
      voltarHref="/admin/configuracoes"
      mostrarPerfilPublico={false}
    />
  )
}
