import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, Send, Sparkles, LifeBuoy } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { matchHelp, SUGGESTED_QUESTIONS } from "@/lib/helpKnowledge";

type Msg = { role: "bot" | "user"; text: string };

const GREETING =
  "Oi! 👋 Eu sou a assistente do GO. Tô aqui pra te ajudar a usar o app — rastrear, criar cercas, ativar alertas e muito mais. O que você quer fazer?";

// Renders **bold** and line breaks from the knowledge-base answers.
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <p key={i} className={line.trim() === "" ? "h-2" : "leading-snug"}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={j} className="font-bold">{part.slice(2, -2)}</strong>
            ) : (
              <span key={j}>{part}</span>
            ),
          )}
        </p>
      ))}
    </>
  );
}

export default function Help() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Msg[]>([{ role: "bot", text: GREETING }]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const logQuery = trpc.help.logQuery.useMutation();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ask = (raw: string) => {
    const query = raw.trim();
    if (!query) return;
    setInput("");
    const entry = matchHelp(query);
    logQuery.mutate({ query, matched: !!entry });

    const botText = entry
      ? entry.answer
      : "Ainda não sei responder isso 😅 — mas já registrei sua dúvida para deixar a assistente cada vez melhor. Enquanto isso, tente uma das perguntas sugeridas, ou fale com a nossa Central pelo SOS. Estou aqui! 💙";

    setMessages((m) => [...m, { role: "user", text: query }, { role: "bot", text: botText }]);
  };

  return (
    // Altura = tela menos a navegação inferior (incl. botão SOS), para a caixa
    // "Digite sua dúvida" não ficar atrás do menu.
    <div className="flex flex-col bg-gray-50" style={{ height: "calc(100dvh - 92px - env(safe-area-inset-bottom))" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => setLocation("/profile")} className="go-btn-active">
          <ChevronLeft className="w-6 h-6 text-[#343C42]" />
        </button>
        <div className="w-9 h-9 rounded-full bg-[#243FF7]/10 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-[#243FF7]" />
        </div>
        <div>
          <h1 className="text-base font-bold text-[#111111] leading-tight">Assistente GO</h1>
          <p className="text-[11px] text-green-600 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 pulse-online" /> Online agora
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 no-scrollbar">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] ${
                m.role === "user"
                  ? "bg-[#243FF7] text-white rounded-br-md"
                  : "bg-white text-[#111111] border border-gray-100 shadow-sm rounded-bl-md"
              }`}
            >
              {m.role === "bot" ? <RichText text={m.text} /> : m.text}
            </div>
          </div>
        ))}

        {/* Suggested questions */}
        <div className="pt-1">
          <p className="text-[11px] text-gray-400 font-medium mb-2">Perguntas frequentes</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => ask(q)}
                className="text-[12px] bg-white border border-gray-200 text-gray-700 rounded-full px-3 py-1.5 go-btn-active hover:border-[#243FF7]/40"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-100 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); ask(input); }}
          className="flex items-center gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua dúvida..."
            className="flex-1 h-11 px-4 rounded-full bg-gray-100 text-[14px] outline-none focus:ring-2 focus:ring-[#243FF7]/30"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="w-11 h-11 rounded-full bg-[#243FF7] text-white flex items-center justify-center go-btn-active disabled:opacity-40"
            aria-label="Enviar"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <p className="text-[10px] text-gray-400 text-center mt-2 flex items-center justify-center gap-1">
          <LifeBuoy className="w-3 h-3" /> Precisa falar com um humano? Use o SOS ou a Central.
        </p>
      </div>
    </div>
  );
}
