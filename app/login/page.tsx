// app/login/page.tsx
import AuthForm from '@/components/AuthForm'; // <-- Asegúrate de que el nombre sea el correcto

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <AuthForm />
    </div>
  );
}