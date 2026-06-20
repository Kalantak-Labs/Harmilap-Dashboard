export const FACE_VALUE_PRESETS = [1, 2, 5, 10, 100, 1000, 10000] as const;

export const FACE_VALUE_OTHERS = "others";

export type FaceValueMode = (typeof FACE_VALUE_PRESETS)[number] | typeof FACE_VALUE_OTHERS | "";

export function isPresetFaceValue(value: number): boolean {
  return (FACE_VALUE_PRESETS as readonly number[]).includes(value);
}

export function faceValueToFormState(value: number | null | undefined): {
  mode: FaceValueMode;
  custom: string;
} {
  if (value == null) return { mode: "", custom: "" };
  if (isPresetFaceValue(value)) return { mode: value, custom: "" };
  return { mode: FACE_VALUE_OTHERS, custom: String(value) };
}

export function resolveFaceValue(mode: FaceValueMode, custom: string): number | null {
  if (mode === "") return null;
  if (mode === FACE_VALUE_OTHERS) {
    const trimmed = custom.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }
  return mode;
}

export function validateFaceValue(mode: FaceValueMode, custom: string): string | null {
  if (mode === "") return "Face value is required";
  if (mode === FACE_VALUE_OTHERS) {
    const trimmed = custom.trim();
    if (!trimmed) return "Enter a custom face value";
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n <= 0) return "Face value must be a positive number";
  }
  return null;
}

export function formatFaceValue(value: number | null | undefined): string | null {
  if (value == null) return null;
  return Number.isInteger(value) ? String(value) : String(value);
}
