import SegurancaScreen from '@/screens/configuracoes/SegurancaScreen'

export default function SegurancaPage() {
  return (
    <SegurancaScreen
      voltarHref="/profissional/configuracoes"
      perfilToggleLabel="Perfil visível na busca"
      perfilToggleDescricao="Aparecer nos resultados quando clientes buscarem por sua categoria"
    />
  )
}
