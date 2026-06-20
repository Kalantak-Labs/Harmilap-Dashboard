"use client";

import { useEffect, useState } from "react";
import {
  FACE_VALUE_OTHERS,
  FACE_VALUE_PRESETS,
  faceValueToFormState,
  isPresetFaceValue,
  resolveFaceValue,
  type FaceValueMode,
} from "@/lib/faceValue";

interface Props {
  value: number | null;
  onChange: (value: number | null) => void;
  inputClassName?: string;
}

export default function FaceValueField({ value, onChange, inputClassName = "input" }: Props) {
  const [mode, setMode] = useState<FaceValueMode>(() => faceValueToFormState(value).mode);
  const [custom, setCustom] = useState(() => faceValueToFormState(value).custom);

  useEffect(() => {
    if (value != null) {
      const next = faceValueToFormState(value);
      setMode(next.mode);
      setCustom(next.custom);
    }
  }, [value]);

  const applyMode = (nextMode: FaceValueMode) => {
    setMode(nextMode);
    if (nextMode === FACE_VALUE_OTHERS) {
      onChange(resolveFaceValue(FACE_VALUE_OTHERS, custom));
      return;
    }
    setCustom("");
    onChange(resolveFaceValue(nextMode, ""));
  };

  const applyCustom = (nextCustom: string) => {
    setCustom(nextCustom);
    onChange(resolveFaceValue(mode, nextCustom));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <select
        className={inputClassName}
        value={mode === "" ? "" : String(mode)}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) {
            applyMode("");
            return;
          }
          if (v === FACE_VALUE_OTHERS) {
            applyMode(FACE_VALUE_OTHERS);
            return;
          }
          const preset = Number(v);
          if (isPresetFaceValue(preset)) {
            applyMode(preset);
          }
        }}
      >
        <option value="">Select face value…</option>
        {FACE_VALUE_PRESETS.map((preset) => (
          <option key={preset} value={preset}>
            ₹{preset.toLocaleString("en-IN")}
          </option>
        ))}
        <option value={FACE_VALUE_OTHERS}>Others</option>
      </select>
      {mode === FACE_VALUE_OTHERS && (
        <input
          className={inputClassName}
          type="number"
          min="0"
          step="any"
          value={custom}
          onChange={(e) => applyCustom(e.target.value)}
          placeholder="Enter custom face value"
        />
      )}
    </div>
  );
}
