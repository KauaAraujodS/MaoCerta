import MenuInferiorProfissional from '@/screens/profissional/MenuInferiorProfissional'
import BarraTopoApp from '@/components/app/BarraTopoApp'

export default function ProfissionalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20 bg-gray-50 dark:bg-slate-950 flex flex-col">
      <BarraTopoApp variant="profissional" />
      <div className="flex-1 min-h-0">{children}</div>
      <MenuInferiorProfissional />
    </div>
  )
}
