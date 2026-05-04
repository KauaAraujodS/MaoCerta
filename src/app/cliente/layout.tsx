import MenuInferiorCliente from '@/screens/cliente/MenuInferiorCliente'

export default function ClienteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {children}
      <MenuInferiorCliente />
    </div>
  )
}