import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Bot, User, Send, X, MessageSquareText } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

const Chatbot = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hi! I am your AI Travel Agent. Where would you like to go?' }
  ]);
  const [input, setInput] = useState('');
  const socket = useSocket();
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    const handleChatReply = (data) => {
      setIsTyping(false);
      setMessages((prev) => [...prev, { role: 'bot', text: data.message }]);
    };
    
    const handleStatusUpdate = (data) => {
      if (data?.message) {
         setMessages((prev) => [...prev, { role: 'bot', text: `*[System]* ${data.message}` }]);
         
         const isPlanningStart = data.stage === 'start';

         if (isPlanningStart) {
           navigate('/planner');
           setTimeout(() => {
             setIsOpen(false);
           }, 1000);
         }
      }
    };

    const handleTripResult = (data) => {
      setIsTyping(false);
      navigate('/planner');
    };

    socket.on('chat_reply', handleChatReply);
    socket.on('status_update', handleStatusUpdate);
    socket.on('trip_result', handleTripResult);

    return () => {
      socket.off('chat_reply', handleChatReply);
      socket.off('status_update', handleStatusUpdate);
      socket.off('trip_result', handleTripResult);
    };
  }, [socket, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
    setInput('');
    setIsTyping(true);

    socket.emit('chat_message', { text: userMessage });
  };

  // Hide floating chatbot on /planner — full-page chat is embedded there instead
  if (location.pathname === '/planner') return null;

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500 text-white shadow-lg shadow-emerald-500/30 transition-transform hover:scale-105 active:scale-95"
        >
          <MessageSquareText size={24} />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[500px] w-[350px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/90 shadow-2xl backdrop-blur-xl sm:w-[400px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300">
                <Bot size={18} />
              </div>
              <span className="font-semibold text-white">AI Travel Concierge</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            <div className="flex flex-col gap-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex w-max max-w-[80%] flex-col ${
                    msg.role === 'user' ? 'self-end' : 'self-start'
                  }`}
                >
                  <div
                    className={`rounded-2xl px-4 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'rounded-br-none bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                        : 'rounded-bl-none border border-white/10 bg-white/5 text-white/90'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex w-max max-w-[80%] self-start rounded-2xl rounded-bl-none border border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-0.3s]"></span>
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50 [animation-delay:-0.15s]"></span>
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/50"></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-white/10 bg-white/5 p-3">
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message AI Concierge..."
                className="flex-1 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-white placeholder-white/40 focus:border-cyan-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || !socket}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-white transition-colors hover:bg-cyan-400 disabled:opacity-50"
              >
                <Send size={18} className="ml-1" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
