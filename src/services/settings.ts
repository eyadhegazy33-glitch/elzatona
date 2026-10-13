import type { Json } from "../lib/database.types";
import { getSupabaseClient } from "../lib/supabase";

export type BrandingSettings = {
  workspaceName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
};

export const defaultBrandingSettings: BrandingSettings = {
  workspaceName: "elzatona",
  logoUrl: null,
  primaryColor: "#315c45",
  secondaryColor: "#202721",
};

const settingKeys = [
  "workspace_name",
  "logo_url",
  "primary_color",
  "secondary_color",
] as const;

type SettingKey = (typeof settingKeys)[number];
type SettingsRow = { key: SettingKey; value: Json };

export async function getBrandingSettings(): Promise<BrandingSettings> {
  const { data, error } = await getSupabaseClient()
    .from("settings")
    .select("key, value")
    .in("key", [...settingKeys]);

  if (error) throw error;

  const values = new Map((data as SettingsRow[]).map((row) => [row.key, row.value]));
  const workspaceName = values.get("workspace_name");
  const logoUrl = values.get("logo_url");
  const primaryColor = values.get("primary_color");
  const secondaryColor = values.get("secondary_color");

  return {
    workspaceName:
      typeof workspaceName === "string" && workspaceName.trim()
        ? workspaceName.trim()
        : defaultBrandingSettings.workspaceName,
    logoUrl: typeof logoUrl === "string" && logoUrl ? logoUrl : null,
    primaryColor:
      typeof primaryColor === "string" && isHexColor(primaryColor)
        ? primaryColor
        : defaultBrandingSettings.primaryColor,
    secondaryColor:
      typeof secondaryColor === "string" && isHexColor(secondaryColor)
        ? secondaryColor
        : defaultBrandingSettings.secondaryColor,
  };
}

export async function updateSetting(key: SettingKey, value: Json): Promise<void> {
  const { error } = await getSupabaseClient().rpc("update_setting", {
    p_key: key,
    p_value: value,
  });
  if (error) throw error;
}

export async function uploadBrandingImage(file: File): Promise<string> {
  validateBrandingImage(file);
  const extension = file.name.split(".").pop()?.toLowerCase() || "image";
  const path = `logos/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await getSupabaseClient()
    .storage.from("branding")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  const { data: urlData } = getSupabaseClient()
    .storage.from("branding")
    .getPublicUrl(data.path);
  return urlData.publicUrl;
}

export async function removeBrandingImage(url: string): Promise<void> {
  const marker = "/storage/v1/object/public/branding/";
  const markerIndex = url.indexOf(marker);
  if (markerIndex < 0) return;
  const path = decodeURIComponent(url.slice(markerIndex + marker.length));
  const { error } = await getSupabaseClient().storage.from("branding").remove([path]);
  if (error) throw error;
}

export function validateBrandingImage(file: File): void {
  const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    throw new Error("settings.errors.imageType");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("settings.errors.imageSize");
  }
}

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}
