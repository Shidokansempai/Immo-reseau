"use client";

import Modal from "@/components/Modal";
import { MessageSquarePlus } from "lucide-react";
import { logInteraction } from "../../actions";
import { INTERACTION_TYPE } from "@/lib/format";

export default function LogInteraction({ contactId }: { contactId: string }) {
  return (
    <Modal
      title="Consigner une interaction"
      trigger={<button className="btn-primary"><MessageSquarePlus size={16} /> Consigner</button>}
    >
      {(close) => (
        <form action={async (fd) => { await logInteraction(fd); close(); }} className="space-y-4">
          <input type="hidden" name="contactId" value={contactId} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select name="type" className="input" defaultValue="CALL">
                {Object.entries(INTERACTION_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sens</label>
              <select name="direction" className="input">
                <option value="OUTBOUND">Sortant</option>
                <option value="INBOUND">Entrant</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Objet / résumé</label>
            <input name="subject" className="input" placeholder="Ex. Discussion prix, RDV pris…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Résultat</label>
              <input name="outcome" className="input" placeholder="RDV pris / sans réponse…" />
            </div>
            <div>
              <label className="label">Relance dans (jours)</label>
              <input name="followDays" type="number" defaultValue={7} className="input" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={close} className="btn-ghost">Annuler</button>
            <button type="submit" className="btn-primary">Enregistrer</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
