import { RepoError } from "../errors";
import { db, tx, inOrg, newId, resetToSeed } from "./helpers";
import { hasPermission } from "@/lib/domain/types";
import type {
  HealthPlan,
  Organization,
  Room,
  Scope,
  Service,
  ServicePrice,
  Template,
  Uuid,
} from "@/lib/domain/types";

export const settings = {
  async organizations(): Promise<Organization[]> {
    return db().organizations;
  },

  async healthPlans(scope: Scope): Promise<HealthPlan[]> {
    return inOrg(db().health_plans, scope).filter((p) => p.is_active);
  },

  async services(scope: Scope): Promise<Service[]> {
    return inOrg(db().services, scope).filter((s) => s.is_active);
  },

  async servicePrices(scope: Scope): Promise<ServicePrice[]> {
    return inOrg(db().service_prices, scope);
  },

  async rooms(scope: Scope): Promise<Room[]> {
    return inOrg(db().rooms, scope).filter((r) => r.is_active);
  },

  async templates(
    scope: Scope,
    kind?: Template["kind"],
  ): Promise<Template[]> {
    const rows = inOrg(db().templates, scope);
    return kind ? rows.filter((t) => t.kind === kind) : rows;
  },

  async upsertHealthPlan(
    scope: Scope,
    input: { id?: Uuid; name: string; ans_code?: string | null; logo_url?: string | null },
  ): Promise<HealthPlan> {
    if (!hasPermission(scope, "settings.manage")) throw new RepoError("forbidden");
    if (!input.name.trim()) throw new RepoError("validation", { field: "name" });

    return tx((data) => {
      if (input.id) {
        const plan = data.health_plans.find((p) => p.id === input.id);
        if (!plan) throw new RepoError("not_found");
        plan.name = input.name.trim();
        plan.ans_code = input.ans_code ?? plan.ans_code;
        if (input.logo_url !== undefined) plan.logo_url = input.logo_url;
        return { ...plan };
      }
      const plan: HealthPlan = {
        id: newId("plan"),
        org_id: scope.org_id,
        name: input.name.trim(),
        ans_code: input.ans_code ?? null,
        logo_url: input.logo_url ?? null,
        is_active: true,
      };
      data.health_plans.push(plan);
      return plan;
    });
  },

  async upsertService(
    scope: Scope,
    input: { id?: Uuid; name: string; duration_minutes: number },
  ): Promise<Service> {
    if (!hasPermission(scope, "settings.manage")) throw new RepoError("forbidden");
    return tx((data) => {
      if (input.id) {
        const service = data.services.find((s) => s.id === input.id);
        if (!service) throw new RepoError("not_found");
        Object.assign(service, {
          name: input.name.trim(),
          duration_minutes: input.duration_minutes,
        });
        return { ...service };
      }
      const service: Service = {
        id: newId("serv"),
        org_id: scope.org_id,
        name: input.name.trim(),
        duration_minutes: input.duration_minutes,
        is_active: true,
      };
      data.services.push(service);
      return service;
    });
  },

  async upsertRoom(
    scope: Scope,
    input: { id?: Uuid; name: string },
  ): Promise<Room> {
    if (!hasPermission(scope, "settings.manage")) throw new RepoError("forbidden");
    return tx((data) => {
      if (input.id) {
        const room = data.rooms.find((r) => r.id === input.id);
        if (!room) throw new RepoError("not_found");
        room.name = input.name.trim();
        return { ...room };
      }
      const room: Room = {
        id: newId("room"),
        org_id: scope.org_id,
        name: input.name.trim(),
        is_active: true,
      };
      data.rooms.push(room);
      return room;
    });
  },

  /** Preço de um serviço por convênio (null = particular). Cria ou atualiza. */
  async setServicePrice(
    scope: Scope,
    input: { service_id: Uuid; health_plan_id: Uuid | null; price: number },
  ): Promise<ServicePrice> {
    if (!hasPermission(scope, "settings.manage")) throw new RepoError("forbidden");
    if (!Number.isFinite(input.price) || input.price < 0) {
      throw new RepoError("validation", { field: "price" });
    }
    return tx((data) => {
      const existing = data.service_prices.find(
        (p) =>
          p.org_id === scope.org_id &&
          p.service_id === input.service_id &&
          p.health_plan_id === input.health_plan_id,
      );
      if (existing) {
        existing.price = input.price;
        return { ...existing };
      }
      const price: ServicePrice = {
        id: newId("prcs"),
        org_id: scope.org_id,
        service_id: input.service_id,
        health_plan_id: input.health_plan_id,
        price: input.price,
      };
      data.service_prices.push(price);
      return price;
    });
  },

  async updateTemplate(
    scope: Scope,
    id: Uuid,
    input: { name?: string; body?: string },
  ): Promise<Template> {
    if (!hasPermission(scope, "settings.manage")) throw new RepoError("forbidden");
    return tx((data) => {
      const template = data.templates.find(
        (t) => t.id === id && t.org_id === scope.org_id,
      );
      if (!template) throw new RepoError("not_found");
      if (input.name !== undefined) template.name = input.name.trim();
      if (input.body !== undefined) template.body = input.body;
      return { ...template };
    });
  },

  /**
   * Quantos registros dependem de um cadastro. A UI mostra isto ANTES de
   * excluir — remover um convênio com 80 pacientes vinculados não pode ser
   * um clique distraído.
   */
  async usageOf(
    scope: Scope,
    kind: "plan" | "service" | "room",
    id: Uuid,
  ): Promise<number> {
    const data = db();
    if (kind === "plan") {
      return data.patients.filter(
        (p) => p.org_id === scope.org_id && p.health_plan_id === id,
      ).length;
    }
    if (kind === "service") {
      return data.appointments.filter(
        (a) => a.org_id === scope.org_id && a.service_id === id,
      ).length;
    }
    return data.appointments.filter(
      (a) => a.org_id === scope.org_id && a.room_id === id,
    ).length;
  },

  /**
   * Desativa em vez de apagar: registro histórico que aponta para o cadastro
   * continua íntegro. `is_active: false` some das listas e dos seletores.
   */
  async archive(
    scope: Scope,
    kind: "plan" | "service" | "room",
    id: Uuid,
  ): Promise<void> {
    if (!hasPermission(scope, "settings.manage")) throw new RepoError("forbidden");
    tx((data) => {
      const list =
        kind === "plan"
          ? data.health_plans
          : kind === "service"
            ? data.services
            : data.rooms;
      const row = list.find((r) => r.id === id && r.org_id === scope.org_id);
      if (!row) throw new RepoError("not_found");
      row.is_active = false;
    });
  },

  /** Restaura a base de demonstração (RF-07.9). Determinística: sempre igual. */
  async resetDemoData(): Promise<void> {
    resetToSeed();
  },
};
