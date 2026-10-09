/**
 * Implementação do contrato sobre localStorage.
 *
 * Nenhum arquivo fora de `lib/repository/` acessa `store.ts` — e `store.ts` é o
 * único que toca em `localStorage` (RNF-01).
 */

import { patients } from "./patients";
import { appointments } from "./appointments";
import { records } from "./records";
import { finance } from "./finance";
import { reports } from "./reports";
import { team } from "./team";
import { settings } from "./settings";
import { audit } from "./audit";
import { tasks } from "./tasks";
import { assistant } from "./assistant";
import { integrations } from "./integrations";

export const repository = {
  patients,
  appointments,
  records,
  finance,
  reports,
  team,
  settings,
  audit,
  tasks,
  assistant,
  integrations,
};
