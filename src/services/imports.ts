import { getSupabaseClient } from "../lib/supabase";

export type ImportSummary = {
  id: string;
  user_id: string | null;
  filename: string | null;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  rolled_back_at: string | null;
  created_at: string;
  user?: {
    first_name: string;
    last_name: string;
  } | null;
};

export type ImportErrorRecord = {
  id: number;
  import_id: string;
  row_number: number;
  reason: string;
};

export async function getImportHistory(): Promise<ImportSummary[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("imports")
    .select(
      "id, user_id, filename, total, created, updated, skipped, failed, rolled_back_at, created_at, user:profiles(first_name, last_name)",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as ImportSummary[];
}

export async function getImportErrors(importId: string): Promise<ImportErrorRecord[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("import_errors")
    .select("id, import_id, row_number, reason")
    .eq("import_id", importId)
    .order("row_number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as ImportErrorRecord[];
}

export async function runCustomerImport(input: {
  rows: Array<Record<string, string>>;
  filename: string;
  updateExisting: boolean;
}): Promise<{
  import_id: string;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}> {
  const client = getSupabaseClient();
  const { data, error } = await (client as any).rpc("import_customers", {
    p_rows: input.rows,
    p_filename: input.filename,
    p_update_existing: input.updateExisting,
  });

  if (error) throw error;
  if (!data || typeof data !== "object") {
    throw new Error("Import request returned no result.");
  }

  return data as {
    import_id: string;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  };
}

export async function rollbackCustomerImport(importId: string): Promise<number> {
  const client = getSupabaseClient();
  const { data, error } = await (client as any).rpc("rollback_import", {
    p_import: importId,
  });

  if (error) throw error;
  return Number(data ?? 0);
}
