import { Message } from 'ai';
import { User, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex items-start gap-4 p-4 ${isUser ? '' : 'bg-gray-800/20'}`}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isUser ? 'bg-blue-600' : 'bg-gray-600'}`}>
        {isUser ? <User className="h-5 w-5 text-white" /> : <Bot className="h-5 w-5 text-white" />}
      </div>
      <div className="flex-1 space-y-2 overflow-hidden pt-1">
        <div className="prose prose-invert max-w-none text-white">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}