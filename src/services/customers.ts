import { getSupabaseClient } from "../lib/supabase";
import type { Database } from "../lib/database.types";

export type CustomerStatus = Database["public"]["Enums"]["customer_status"];

export type StudentType = {
  id: string;
  name: string;
  active: boolean;
};

export type Customer = {
  id: string;
  code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  birth_date: string;
  student_type_id: string;
  phone: string | null;
  expires_on: string | null;
  notes: string | null;
  status: CustomerStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  student_type: StudentType | null;
};

export type CustomerPage = {
  customers: Customer[];
  total: number;
};

export type CustomerInput = {
  firstName: string;
  lastName: string;
  birthDate: string;
  studentTypeId: string;
  phone: string;
  expiryDate: string;
  notes: string;
};

export type CustomerSort = "created_at" | "first_name" | "code" | "expires_on";

function normalizeCustomer(row: Record<string, any>): Customer {
  return {
    ...row,
    id: row.id,
    code: row.code,
    first_name: row.first_name,
    last_name: row.last_name,
    birth_date: row.birth_date,
    student_type_id: row.student_type_id,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    expires_on: row.expires_on ?? null,
    phone: row.phone ?? null,
    notes: row.notes ?? null,
    deleted_at: row.deleted_at ?? null,
    full_name: [row.first_name, row.last_name].filter(Boolean).join(" ").trim(),
    student_type: row.student_type ?? null,
  } as Customer;
}

function rpcInput(input: CustomerInput) {
  return {
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_birth_date: input.birthDate,
    p_student_type: input.studentTypeId,
    p_phone: input.phone || null,
    p_expires_on: input.expiryDate || null,
    p_notes: input.notes || null,
  };
}

export async function getActiveStudentTypes(): Promise<StudentType[]> {
  const client: any = getSupabaseClient();
  const { data, error } = await client
    .from("student_types")
    .select("id, name, active")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as StudentType[];
}

export async function getCustomers(input: {
  search: string;
  status: CustomerStatus | "";
  studentTypeId: string;
  sort: CustomerSort;
  ascending: boolean;
  page: number;
  pageSize?: number;
}): Promise<CustomerPage> {
  const pageSize = input.pageSize ?? 25;
  const from = input.page * pageSize;
  const client: any = getSupabaseClient();
  let query: any = client
    .from("customers")
    .select(
      "id, code, first_name, last_name, birth_date, student_type_id, phone, expires_on, notes, status, created_at, updated_at, deleted_at, student_type:student_types(id, name, active)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order(input.sort, { ascending: input.ascending, nullsFirst: false })
    .range(from, from + pageSize - 1);

  if (input.status) query = query.eq("status", input.status);
  if (input.studentTypeId) query = query.eq("student_type_id", input.studentTypeId);

  const search = input.search.trim();
  if (search) {
    const term = search.replace(/[\\%_]/g, "\\$&");
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,code.ilike.%${term}%,phone.ilike.%${term}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return {
    customers: (data ?? []).map(normalizeCustomer),
    total: count ?? 0,
  };
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  const client: any = getSupabaseClient();
  const { data, error } = await client
    .from("customers")
    .select(
      "id, code, first_name, last_name, birth_date, student_type_id, phone, expires_on, notes, status, created_at, updated_at, deleted_at, student_type:student_types(id, name, active)",
    )
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data ? normalizeCustomer(data) : null;
}

export async function findCustomerByNameAndBirthDate(input: {
  firstName: string;
  lastName: string;
  birthDate: string;
}): Promise<{ id: string } | null> {
  const first = input.firstName.trim();
  const last = input.lastName.trim();
  const client: any = getSupabaseClient();
  const { data, error } = await client
    .from("customers")
    .select("id")
    .eq("birth_date", input.birthDate)
    .ilike("first_name", first)
    .ilike("last_name", last)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCustomerVisits(
  customerId: string,
): Promise<{ id: number; checked_in_at: string }[]> {
  const client: any = getSupabaseClient();
  const { data, error } = await client
    .from("checkins")
    .select("id, checked_in_at")
    .eq("customer_id", customerId)
    .order("checked_in_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function createCustomer(input: CustomerInput): Promise<string> {
  const client: any = getSupabaseClient();
  const { data, error } = await client.rpc("create_customer", rpcInput(input));
  if (error) throw error;
  if (data && typeof data === "object" && "id" in data) return String((data as any).id);
  return String(data ?? "");
}

export async function updateCustomer(
  customerId: string,
  input: CustomerInput,
): Promise<void> {
  const client: any = getSupabaseClient();
  const { error } = await client.rpc("update_customer", {
    p_id: customerId,
    ...rpcInput(input),
  });
  if (error) throw error;
}

export async function setCustomerStatus(
  customerId: string,
  status: CustomerStatus,
): Promise<void> {
  const client: any = getSupabaseClient();
  const { error } = await client.rpc("set_customer_status", {
    p_id: customerId,
    p_status: status,
  });
  if (error) throw error;
}

export async function softDeleteCustomer(customerId: string): Promise<void> {
  const client: any = getSupabaseClient();
  const { error } = await client.rpc("soft_delete_customer", {
    p_id: customerId,
  });
  if (error) throw error;
}

export async function reissueQrToken(customerId: string): Promise<string> {
  const client: any = getSupabaseClient();
  const { error } = await client.rpc("reissue_qr_token", { p_id: customerId });
  if (error) throw error;
  const { data, error: loadError } = await client
    .from("customers")
    .select("qr_token")
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (loadError) throw loadError;
  if (!data?.qr_token) throw new Error("Missing customer qr token");
  return data.qr_token as string;
}

export async function getCustomerQrToken(
  customerId: string,
): Promise<string> {
  const client: any = getSupabaseClient();
  const { data, error } = await client
    .from("customers")
    .select("qr_token")
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data?.qr_token) throw new Error("Missing customer qr token");
  return data.qr_token as string;
}
