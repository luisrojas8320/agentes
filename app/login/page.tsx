import AuthForm from '@/components/AuthForm';
//pagina de inicio login
export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-8 space-y-8 rounded-lg border border-border">
        <div className="text-center">
          <h1 className="text-4xl font-bold">AI Playground</h1>
          <p className="mt-2 text-muted-foreground">Inicia sesión para continuar</p>
        </div>
        <AuthForm />
      </div>
    </div>
  );
}