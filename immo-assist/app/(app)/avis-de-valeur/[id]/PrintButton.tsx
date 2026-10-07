"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary print:hidden">
      <Printer size={16} /> Imprimer / PDF
    </button>
  );
}
