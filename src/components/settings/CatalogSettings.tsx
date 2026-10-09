"use client";

/**
 * Convênios, serviços e salas — em card, com criação e edição por modal.
 *
 * Arquivar em vez de apagar: lançamento antigo que aponta para o convênio
 * continua íntegro. A UI mostra quantos registros dependem do cadastro antes
 * de arquivar.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { repo, messageFor } from "@/lib/repository";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { resizeImage } from "@/components/ui/Avatar";
import { brl } from "@/lib/format";
import type { HealthPlan, Room, Service, ServicePrice } from "@/lib/domain/types";
import { IconCalendar, IconMoney, IconPlus, IconRecord } from "@/components/icons";

type Kind = "convenios" | "servicos" | "salas";

export function CatalogSettings({ kind }: { kind: Kind }) {
  const { scope, revision } = useApp();
  const [plans, setPlans] = useState<HealthPlan[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [prices, setPrices] = useState<ServicePrice[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [planModal, setPlanModal] = useState<HealthPlan | "new" | null>(null);
  const [serviceModal, setServiceModal] = useState<Service | "new" | null>(null);
  const [roomModal, setRoomModal] = useState<Room | "new" | null>(null);
  const [archiving, setArchiving] = useState<
    { kind: "plan" | "service" | "room"; id: string; name: string; usage: number } | null
  >(null);

  const load = useCallback(async () => {
    if (!scope) return;
    const [p, s, pr, r] = await Promise.all([
      repo.settings.healthPlans(scope),
      repo.settings.services(scope),
      repo.settings.servicePrices(scope),
      repo.settings.rooms(scope),
    ]);
    setPlans(p);
    setServices(s);
    setPrices(pr);
    setRooms(r);
  }, [scope]);

  useEffect(() => { load(); }, [load, revision]);

  if (!scope) return null;

  const priceOf = (serviceId: string, planId: string | null) =>
    prices.find((x) => x.service_id === serviceId && x.health_plan_id === planId)?.price ?? 0;

  async function askArchive(k: "plan" | "service" | "room", id: string, name: string) {
    if (!scope) return;
    const usage = await repo.settings.usageOf(scope, k, id);
    setArchiving({ kind: k, id, name, usage });
  }

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------- convênios */}
      {kind === "convenios" && (
        <>
          <SectionHeader
            title="Convênios atendidos"
            hint="Operadoras que você atende. A logo aparece nas listas e nos relatórios."
            action={() => setPlanModal("new")}
            actionLabel="Novo convênio"
          />
          <Grid empty={plans.length === 0} emptyText="Nenhum convênio cadastrado.">
            {plans.map((plan) => (
              <article key={plan.id} className="card flex flex-col gap-4 p-5">
                <div className="flex items-start gap-3.5">
                  <Logo name={plan.name} src={plan.logo_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight">{plan.name}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--color-ink-muted)]">
                      {plan.ans_code ? `Registro ANS ${plan.ans_code}` : "Sem registro ANS"}
                    </p>
                  </div>
                </div>
                <CardActions
                  onEdit={() => setPlanModal(plan)}
                  onArchive={() => askArchive("plan", plan.id, plan.name)}
                />
              </article>
            ))}
          </Grid>
        </>
      )}

      {/* -------------------------------------------------- serviços */}
      {kind === "servicos" && (
        <>
          <SectionHeader
            title="Serviços e valores"
            hint="Valor particular e por convênio. Clique no valor para editar."
            action={() => setServiceModal("new")}
            actionLabel="Novo serviço"
          />
          <Grid empty={services.length === 0} emptyText="Nenhum serviço cadastrado.">
            {services.map((service) => (
              <article key={service.id} className="card flex flex-col gap-4 p-5">
                <div className="flex items-start gap-3.5">
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px]"
                    style={{
                      background: "var(--color-accent-soft)",
                      color: "var(--color-accent-ink)",
                    }}
                    aria-hidden="true"
                  >
                    <IconCalendar width={20} height={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight">{service.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                      {service.duration_minutes} minutos
                    </p>
                  </div>
                </div>

                <dl className="space-y-1.5 rounded-[12px] bg-[var(--color-surface-2)] p-3">
                  <PriceRow
                    scope={scope}
                    serviceId={service.id}
                    planId={null}
                    label="Particular"
                    value={priceOf(service.id, null)}
                    onSaved={load}
                  />
                  {plans.map((plan) => (
                    <PriceRow
                      key={plan.id}
                      scope={scope}
                      serviceId={service.id}
                      planId={plan.id}
                      label={plan.name}
                      value={priceOf(service.id, plan.id)}
                      onSaved={load}
                    />
                  ))}
                </dl>

                <CardActions
                  onEdit={() => setServiceModal(service)}
                  onArchive={() => askArchive("service", service.id, service.name)}
                />
              </article>
            ))}
          </Grid>
        </>
      )}

      {/* ------------------------------------------------------ salas */}
      {kind === "salas" && (
        <>
          <SectionHeader
            title="Salas"
            hint="Cada sala é um recurso: duas sessões não ocupam a mesma sala no mesmo horário."
            action={() => setRoomModal("new")}
            actionLabel="Nova sala"
          />
          <Grid empty={rooms.length === 0} emptyText="Nenhuma sala cadastrada.">
            {rooms.map((room) => (
              <article key={room.id} className="card flex flex-col gap-4 p-5">
                <div className="flex items-start gap-3.5">
                  <span
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px]"
                    style={{
                      background: "var(--color-gold-soft)",
                      color: "var(--color-gold-ink)",
                    }}
                    aria-hidden="true"
                  >
                    <IconRecord width={20} height={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight">{room.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">Ativa</p>
                  </div>
                </div>
                <CardActions
                  onEdit={() => setRoomModal(room)}
                  onArchive={() => askArchive("room", room.id, room.name)}
                />
              </article>
            ))}
          </Grid>
        </>
      )}

      <PlanModal
        target={planModal}
        onClose={() => setPlanModal(null)}
        onSaved={() => { setPlanModal(null); load(); }}
      />
      <SimpleModal
        target={serviceModal}
        kind="service"
        onClose={() => setServiceModal(null)}
        onSaved={() => { setServiceModal(null); load(); }}
      />
      <SimpleModal
        target={roomModal}
        kind="room"
        onClose={() => setRoomModal(null)}
        onSaved={() => { setRoomModal(null); load(); }}
      />

      <ConfirmDialog
        open={archiving !== null}
        onClose={() => setArchiving(null)}
        tone="warn"
        title={`Arquivar ${archiving?.name ?? ""}`}
        description="O cadastro sai das listas e dos seletores. Nada do histórico é apagado: lançamentos e sessões antigas continuam apontando para ele."
        consequences={
          archiving && archiving.usage > 0
            ? [`${archiving.usage} registros usam este cadastro hoje`]
            : undefined
        }
        confirmLabel="Arquivar"
        onConfirm={async () => {
          if (!archiving || !scope) return;
          await repo.settings.archive(scope, archiving.kind, archiving.id);
          setArchiving(null);
          load();
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------- apoio */

function SectionHeader({
  title, hint, action, actionLabel,
}: {
  title: string;
  hint: string;
  action: () => void;
  actionLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2>{title}</h2>
        <p className="mt-0.5 max-w-xl text-sm text-[var(--color-ink-muted)]">{hint}</p>
      </div>
      <button type="button" className="btn btn-primary btn-sm" onClick={action}>
        <IconPlus width={15} height={15} />
        {actionLabel}
      </button>
    </div>
  );
}

function Grid({
  children, empty, emptyText,
}: {
  children: React.ReactNode;
  empty: boolean;
  emptyText: string;
}) {
  if (empty) {
    return (
      <div className="card grid place-items-center px-6 py-12 text-center">
        <p className="text-sm text-[var(--color-ink-muted)]">{emptyText}</p>
      </div>
    );
  }
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
    >
      {children}
    </div>
  );
}

function CardActions({ onEdit, onArchive }: { onEdit: () => void; onArchive: () => void }) {
  return (
    <div className="mt-auto flex gap-2 border-t border-[var(--color-line)] pt-3">
      <button type="button" className="btn btn-outline btn-sm flex-1" onClick={onEdit}>
        Editar
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-sm text-[var(--color-ink-muted)]"
        onClick={onArchive}
      >
        Arquivar
      </button>
    </div>
  );
}

/** Bola de logo: imagem quando existe, monograma colorido quando não. */
function Logo({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-12 w-12 shrink-0 rounded-full border border-[var(--color-line)] object-contain"
        style={{ background: "#fff" }}
      />
    );
  }
  return (
    <span
      className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-medium"
      style={{ background: "var(--color-info-soft)", color: "var(--color-info)" }}
      aria-hidden="true"
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

function PriceRow({
  scope, serviceId, planId, label, value, onSaved,
}: {
  scope: import("@/lib/domain/types").Scope;
  serviceId: string;
  planId: string | null;
  label: string;
  value: number;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <dt className="min-w-0 truncate text-[var(--color-ink-muted)]">{label}</dt>
      {editing ? (
        <input
          autoFocus
          className="field h-7 w-24 text-right text-sm"
          value={draft}
          inputMode="decimal"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={async () => {
            setEditing(false);
            const price = Number(draft.replace(",", "."));
            if (Number.isFinite(price) && price !== value) {
              await repo.settings.setServicePrice(scope, {
                service_id: serviceId,
                health_plan_id: planId,
                price,
              });
              onSaved();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
          }}
        />
      ) : (
        <dd>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="tabular rounded px-1.5 py-0.5 font-[family-name:var(--font-mono)] hover:bg-[var(--color-surface)]"
          >
            {brl(value)}
          </button>
        </dd>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- modais */

function PlanModal({
  target, onClose, onSaved,
}: {
  target: HealthPlan | "new" | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { scope } = useApp();
  const [name, setName] = useState("");
  const [ans, setAns] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!target) return;
    setError(null);
    if (target === "new") { setName(""); setAns(""); setLogo(null); }
    else { setName(target.name); setAns(target.ans_code ?? ""); setLogo(target.logo_url); }
  }, [target]);

  if (!target || !scope) return null;

  return (
    <Modal
      open
      onClose={onClose}
      title={target === "new" ? "Novo convênio" : "Editar convênio"}
      description="Nome, registro ANS e logo da operadora."
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!name.trim()}
            onClick={async () => {
              try {
                await repo.settings.upsertHealthPlan(scope, {
                  id: target === "new" ? undefined : target.id,
                  name,
                  ans_code: ans || null,
                  logo_url: logo,
                });
                onSaved();
              } catch (e) { setError(messageFor(e)); }
            }}
          >
            Salvar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Logo name={name || "??"} src={logo} />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Logo do convênio"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) setLogo(await resizeImage(file, 192));
              }}
            />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => fileRef.current?.click()}
            >
              {logo ? "Trocar logo" : "Enviar logo"}
            </button>
            {logo && (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-[var(--color-danger)]"
                onClick={() => setLogo(null)}
              >
                Remover
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="cv-nome">Nome da operadora</label>
          <input
            id="cv-nome"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Petrobras"
          />
        </div>

        <div>
          <label className="label" htmlFor="cv-ans">Registro ANS (opcional)</label>
          <input
            id="cv-ans"
            className="field"
            value={ans}
            onChange={(e) => setAns(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

function SimpleModal({
  target, kind, onClose, onSaved,
}: {
  target: Service | Room | "new" | null;
  kind: "service" | "room";
  onClose: () => void;
  onSaved: () => void;
}) {
  const { scope } = useApp();
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("50");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!target) return;
    setError(null);
    if (target === "new") { setName(""); setDuration("50"); }
    else {
      setName(target.name);
      if ("duration_minutes" in target) setDuration(String(target.duration_minutes));
    }
  }, [target]);

  if (!target || !scope) return null;
  const isService = kind === "service";

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={
        target === "new"
          ? isService ? "Novo serviço" : "Nova sala"
          : isService ? "Editar serviço" : "Editar sala"
      }
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!name.trim()}
            onClick={async () => {
              try {
                const id = target === "new" ? undefined : target.id;
                if (isService) {
                  await repo.settings.upsertService(scope, {
                    id, name, duration_minutes: Number(duration) || 50,
                  });
                } else {
                  await repo.settings.upsertRoom(scope, { id, name });
                }
                onSaved();
              } catch (e) { setError(messageFor(e)); }
            }}
          >
            Salvar
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="sm-nome">Nome</label>
          <input
            id="sm-nome"
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isService ? "Ex.: Sessão individual" : "Ex.: Sala 4"}
          />
        </div>
        {isService && (
          <div>
            <label className="label" htmlFor="sm-dur">Duração (minutos)</label>
            <input
              id="sm-dur"
              type="number"
              className="field"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
