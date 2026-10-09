"use client";

/**
 * Editar, arquivar e excluir paciente.
 *
 * Arquivar é o caminho normal: preserva sessões, evoluções e histórico
 * financeiro. Excluir apaga tudo em cascata — existe para cadastro duplicado
 * ou errado, e por isso exige confirmação por digitação.
 */

import { useEffect, useState } from "react";
import { repo, messageFor } from "@/lib/repository";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { HealthPlan, Patient, Profile, Scope } from "@/lib/domain/types";

export function PatientActions({
  scope,
  patient,
  professionals,
  plans,
  onChanged,
  onDeleted,
}: {
  scope: Scope;
  patient: Patient;
  professionals: Profile[];
  plans: HealthPlan[];
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [impact, setImpact] = useState<string[]>([]);

  const fullName = `${patient.first_name} ${patient.last_name ?? ""}`.trim();

  async function openDelete() {
    const i = await repo.patients.removalImpact(scope, patient.id);
    const lines: string[] = [];
    if (i.appointments) lines.push(`${i.appointments} sessões da agenda`);
    if (i.records) lines.push(`${i.records} evoluções do prontuário`);
    if (i.entries) lines.push(`${i.entries} lançamentos financeiros`);
    if (i.notes) lines.push(`${i.notes} anotações`);
    if (i.documents) lines.push(`${i.documents} documentos anexados`);
    setImpact(lines.length ? lines : ["Nenhum registro vinculado"]);
    setDeleting(true);
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
          Editar dados
        </button>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setArchiving(true)}
        >
          {patient.status === "active" ? "Arquivar" : "Reativar"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm text-[var(--color-danger)]"
          onClick={openDelete}
        >
          Excluir
        </button>
      </div>

      <EditPatientModal
        open={editing}
        scope={scope}
        patient={patient}
        professionals={professionals}
        plans={plans}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); onChanged(); }}
      />

      <ConfirmDialog
        open={archiving}
        onClose={() => setArchiving(false)}
        tone="warn"
        title={patient.status === "active" ? "Arquivar paciente" : "Reativar paciente"}
        description={
          patient.status === "active"
            ? `${fullName} sai das listas ativas e dos seletores de agendamento. Todo o histórico continua guardado e pode ser reativado a qualquer momento.`
            : `${fullName} volta a aparecer nas listas ativas e pode ser agendado novamente.`
        }
        confirmLabel={patient.status === "active" ? "Arquivar" : "Reativar"}
        onConfirm={async () => {
          await repo.patients.update(scope, patient.id, {
            status: patient.status === "active" ? "inactive" : "active",
          });
          setArchiving(false);
          onChanged();
        }}
      />

      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Excluir paciente definitivamente"
        description={`${fullName} e todo o histórico vinculado serão apagados. Não há como desfazer. Se a intenção é só tirar da lista, use Arquivar.`}
        consequences={impact}
        confirmText="EXCLUIR"
        confirmLabel="Excluir tudo"
        onConfirm={async () => {
          await repo.patients.remove(scope, patient.id);
          setDeleting(false);
          onDeleted();
        }}
      />
    </>
  );
}

function EditPatientModal({
  open, scope, patient, professionals, plans, onClose, onSaved,
}: {
  open: boolean;
  scope: Scope;
  patient: Patient;
  professionals: Profile[];
  plans: HealthPlan[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    first_name: "", last_name: "", phone: "", email: "", cpf: "",
    date_of_birth: "", owner_id: "", payment_type: "convenio" as "convenio" | "particular",
    health_plan_id: "", health_plan_number: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      first_name: patient.first_name,
      last_name: patient.last_name ?? "",
      phone: patient.phone,
      email: patient.email ?? "",
      cpf: patient.cpf ?? "",
      date_of_birth: patient.date_of_birth ?? "",
      owner_id: patient.owner_id,
      payment_type: patient.payment_type,
      health_plan_id: patient.health_plan_id ?? plans[0]?.id ?? "",
      health_plan_number: patient.health_plan_number ?? "",
    });
  }, [open, patient, plans]);

  async function save() {
    try {
      await repo.patients.update(scope, patient.id, {
        first_name: form.first_name,
        last_name: form.last_name || null,
        phone: form.phone,
        email: form.email || null,
        cpf: form.cpf || null,
        date_of_birth: form.date_of_birth || null,
        owner_id: form.owner_id,
        payment_type: form.payment_type,
        health_plan_id: form.payment_type === "convenio" ? form.health_plan_id : null,
        health_plan_number:
          form.payment_type === "convenio" ? form.health_plan_number : null,
      });
      onSaved();
    } catch (e) { setError(messageFor(e)); }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar paciente"
      description="Corrija qualquer dado do cadastro."
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={save}
            disabled={!form.first_name.trim() || !form.phone.trim()}
          >
            Salvar alterações
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="enome">Nome *</label>
          <input id="enome" className="field" value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="esobre">Sobrenome</label>
          <input id="esobre" className="field" value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="etel">Telefone *</label>
          <input id="etel" className="field" value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" type="email" className="field" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="ecpf">CPF</label>
          <input id="ecpf" className="field" value={form.cpf}
            onChange={(e) => setForm({ ...form, cpf: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="enasc">Nascimento</label>
          <input id="enasc" type="date" className="field" value={form.date_of_birth}
            onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
        </div>

        <div className="sm:col-span-2">
          <span className="label">Responsável</span>
          <Select
            label="Responsável"
            value={form.owner_id}
            onChange={(v) => setForm({ ...form, owner_id: v })}
            options={professionals.map((p) => ({ value: p.id, label: p.full_name }))}
          />
        </div>

        <div className="sm:col-span-2">
          <span className="label">Forma de pagamento</span>
          <div className="flex gap-2">
            {(["convenio", "particular"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm({ ...form, payment_type: t })}
                className={`btn btn-sm flex-1 ${form.payment_type === t ? "btn-primary" : "btn-outline"}`}
              >
                {t === "convenio" ? "Convênio" : "Particular"}
              </button>
            ))}
          </div>
        </div>

        {form.payment_type === "convenio" && (
          <>
            <div>
              <span className="label">Convênio</span>
              <Select
                label="Convênio"
                value={form.health_plan_id}
                onChange={(v) => setForm({ ...form, health_plan_id: v })}
                options={plans.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="ecart">Carteirinha</label>
              <input id="ecart" className="field" value={form.health_plan_number}
                onChange={(e) => setForm({ ...form, health_plan_number: e.target.value })} />
            </div>
          </>
        )}

        {error && (
          <p className="sm:col-span-2 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
