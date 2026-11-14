"use client";

import { useState } from "react";
import { parseRewardInput, REWARD_PRESETS } from "@/lib/reward";

/**
 * Preset chips plus a "Custom" chip that reveals an amount box.
 * Calls onChange with dollars, or null while the custom amount is not valid.
 */
export function RewardPicker({ value, onChange, presets = REWARD_PRESETS, minUsd = 0, disabled, label = "Reward" }: {
  value: number | null;
  onChange: (usd: number | null) => void;
  presets?: number[];
  minUsd?: number;
  disabled?: boolean;
  label?: string;
}) {
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState("");
  const parsed = custom && text ? parseRewardInput(text, minUsd) : null;
  const chip = (on: boolean, size = "text-xl") =>
    `min-h-14 min-w-0 rounded-lg border px-1 font-black ${size} ${on ? "border-brand bg-brand text-brand-fg" : "border-line bg-panel"}`;
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="group" aria-label={label}>
        {presets.map((t) => (
          <button key={t} type="button" disabled={disabled} aria-pressed={!custom && value === t}
            onClick={() => { setCustom(false); onChange(t); }} className={chip(!custom && value === t)}>
            ${t}
          </button>
        ))}
        <button type="button" disabled={disabled} aria-pressed={custom}
          onClick={() => {
            setCustom(true);
            const p = text ? parseRewardInput(text, minUsd) : null;
            onChange(p && "usd" in p ? p.usd : null);
          }}
          className={chip(custom, "text-base")}>
          Custom
        </button>
      </div>
      {custom && (
        <label className="grid gap-1 text-sm font-bold">
          Your reward ($)
          <input
            inputMode="decimal" autoFocus disabled={disabled} value={text} maxLength={7} placeholder="2.50"
            onChange={(event) => {
              setText(event.target.value);
              const p = parseRewardInput(event.target.value, minUsd);
              onChange("usd" in p ? p.usd : null);
            }}
            className="min-h-12 rounded-lg border border-line bg-panel px-3 text-lg"
          />
          {parsed && "error" in parsed && <span role="alert" className="text-sm font-normal text-danger">{parsed.error}</span>}
        </label>
      )}
    </div>
  );
}
