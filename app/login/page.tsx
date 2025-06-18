// Ruta: app/login/page.tsx

import AuthForm from '@/components/AuthForm';

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#181818]">
      <div className="w-full max-w-md p-8 space-y-8 bg-[#222222] rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white">Playground Agents</h1>
          <p className="mt-2 text-gray-400">Inicia sesión para continuar</p>
        </div>
        <AuthForm />
      </div>
    </div>
  );
}