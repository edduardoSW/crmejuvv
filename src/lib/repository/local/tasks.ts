/**
 * Tarefas da equipe.
 *
 * `bucket` governa as duas visões: coluna no Kanban, seção recolhível na lista.
 * `position` mantém a ordem dentro da coluna quando se arrasta um cartão.
 */

import { RepoError } from "../errors";
import { db, tx, inOrg, newId, nowIso, requireFound } from "./helpers";
import type {
  Scope,
  Task,
  TaskBucket,
  TaskPriority,
  TaskStatus,
  Uuid,
} from "@/lib/domain/types";

export interface TaskInput {
  title: string;
  description?: string | null;
  bucket?: TaskBucket;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  patient_id?: Uuid | null;
  assignee_id?: Uuid | null;
}

export const tasks = {
  async list(
    scope: Scope,
    params?: { assignee_id?: Uuid | "mine"; patient_id?: Uuid; search?: string },
  ): Promise<Task[]> {
    let rows = inOrg(db().tasks, scope);

    if (params?.assignee_id === "mine") {
      rows = rows.filter((t) => t.assignee_id === scope.profile_id);
    } else if (params?.assignee_id) {
      rows = rows.filter((t) => t.assignee_id === params.assignee_id);
    }
    if (params?.patient_id) {
      rows = rows.filter((t) => t.patient_id === params.patient_id);
    }
    if (params?.search) {
      const q = params.search.toLowerCase().trim();
      rows = rows.filter((t) => t.title.toLowerCase().includes(q));
    }

    return rows.sort(
      (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
    );
  },

  async create(scope: Scope, input: TaskInput): Promise<Task> {
    if (!input.title.trim()) {
      throw new RepoError("validation", { field: "title" });
    }
    return tx((data) => {
      const bucket = input.bucket ?? "hoje";
      const last = data.tasks
        .filter((t) => t.org_id === scope.org_id && t.bucket === bucket)
        .reduce((max, t) => Math.max(max, t.position), 0);

      const task: Task = {
        id: newId("task"),
        org_id: scope.org_id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        bucket,
        status: input.status ?? "pendente",
        priority: input.priority ?? "media",
        due_date: input.due_date || null,
        patient_id: input.patient_id ?? null,
        assignee_id: input.assignee_id ?? scope.profile_id,
        created_by: scope.profile_id,
        position: last + 1,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      data.tasks.push(task);
      return task;
    });
  },

  async update(scope: Scope, id: Uuid, input: Partial<TaskInput>): Promise<Task> {
    return tx((data) => {
      const task = requireFound(
        data.tasks.find((t) => t.id === id && t.org_id === scope.org_id),
      );
      if (input.title !== undefined) task.title = input.title.trim();
      if (input.description !== undefined) {
        task.description = input.description?.trim() || null;
      }
      if (input.bucket !== undefined) task.bucket = input.bucket;
      if (input.status !== undefined) task.status = input.status;
      if (input.priority !== undefined) task.priority = input.priority;
      if (input.due_date !== undefined) task.due_date = input.due_date || null;
      if (input.patient_id !== undefined) task.patient_id = input.patient_id;
      if (input.assignee_id !== undefined) task.assignee_id = input.assignee_id;
      task.updated_at = nowIso();
      return { ...task };
    });
  },

  /**
   * Move entre colunas e reordena. `beforeId` é o cartão que deve ficar
   * logo abaixo do que está sendo solto — null joga para o fim da coluna.
   */
  async move(
    scope: Scope,
    id: Uuid,
    bucket: TaskBucket,
    beforeId?: Uuid | null,
  ): Promise<Task> {
    return tx((data) => {
      const task = requireFound(
        data.tasks.find((t) => t.id === id && t.org_id === scope.org_id),
      );

      task.bucket = bucket;
      // Concluir pela coluna também acerta o status — senão a tarefa fica
      // "concluída" com selo de pendente, que é o tipo de incoerência que
      // faz o usuário desconfiar do sistema inteiro.
      if (bucket === "concluidas") task.status = "feito";
      else if (task.status === "feito") task.status = "fazendo";

      const column = data.tasks
        .filter(
          (t) => t.org_id === scope.org_id && t.bucket === bucket && t.id !== id,
        )
        .sort((a, b) => a.position - b.position);

      const index = beforeId
        ? column.findIndex((t) => t.id === beforeId)
        : column.length;

      column.splice(index < 0 ? column.length : index, 0, task);
      column.forEach((t, i) => {
        t.position = i + 1;
      });

      task.updated_at = nowIso();
      return { ...task };
    });
  },

  async remove(scope: Scope, id: Uuid): Promise<void> {
    tx((data) => {
      const index = data.tasks.findIndex(
        (t) => t.id === id && t.org_id === scope.org_id,
      );
      if (index >= 0) data.tasks.splice(index, 1);
    });
  },
};
