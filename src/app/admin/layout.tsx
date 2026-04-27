import MenuInferiorAdmin from '@/screens/admin/MenuInferiorAdmin'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {children}
      <MenuInferiorAdmin />
    </div>
  )
}
