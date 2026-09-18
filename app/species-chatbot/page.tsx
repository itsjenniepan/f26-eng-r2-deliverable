"use client";
import { TypographyH2, TypographyP } from "@/components/ui/typography";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

export default function SpeciesChatbot() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState("");
  const [chatLog, setChatLog] = useState<{ role: "user" | "bot"; content: string }[]>([]);
  // True while waiting on the API; used to disable the input and prevent double-sends.
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [chatLog, isLoading]);

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return; // ignore empty sends and sends while a reply is pending

    setChatLog((log) => [...log, { role: "user", content: trimmed }]);
    setMessage("");
    if (textareaRef.current) textareaRef.current.style.height = "auto"; // shrink the box back after sending
    setIsLoading(true);

    let reply: string;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      const data = (await res.json()) as { response?: string; error?: string };
      reply = res.ok && data.response ? data.response : data.error ?? "Something went wrong. Please try again.";
    } catch {
      reply = "I couldn't reach the server. Please check your connection and try again.";
    }

    setChatLog((log) => [...log, { role: "bot", content: reply }]);
    setIsLoading(false);
    textareaRef.current?.focus();
  };

  return (
    <>
      <TypographyH2>Species Chatbot</TypographyH2>
      <div className="mt-4 flex gap-4">
        <div className="mt-4 rounded-lg bg-foreground p-4 text-background">
          <TypographyP>
            The Species Chatbot is specialized to answer questions about animals. It can provide information on various
            species, including their habitat, diet, conservation status, and other relevant details. Any unrelated
            prompts will return a message indicating that the chatbot is specialized for species-related queries only.
          </TypographyP>
          <TypographyP>
            To use the Species Chatbot, simply type your question in the input field below and hit enter. The chatbot
            will respond with the best available information.
          </TypographyP>
        </div>
      </div>
      {/* Chat UI, ChatBot to be implemented */}
      <div className="mx-auto mt-6">
        {/* Chat history */}
        <div className="h-[400px] space-y-3 overflow-y-auto rounded-lg border border-border bg-muted p-4">
          {chatLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">Start chatting about a species!</p>
          ) : (
            chatLog.map((msg, index) => (
              <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] whitespace-pre-wrap rounded-2xl p-3 text-sm ${
                    msg.role === "user"
                      ? "rounded-br-none bg-primary text-primary-foreground"
                      : "rounded-bl-none border border-border bg-foreground text-primary-foreground"
                  }`}
                >
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))
          )}
          {isLoading && <p className="text-sm text-muted-foreground">Thinking...</p>}
          <div ref={chatEndRef} />
        </div>
        {/* Textarea and submission */}
        <div className="mt-4 flex flex-col items-end">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onInput={handleInput}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter inserts a newline.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            disabled={isLoading}
            rows={1}
            placeholder="Ask about a species..."
            className="w-full resize-none overflow-hidden rounded border border-border bg-background p-2 text-sm text-foreground focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isLoading || !message.trim()}
            className="mt-2 rounded bg-primary px-4 py-2 text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enter
          </button>
        </div>
      </div>
    </>
  );
}
