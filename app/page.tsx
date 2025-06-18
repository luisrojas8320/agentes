// Ruta: app/page.tsx

// Importa el proveedor de lógica desde 'contexts'
import { ChatProvider } from '@/contexts/ChatContext'; 

// Importa el componente de UI principal desde 'components'
import ChatInterface from '@/components/ChatInterface'; 

export default function Home() {
  // La página ahora solo se encarga de envolver la interfaz de UI
  // con el proveedor de lógica y estado. Limpio y desacoplado.
  return (
    <ChatProvider>
      <ChatInterface />
    </ChatProvider>
  );
}