/**
 * Ponto único de acesso a dados.
 *
 * Componentes importam APENAS daqui — nunca de `./local/*`.
 * Trocar o protótipo por backend real é substituir a linha de export abaixo.
 * Ver docs/04-contrato-api.md
 */

export { RepoError, messageFor, isRepoError, ERROR_MESSAGES } from "./errors";
export type { RepoErrorCode } from "./errors";
export type { Page, ListParams, Conflict } from "./contract";

import * as local from "./local";

export const repo = local.repository;
export type Repository = typeof local.repository;
