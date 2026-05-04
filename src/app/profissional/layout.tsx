import MenuInferiorProfissional from '@/screens/profissional/MenuInferiorProfissional'

export default function ProfissionalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {children}
      <MenuInferiorProfissional />
    </div>
  )
}
