"use server";

import { redirect } from "next/navigation";
import { login, registerOrganization, destroySession } from "@/lib/auth";

export async function loginAction(_prev: any, formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Email et mot de passe requis." };
  const res = await login(email, password);
  if ("error" in res) return { error: res.error };
  redirect("/dashboard");
}

export async function registerAction(_prev: any, formData: FormData) {
  const orgName = String(formData.get("orgName") || "");
  const name = String(formData.get("name") || "");
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  if (!orgName || !name || !email || !password)
    return { error: "Tous les champs sont requis." };
  if (password.length < 6) return { error: "Mot de passe : 6 caractères minimum." };
  const res = await registerOrganization({ orgName, name, email, password });
  if ("error" in res) return { error: res.error };
  redirect("/dashboard");
}

export async function logoutAction() {
  destroySession();
  redirect("/login");
}
