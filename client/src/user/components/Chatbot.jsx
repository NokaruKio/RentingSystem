import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleToggle = () => {
    setIsOpen(prev => !prev);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    try {
      const res = await axios.post('/post/chatbot', { message: input });
      const botMsg = { role: 'assistant', content: res.data.reply };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      const serverError = e.response?.data?.error || e.message;
      setMessages(prev => [...prev, { role: 'assistant', content: serverError }]);
    }
    setInput('');
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter') sendMessage();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOpen && (
        <button
          onClick={handleToggle}
          className="w-80 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg"
        >
          Mở Chatbot
        </button>
      )}
      {isOpen && (
        <div className="w-80 h-96 flex flex-col border rounded-lg shadow-lg bg-white">
          <button
            onClick={handleToggle}
            className="w-full bg-blue-500 text-white px-4 py-2 rounded-t-lg"
          >
            Đóng Chatbot
          </button>
          <div className="p-4 flex-1 overflow-auto">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`mb-2 px-3 py-2 rounded-lg break-words whitespace-pre-wrap text-justify ${
                  msg.role === 'user' ? 'bg-blue-100 self-end' : 'bg-gray-100 self-start'
                }`}
              >
                {msg.content}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="flex border-t">
            <input
              type="text"
              placeholder="Gõ tin nhắn..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-3 py-2 rounded-bl-lg border-r"
            />
            <button
              onClick={sendMessage}
              className="bg-blue-500 text-white px-4 py-2 rounded-br-lg"
            >
              Gửi
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 