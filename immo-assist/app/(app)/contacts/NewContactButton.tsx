"use client";

import { Plus } from "lucide-react";
import Modal from "@/components/Modal";
import { createContact } from "../actions";
import { CONTACT_TYPE } from "@/lib/format";

export default function NewContactButton() {
  return (
    <Modal
      title="Nouveau contact"
      trigger={<button className="btn-gold"><Plus size={16} /> Nouveau contact</button>}
    >
      {(close) => (
        <form action={async (fd) => { await createContact(fd); close(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prénom</label>
              <input name="firstName" className="input" required />
            </div>
            <div>
              <label className="label">Nom</label>
              <input name="lastName" className="input" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select name="type" className="input" defaultValue="PROSPECT_SELLER">
                {Object.entries(CONTACT_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Score (0-100)</label>
              <input name="score" type="number" min={0} max={100} defaultValue={50} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Téléphone</label>
              <input name="phone" className="input" placeholder="0692…" />
            </div>
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ville / secteur</label>
              <input name="city" className="input" placeholder="Le Tampon" defaultValue="Le Tampon" />
            </div>
            <div>
              <label className="label">Source</label>
              <select name="source" className="input">
                {["Pige", "Recommandation", "Boîtage", "Porte-à-porte", "Site web", "Salon"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea name="notes" rows={2} className="input" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={close} className="btn-ghost">Annuler</button>
            <button type="submit" className="btn-primary">Créer le contact</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
