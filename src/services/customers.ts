import { getSupabaseClient } from "../lib/supabase";
import type { Database } from "../lib/database.types";

export type CustomerStatus = Database["public"]["Enums"]["customer_status"];

export type StudentType = {
  id: string;
  name_en: string;
  name_ar: string;
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
  expiry_date: string | null;
  notes: string | null;
  status: CustomerStatus;
  created_at: string;
  updated_at: string;
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

export type CustomerSort = "created_at" | "full_name" | "code" | "expiry_date";

function escapeSearchTerm(value: string): string {
  return value.replace(/[\\%_,()."]/g, "\\$&");
}

function escapeLikeTerm(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function rpcInput(input: CustomerInput) {
  return {
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_birth_date: input.birthDate,
    p_student_type_id: input.studentTypeId,
    p_phone: input.phone || null,
    p_expiry_date: input.expiryDate || null,
    p_notes: input.notes || null,
  };
}

export async function getActiveStudentTypes(): Promise<StudentType[]> {
  const { data, error } = await getSupabaseClient()
    .from("student_types")
    .select("id, name_en, name_ar")
    .eq("is_active", true)
    .order("name_en");
  if (error) throw error;
  return data;
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
  let query = getSupabaseClient()
    .from("customers")
    .select(
      "id, code, first_name, last_name, full_name, birth_date, student_type_id, phone, expiry_date, notes, status, created_at, updated_at, student_type:student_types(id, name_en, name_ar)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order(input.sort, { ascending: input.ascending, nullsFirst: false })
    .range(from, from + pageSize - 1);

  if (input.status) query = query.eq("status", input.status);
  if (input.studentTypeId) {
    query = query.eq("student_type_id", input.studentTypeId);
  }
  const search = input.search.trim();
  if (search) {
    const term = escapeSearchTerm(search);
    query = query.or(
      `full_name.ilike.%${term}%,code.ilike.%${term}%,phone.ilike.%${term}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { customers: data, total: count ?? 0 };
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  const { data, error } = await getSupabaseClient()
    .from("customers")
    .select(
      "id, code, first_name, last_name, full_name, birth_date, student_type_id, phone, expiry_date, notes, status, created_at, updated_at, student_type:student_types(id, name_en, name_ar)",
    )
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findCustomerByNameAndBirthDate(input: {
  firstName: string;
  lastName: string;
  birthDate: string;
}): Promise<{ id: string } | null> {
  const { data, error } = await getSupabaseClient()
    .from("customers")
    .select("id")
    .ilike(
      "full_name",
      escapeLikeTerm(`${input.firstName.trim()} ${input.lastName.trim()}`),
    )
    .eq("birth_date", input.birthDate)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getCustomerVisits(
  customerId: string,
): Promise<{ id: number; checked_in_at: string }[]> {
  const { data, error } = await getSupabaseClient()
    .from("checkins")
    .select("id, checked_in_at")
    .eq("customer_id", customerId)
    .order("checked_in_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export async function createCustomer(input: CustomerInput): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc(
    "create_customer",
    rpcInput(input),
  );
  if (error) throw error;
  return data;
}

export async function updateCustomer(
  customerId: string,
  input: CustomerInput,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc("update_customer", {
    p_customer: customerId,
    ...rpcInput(input),
  });
  if (error) throw error;
}

export async function setCustomerStatus(
  customerId: string,
  status: CustomerStatus,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc("set_customer_status", {
    p_customer: customerId,
    p_status: status,
  });
  if (error) throw error;
}

export async function softDeleteCustomer(customerId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc("soft_delete_customer", {
    p_customer: customerId,
  });
  if (error) throw error;
}

export async function reissueQrToken(customerId: string): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc("reissue_qr_token", {
    p_customer: customerId,
  });
  if (error) throw error;
  return data;
}

export async function getCustomerQrToken(
  customerId: string,
): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc(
    "get_customer_qr_token",
    { p_customer: customerId },
  );
  if (error) throw error;
  return data;
}
