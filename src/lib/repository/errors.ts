/**
 * Erros do repositório — tipados, nunca strings.
 * O componente decide a mensagem em pt-BR a partir do código.
 * Mapeamento para HTTP na fase 2: ver docs/04-contrato-api.md §2
 */

export type RepoErrorCode =
  | "not_found"
  | "forbidden"
  | "validation"
  | "conflict"
  | "locked"
  | "quota_exceeded";

export class RepoError extends Error {
  constructor(
    readonly code: RepoErrorCode,
    readonly detail?: Record<string, unknown>,
  ) {
    super(code);
    this.name = "RepoError";
  }
}

export const ERROR_MESSAGES: Record<RepoErrorCode, string> = {
  not_found: "Registro não encontrado.",
  forbidden:
    "Você não tem acesso a este registro. Se for evolução de outra profissional, peça para ela compartilhar.",
  validation: "Há campos inválidos no formulário.",
  conflict: "Este horário já está ocupado.",
  locked: "Esta evolução está assinada e não pode ser editada. Registre um adendo.",
  quota_exceeded:
    "Limite de armazenamento local atingido. Este protótipo guarda os dados no navegador (~5 MB).",
};

export function isRepoError(e: unknown): e is RepoError {
  return e instanceof RepoError;
}

export function messageFor(e: unknown): string {
  if (isRepoError(e)) return ERROR_MESSAGES[e.code];
  return "Ocorreu um erro inesperado.";
}
