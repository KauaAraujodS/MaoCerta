import SegurancaScreen from '@/screens/configuracoes/SegurancaScreen'

export default function SegurancaPage() {
  return (
    <SegurancaScreen
      voltarHref="/cliente/configuracoes"
      perfilToggleLabel="Perfil público"
      perfilToggleDescricao="Permitir que prestadores vejam seu nome e cidade"
    />
  )
}
