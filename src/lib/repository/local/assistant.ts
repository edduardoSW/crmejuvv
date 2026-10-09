/**
 * Conversas do assistente, com pastas e fixação.
 *
 * As conversas são privadas de quem criou: o assistente responde sobre a
 * rotina daquela pessoa, dentro do escopo dela. Uma pasta pode ser ligada a
 * um paciente, para agrupar tudo o que se conversou sobre ele.
 */

import { RepoError } from "../errors";
import { db, tx, inOrg, newId, nowIso, requireFound } from "./helpers";
import type {
  AiConversation,
  AiFolder,
  AiMessage,
  Scope,
  Uuid,
} from "@/lib/domain/types";

function mine<T extends { org_id: Uuid; profile_id: Uuid }>(
  rows: T[],
  scope: Scope,
): T[] {
  return inOrg(rows, scope).filter((r) => r.profile_id === scope.profile_id);
}

export const assistant = {
  async listFolders(scope: Scope): Promise<AiFolder[]> {
    return mine(db().ai_folders, scope).sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR"),
    );
  },

  async createFolder(
    scope: Scope,
    input: { name: string; patient_id?: Uuid | null },
  ): Promise<AiFolder> {
    if (!input.name.trim()) throw new RepoError("validation", { field: "name" });
    return tx((data) => {
      const folder: AiFolder = {
        id: newId("aifd"),
        org_id: scope.org_id,
        profile_id: scope.profile_id,
        name: input.name.trim(),
        patient_id: input.patient_id ?? null,
        created_at: nowIso(),
      };
      data.ai_folders.push(folder);
      return folder;
    });
  },

  async renameFolder(scope: Scope, id: Uuid, name: string): Promise<AiFolder> {
    if (!name.trim()) throw new RepoError("validation", { field: "name" });
    return tx((data) => {
      const folder = requireFound(
        data.ai_folders.find((f) => f.id === id && f.org_id === scope.org_id),
      );
      folder.name = name.trim();
      return { ...folder };
    });
  },

  /** Apaga a pasta e solta as conversas — nenhuma conversa se perde junto. */
  async deleteFolder(scope: Scope, id: Uuid): Promise<void> {
    tx((data) => {
      data.ai_conversations
        .filter((c) => c.folder_id === id && c.org_id === scope.org_id)
        .forEach((c) => {
          c.folder_id = null;
        });
      const index = data.ai_folders.findIndex(
        (f) => f.id === id && f.org_id === scope.org_id,
      );
      if (index >= 0) data.ai_folders.splice(index, 1);
    });
  },

  async listConversations(scope: Scope): Promise<AiConversation[]> {
    return mine(db().ai_conversations, scope).sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return b.updated_at.localeCompare(a.updated_at);
    });
  },

  async createConversation(
    scope: Scope,
    input?: { title?: string; folder_id?: Uuid | null; patient_id?: Uuid | null },
  ): Promise<AiConversation> {
    return tx((data) => {
      const conversation: AiConversation = {
        id: newId("aicv"),
        org_id: scope.org_id,
        profile_id: scope.profile_id,
        title: input?.title?.trim() || "Nova conversa",
        folder_id: input?.folder_id ?? null,
        patient_id: input?.patient_id ?? null,
        is_pinned: false,
        messages: [],
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      data.ai_conversations.push(conversation);
      return conversation;
    });
  },

  async updateConversation(
    scope: Scope,
    id: Uuid,
    input: {
      title?: string;
      folder_id?: Uuid | null;
      patient_id?: Uuid | null;
      is_pinned?: boolean;
    },
  ): Promise<AiConversation> {
    return tx((data) => {
      const conversation = requireFound(
        data.ai_conversations.find(
          (c) => c.id === id && c.org_id === scope.org_id,
        ),
      );
      if (input.title !== undefined) conversation.title = input.title.trim();
      if (input.folder_id !== undefined) conversation.folder_id = input.folder_id;
      if (input.patient_id !== undefined) conversation.patient_id = input.patient_id;
      if (input.is_pinned !== undefined) conversation.is_pinned = input.is_pinned;
      conversation.updated_at = nowIso();
      return { ...conversation };
    });
  },

  async deleteConversation(scope: Scope, id: Uuid): Promise<void> {
    tx((data) => {
      const index = data.ai_conversations.findIndex(
        (c) => c.id === id && c.org_id === scope.org_id,
      );
      if (index >= 0) data.ai_conversations.splice(index, 1);
    });
  },

  /**
   * Acrescenta mensagem. A primeira pergunta vira o título da conversa —
   * do mesmo jeito que "Nova conversa" some assim que se digita algo.
   */
  async appendMessage(
    scope: Scope,
    id: Uuid,
    message: { from: "user" | "ai"; text: string },
  ): Promise<AiConversation> {
    return tx((data) => {
      const conversation = requireFound(
        data.ai_conversations.find(
          (c) => c.id === id && c.org_id === scope.org_id,
        ),
      );
      const entry: AiMessage = {
        id: newId("aims"),
        from: message.from,
        text: message.text,
        created_at: nowIso(),
      };
      conversation.messages.push(entry);

      if (
        message.from === "user" &&
        conversation.messages.filter((m) => m.from === "user").length === 1
      ) {
        conversation.title =
          message.text.length > 48
            ? `${message.text.slice(0, 48).trim()}…`
            : message.text;
      }

      conversation.updated_at = nowIso();
      return { ...conversation };
    });
  },
};
