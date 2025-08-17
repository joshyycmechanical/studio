'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessageSquare, Send } from 'lucide-react';

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
}

export default function ChatPage() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [newMessage, setNewMessage] = React.useState('');

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      const message: Message = {
        id: Date.now().toString(),
        sender: 'You', // This would be dynamic in a real app
        text: newMessage,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prevMessages) => [...prevMessages, message]);
      setNewMessage('');
    }
  };

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
      <Card className="flex flex-col flex-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6" /> Chat
          </CardTitle>
          <CardDescription>Internal team communication.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col justify-end space-y-4 overflow-auto p-4">
          <div className="flex-1 overflow-y-auto pr-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-10">
                Start a conversation!
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="mb-2 text-sm">
                  <span className="font-semibold">{message.sender}</span>{' '}
                  <span className="text-muted-foreground text-xs">({message.timestamp}):</span>{' '}
                  {message.text}
                </div>
              ))
            )}
          </div>
        </CardContent>
        <CardFooter className="p-4 border-t">
          <div className="flex w-full space-x-2">
            <Input
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage();
                }
              }}
            />
            <Button onClick={handleSendMessage}>
              <Send className="h-4 w-4" />
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </CardFooter>
      </Card>
    </main>
  );
}
