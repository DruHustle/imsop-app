import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Send, Bot, User, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function Assistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm IMSOP AI. I can help you track shipments, analyze operational data, or predict potential disruptions. How can I assist you today?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate AI response delay
    setTimeout(() => {
      const responses = [
        "I've analyzed the latest telemetry data. Shipment #SHP-8829 is currently on schedule and expected to arrive in New York by 14:00 EST.",
        "Based on current weather patterns in the North Atlantic, I predict a 4-hour delay for sea freight routes from Hamburg. I recommend notifying the receiving warehouse.",
        "I've detected a potential bottleneck in the Singapore distribution center. Throughput has dropped by 15% in the last hour.",
        "The demand forecast for Q4 shows a 20% increase in electronics. We should consider increasing inventory levels in the West Coast distribution centers."
      ];
      
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: randomResponse,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-display text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">
            AI Assistant
          </h1>
          <p className="text-muted-foreground">Conversational interface for operational intelligence.</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium">
          <Sparkles className="w-4 h-4" />
          IMSOP LLM v2.0 Active
        </div>
      </div>

      <Card className="flex-1 glass border-white/5 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <Avatar className={cn(
                  "w-8 h-8 border border-white/10",
                  message.role === "assistant" ? "bg-primary/20" : "bg-white/10"
                )}>
                  {message.role === "assistant" ? (
                    <Bot className="w-5 h-5 text-primary" />
                  ) : (
                    <User className="w-5 h-5 text-white" />
                  )}
                </Avatar>
                <div className={cn(
                  "rounded-2xl px-4 py-3 max-w-[80%] text-sm",
                  message.role === "user" 
                    ? "bg-primary text-primary-foreground rounded-tr-none" 
                    : "bg-white/5 border border-white/10 text-foreground rounded-tl-none"
                )}>
                  {message.content}
                  <div className="text-[10px] opacity-50 mt-1 text-right">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex gap-3">
                <Avatar className="w-8 h-8 bg-primary/20 border border-white/10">
                  <Bot className="w-5 h-5 text-primary" />
                </Avatar>
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1">
                  <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="p-4 bg-black/20 border-t border-white/5">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Input
              placeholder="Ask about shipments, delays, or operational insights..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="bg-white/5 border-white/10 focus:border-primary/50"
            />
            <Button 
              onClick={handleSend} 
              disabled={!input.trim() || isTyping}
              className="bg-primary hover:bg-primary/80 text-primary-foreground shadow-[0_0_15px_var(--primary)]"
            >
              {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
