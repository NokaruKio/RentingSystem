import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

export default function Chatbot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    try {
      const res = await axios.post('/post/chatbot', { message: input });
      const botMsg = { role: 'assistant', content: res.data.reply };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      const serverError = e.response?.data?.error || e.message;
      console.error('Chatbot error:', serverError);
      const errMsg = { role: 'assistant', content: serverError };
      setMessages(prev => [...prev, errMsg]);
    }
    setInput('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') sendMessage();
  }

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex-1 overflow-auto mb-4">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-2 px-3 py-2 rounded-lg ${
              msg.role === 'user' ? 'bg-blue-100 self-end' : 'bg-gray-100 self-start'
            }`}
          >
            {msg.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex">
        <input
          className="flex-1 border rounded-l-lg px-3 py-2"
          type="text"
          placeholder="Gõ tin nhắn..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          onClick={sendMessage}
          className="bg-blue-500 text-white px-4 py-2 rounded-r-lg"
        >
          Gửi
        </button>
      </div>
    </div>
  );
} 