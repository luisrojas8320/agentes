'use client';

import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TypingAnimation() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-secondary">
        <Bot className="h-4 w-4" />
      </div>
      
      <div className="flex-1 space-y-2 overflow-hidden">
        <div className="prose prose-invert inline-block text-left">
          <div className="flex items-center space-x-1 px-4 py-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
            </div>
            <span className="text-sm text-gray-400 ml-2">Pensando...</span>
          </div>
        </div>
      </div>
    </div>
  );
}