export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="text-center max-w-lg">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">MaoCerta</h1>
        <p className="text-lg text-gray-600 mb-8">
          Conectando clientes e profissionais de forma simples e eficiente.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/entrar"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Entrar
          </a>
          <a
            href="/cadastro"
            className="px-6 py-3 border border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
          >
            Cadastrar
          </a>
        </div>
      </div>
    </main>
  );
}
