import { FakeLLMProvider } from "./fake-llm.provider";

describe("FakeLLMProvider", () => {
  it("renvoie une réponse neutre quand rien n'est programmé, jamais une erreur", async () => {
    const provider = new FakeLLMProvider();
    const response = await provider.generate({ messages: [{ role: "user", content: "Bonjour" }] });
    expect(response.text).toBeDefined();
  });

  it("renvoie les réponses programmées dans l'ordre (FIFO), puis retombe sur le texte neutre", async () => {
    const provider = new FakeLLMProvider();
    provider.enqueue({ text: "Première réponse" });
    provider.enqueue({ toolCalls: [{ name: "finance-summary", arguments: { month: 8 } }] });

    const first = await provider.generate({ messages: [] });
    const second = await provider.generate({ messages: [] });
    const third = await provider.generate({ messages: [] });

    expect(first).toEqual({ text: "Première réponse" });
    expect(second.toolCalls).toEqual([{ name: "finance-summary", arguments: { month: 8 } }]);
    expect(third.text).toBeDefined();
  });
});
