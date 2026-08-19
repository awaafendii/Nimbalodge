import { StatelessConversationProvider } from "./stateless-conversation.provider";
import type { AuthenticatedUser } from "../../../common/types/authenticated-request";

describe("StatelessConversationProvider", () => {
  const user: AuthenticatedUser = { id: "user-1", organizationId: "org-1", hotelId: "hotel-1" };

  it("renvoie l'historique fourni par le client tel quel", async () => {
    const provider = new StatelessConversationProvider();
    const history = [{ role: "user" as const, content: "Bonjour" }];

    await expect(provider.getHistory("conv-1", user, history)).resolves.toBe(history);
  });

  it("renvoie un tableau vide quand aucun historique n'est fourni (première question)", async () => {
    const provider = new StatelessConversationProvider();
    await expect(provider.getHistory("conv-1", user)).resolves.toEqual([]);
  });

  it("appendMessage ne persiste rien et ne lève jamais d'erreur", async () => {
    const provider = new StatelessConversationProvider();
    await expect(provider.appendMessage("conv-1", { role: "assistant", content: "Réponse" }, user)).resolves.toBeUndefined();
  });
});
