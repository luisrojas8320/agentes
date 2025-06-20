import { ChatProvider } from "@/contexts/ChatContext";
import ChatInterface from "@/components/ChatInterface";
import { Toaster } from "@/components/ui/sonner";

export default function Home() {
  return (
    <main>
      <ChatProvider>
        <ChatInterface />
      </ChatProvider>
      <Toaster position="top-right" theme="dark" richColors />
    </main>
  );
}