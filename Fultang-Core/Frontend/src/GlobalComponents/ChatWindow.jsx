import { useState } from "react";
import axiosInstance from "../Utils/axiosInstance.js";

// Icône de message (vous pouvez utiliser une bibliothèque comme react-icons ou une image SVG)
const MessageIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
    />
  </svg>
);

// Icône de flèche d'envoi (send)
const SendIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="h-6 w-6"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
    />
  </svg>
);

const ChatWindow = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const sendMessage = async () => {
    if (input.trim() === "") return;

    const newMessage = { text: input, sender: "user" };
    setMessages([...messages, newMessage]);
    setInput("");

    try {
      const response = await axiosInstance.post("/chatbot/", {
        question: input,
      });
      console.log(response);
      const botMessage = { text: response.data.response, sender: "bot" };
      setMessages([...messages, newMessage, botMessage]);
    } catch (error) {
      console.error("Erreur lors de l'envoi du message", error);
    }
  };

  return (
    <div className="fixed bottom-4 right-4">
      {/* Bouton pour ouvrir/fermer le chat */}
      <button
        onClick={toggleChat}
        className="bg-gradient-to-r from-primary-start to-primary-end text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-shadow duration-300 flex items-center justify-center"
      >
        <MessageIcon />
      </button>

      {/* Fenêtre de chat */}
      {isOpen && (
        <div className="fixed right-4 bottom-20 w-96 h-[500px] bg-white rounded-lg shadow-2xl flex flex-col">
          {/* En-tête de la fenêtre de chat */}
          <div className="bg-gradient-to-r from-primary-start to-primary-end text-white p-4 rounded-t-lg">
            <h2 className="text-lg font-semibold">Chat Bot</h2>
          </div>

          {/* Corps de la fenêtre de chat (messages) */}
          <div className="flex-1 p-4 overflow-y-auto">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`mb-4 ${
                  msg.sender === "user" ? "text-right" : "text-left"
                }`}
              >
                <div
                  className={`inline-block p-3 rounded-lg ${
                    msg.sender === "user"
                      ? "bg-primary-start text-white"
                      : "bg-gray-100"
                  }`}
                >
                  <p>{msg.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Zone de saisie de message */}
          <div className="p-4 border-t border-gray-200 flex items-center">
            <input
              type="text"
              placeholder="Tapez votre message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-start"
            />
            <button
              onClick={sendMessage}
              className="ml-2 p-2 bg-gradient-to-r from-primary-start to-primary-end text-white rounded-full hover:opacity-90 transition-opacity duration-300"
            >
              <SendIcon />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
