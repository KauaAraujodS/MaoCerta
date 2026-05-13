import MenuInferiorCliente from '@/screens/cliente/MenuInferiorCliente'
import BarraTopoApp from '@/components/app/BarraTopoApp'

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20 bg-gray-50 dark:bg-slate-950 flex flex-col">
      <BarraTopoApp variant="cliente" />
      <div className="flex-1 min-h-0">{children}</div>
      <MenuInferiorCliente />
    </div>
  )
}
