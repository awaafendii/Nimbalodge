import { type KeyboardEvent, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Icons, Textarea } from "@nimbalodge/ui";

import { useChat } from "../../hooks/use-nimba-ai.js";
import type { ChatMessage, ChatToolResult, Provenance } from "../../services/nimba-ai.js";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  toolResults?: ChatToolResult[];
  provenance?: Provenance[];
  disclaimer?: string;
}

function newConversationId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `conv-${Date.now()}`;
}

// Nimba AI (Étape 9 — Assistant conversationnel). v1 sans état côté serveur : la transcription
// vit uniquement dans ce composant (state React) et est renvoyée en entier à chaque tour (voir
// StatelessConversationProvider). Une réponse ne montre jamais UNIQUEMENT le texte généré par le
// LLM quand des chiffres sont en jeu — `toolResults`/`provenance` sont toujours affichés à côté de
// `answer`, jamais masqués (voir le plan d'architecture Nimba AI, "Sources / provenance").
export default function ChatPage() {
  const [conversationId] = useState(newConversationId);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const chat = useChat();

  const send = () => {
    const trimmed = input.trim();
    if (!trimmed || chat.isPending) return;

    const history: ChatMessage[] = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");

    chat.mutate(
      { message: trimmed, conversationId, history },
      {
        onSuccess: (response) => {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: response.answer ?? response.disclaimer ?? "Aucune réponse disponible.",
              toolResults: response.toolResults,
              provenance: response.provenance,
              disclaimer: response.answer ? response.disclaimer : undefined,
            },
          ]);
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Une erreur est survenue lors de l'envoi de votre question. Réessayez." },
          ]);
        },
      }
    );
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <Card className="flex h-[calc(100vh-220px)] min-h-[420px] flex-col">
      <CardHeader>
        <CardTitle>Assistant Nimba AI</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Posez une question sur vos données (finance, occupation, RH, anomalies...). L'assistant ne répond qu'à partir des
              données auxquelles vous avez accès.
            </p>
          ) : null}
          {messages.map((message, index) => (
            <ChatBubble key={index} message={message} />
          ))}
          {chat.isPending ? <p className="text-sm text-muted-foreground">Nimba AI réfléchit…</p> : null}
        </div>
        <div className="flex gap-2 border-t border-border pt-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question à Nimba AI…"
            className="min-h-[44px] flex-1 resize-none"
            disabled={chat.isPending}
          />
          <Button onClick={send} disabled={chat.isPending || !input.trim()}>
            <Icons.IconSparkles />
            Envoyer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChatBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex flex-col gap-2 rounded-lg border border-border p-3 ${isUser ? "self-end bg-secondary" : "self-start"}`}>
      <p className="whitespace-pre-wrap text-sm text-foreground">{message.content}</p>
      {message.toolResults && message.toolResults.length > 0 ? (
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          {message.toolResults.map((result, index) => (
            <details key={index} className="text-xs text-muted-foreground">
              <summary className="cursor-pointer">Données source — {result.tool}</summary>
              <pre className="mt-1 overflow-x-auto rounded bg-background p-2">{JSON.stringify(result.data, null, 2)}</pre>
            </details>
          ))}
        </div>
      ) : null}
      {message.provenance && message.provenance.length > 0 ? (
        <p className="text-xs text-muted-foreground">Source : {message.provenance.map((p) => p.module).join(", ")}</p>
      ) : null}
      {message.disclaimer ? <Badge variant="neutral">{message.disclaimer}</Badge> : null}
    </div>
  );
}
