import { getSupabaseClient } from "../lib/supabase";
import type { CustomerStatus } from "./customers";

export type CustomerCardRecord = {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  birth_date: string;
  student_type_id: string;
  status: CustomerStatus;
  created_at: string;
  import_id: string | null;
  student_type: {
    id: string;
    name: string;
    active: boolean;
  } | null;
};

export type CustomerImportOption = {
  id: string;
  created_at: string;
};

const pageSize = 500;

function escapeSearchTerm(value: string): string {
  return value.replace(/[\\%_,()."]/g, "\\$&");
}

export async function getCustomerCardRecords(filters: {
  search: string;
  studentTypeId: string;
  createdToday: boolean;
  importId: string;
}): Promise<CustomerCardRecord[]> {
  const client = getSupabaseClient();
  let query = client
    .from("customers")
    .select(
      "id, code, first_name, last_name, birth_date, student_type_id, status, created_at, import_id, student_type:student_types(id, name, active)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("last_name")
    .order("first_name")
    .order("id");

  if (filters.studentTypeId) {
    query = query.eq("student_type_id", filters.studentTypeId);
  }
  if (filters.importId) {
    query = query.eq("import_id", filters.importId);
  }
  if (filters.createdToday) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    query = query.gte("created_at", start.toISOString()).lt("created_at", end.toISOString());
  }
  if (filters.search.trim()) {
    const term = escapeSearchTerm(filters.search.trim());
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,code.ilike.%${term}%`,
    );
  }

  const records: CustomerCardRecord[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const { data, error, count } = await query.range(
      offset,
      offset + pageSize - 1,
    );
    if (error) throw error;
    total = count ?? 0;
    const normalized = ((data ?? []) as any[]).map((row) => ({
      ...row,
      full_name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim(),
    })) as CustomerCardRecord[];
    records.push(...normalized);
    if ((data ?? []).length < pageSize) break;
    offset += (data ?? []).length;
  }

  return records;
}

export async function getCustomerImportOptions(): Promise<CustomerImportOption[]> {
  const { data, error } = await getSupabaseClient()
    .from("imports")
    .select("id, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function logCustomerCardPrint(count: number): Promise<void> {
  const { error } = await getSupabaseClient().rpc("log_card_print", {
    p_count: count,
  });

  if (error) throw error;
}
