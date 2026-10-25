import { getSupabaseClient } from "../lib/supabase";
import type { Database } from "../lib/database.types";

export type ResourceType = "seat" | "room" | "table";
export type ResourceStatus = "available" | "maintenance";

export type Resource = {
  id: string;
  type: ResourceType;
  name: string;
  capacity: number;
  status: ResourceStatus;
  active: boolean;
  created_at: string;
  occupancy: number;
};

export async function getResources(): Promise<Resource[]> {
  const client = getSupabaseClient();
  const [resourcesResult, occupancyResult] = await Promise.all([
    client
      .from("resources")
      .select("id, type, name, capacity, status, active, created_at")
      .order("type")
      .order("name"),
    client.rpc("get_resource_occupancy"),
  ]);

  if (resourcesResult.error) {
    throw resourcesResult.error;
  }
  if (occupancyResult.error) {
    throw occupancyResult.error;
  }

  const occupancyByResource = new Map(
    occupancyResult.data.map(({ resource_id, people_inside }) => [
      resource_id,
      Number(people_inside),
    ]),
  );

  return resourcesResult.data.map((resource) => ({
    ...resource,
    occupancy: occupancyByResource.get(resource.id) ?? 0,
  }));
}

export async function saveResource(input: {
  id?: string;
  type: ResourceType;
  name: string;
  capacity: number;
  status: ResourceStatus;
}): Promise<void> {
  const client = getSupabaseClient();
  const values = {
    type: input.type,
    name: input.name.trim(),
    capacity: input.capacity,
    status: input.status,
  };

  const result = input.id
    ? await client.from("resources").update(values).eq("id", input.id)
    : await client.from("resources").insert(values);

  if (result.error) {
    throw result.error;
  }
}

export async function setResourceActive(
  resourceId: string,
  active: boolean,
): Promise<void> {
  const { error } = await getSupabaseClient()
    .from("resources")
    .update({ active })
    .eq("id", resourceId);

  if (error) {
    throw error;
  }
}

export async function bulkCreateResources(input: {
  type: ResourceType;
  prefix: string;
  count: number;
  capacity: number;
}): Promise<number> {
  const rows: Database["public"]["Tables"]["resources"]["Insert"][] =
    Array.from({ length: input.count }, (_, index) => ({
      type: input.type,
      name: `${input.prefix.trim()} ${index + 1}`,
      capacity: input.capacity,
    }));

  const { data, error } = await getSupabaseClient()
    .from("resources")
    .upsert(rows, {
      onConflict: "type,name",
      ignoreDuplicates: true,
    })
    .select("id");

  if (error) {
    throw error;
  }

  return data.length;
}
