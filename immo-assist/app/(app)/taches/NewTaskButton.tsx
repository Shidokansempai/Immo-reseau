"use client";

import { Plus } from "lucide-react";
import Modal from "@/components/Modal";
import { createTask } from "../actions";
import { TASK_KIND } from "@/lib/format";

export default function NewTaskButton({ contacts }: { contacts: { id: string; name: string }[] }) {
  return (
    <Modal title="Nouvelle tâche" trigger={<button className="btn-gold"><Plus size={16} /> Nouvelle tâche</button>}>
      {(close) => (
        <form action={async (fd) => { await createTask(fd); close(); }} className="space-y-4">
          <div>
            <label className="label">Intitulé</label>
            <input name="title" className="input" required placeholder="Ex. Rappeler M. Payet" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select name="kind" className="input">
                {Object.entries(TASK_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Priorité</label>
              <select name="priority" className="input" defaultValue="NORMAL">
                <option value="LOW">Basse</option>
                <option value="NORMAL">Normale</option>
                <option value="HIGH">Haute</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Échéance</label>
              <input name="dueAt" type="date" className="input" />
            </div>
            <div>
              <label className="label">Contact lié (optionnel)</label>
              <select name="contactId" className="input">
                <option value="">—</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn-ghost">Annuler</button>
            <button type="submit" className="btn-primary">Créer</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
