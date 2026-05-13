// Hook + cache global des rôles métier (table public.business_roles).
// Toutes les listes "Barista/Accueil/Host/Cuisine" hardcodées passent par ici.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BusinessRoleRow {
  id: string;
  name: string;
  color: string;
  position: number;
  is_active: boolean;
}

// Cache module-level partagé (utilisable hors React, ex: getRoleColor)
let CACHE: BusinessRoleRow[] = [];
const listeners = new Set<() => void>();

export function getCachedRoles(): BusinessRoleRow[] {
  return CACHE;
}

export function getRoleColor(name: string | null | undefined, fallback = "#888"): string {
  if (!name) return fallback;
  return CACHE.find((r) => r.name === name)?.color ?? fallback;
}

async function load() {
  const { data, error } = await supabase
    .from("business_roles")
    .select("*")
    .order("position", { ascending: true });
  if (error) {
    console.error("[useBusinessRoles] load error", error);
    return;
  }
  CACHE = (data ?? []) as BusinessRoleRow[];
  listeners.forEach((l) => l());
}

// Charge dès l'import (côté client uniquement)
if (typeof window !== "undefined") {
  load();
  // Realtime : les changements admin se reflètent immédiatement
  supabase
    .channel("business_roles_sync")
    .on("postgres_changes", { event: "*", schema: "public", table: "business_roles" }, () => load())
    .subscribe();
}

export function useBusinessRoles(opts: { onlyActive?: boolean } = {}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    if (CACHE.length === 0) load();
    return () => { listeners.delete(l); };
  }, []);
  const all = CACHE;
  const roles = opts.onlyActive ? all.filter((r) => r.is_active) : all;
  return {
    roles,
    names: roles.map((r) => r.name),
    color: (name: string | null | undefined) => getRoleColor(name),
    reload: load,
    isLoading: CACHE.length === 0,
  };
}

export async function reloadBusinessRoles() {
  await load();
}
