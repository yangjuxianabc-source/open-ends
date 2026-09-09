"use client";

import { useState } from "react";
import { isValidRating, type Rating } from "@/types";

export function ratingFromKey(value: Rating | undefined, key: string): Rating | undefined {
  if (key === "Home") return 0.5;
  if (key === "End") return 5;
  if (key === "Delete" || key === "Backspace") return undefined;
  if (key !== "ArrowLeft" && key !== "ArrowRight") return value;
  const current = value ?? 0.5;
  const next = key === "ArrowLeft" ? current - 0.5 : current + 0.5;
  return Math.min(5, Math.max(0.5, next)) as Rating;
}

export function formatRating(value: Rating | undefined) {
  return value === undefined ? "未评分" : `${value.toFixed(1).replace(".0", "")} / 5`;
}

export interface StarRatingProps {
  value?: Rating | null;
  onChange: (value: Rating | undefined) => void;
  label?: string;
  disabled?: boolean;
}

export function StarRating({ value, onChange, label = "评分", disabled = false }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<Rating>();
  const current = value === null ? undefined : value;
  const preview = hoverValue ?? current;

  function choose(next: number) {
    if (!disabled && isValidRating(next)) onChange(next);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    if (!["ArrowLeft", "ArrowRight", "Home", "End", "Delete", "Backspace"].includes(event.key)) return;
    event.preventDefault();
    onChange(ratingFromKey(current, event.key));
  }

  return (
    <div className="star-rating-wrap">
      <div
        className={`star-rating ${disabled ? "is-disabled" : ""}`}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuemin={0.5}
        aria-valuemax={5}
        aria-valuenow={current ?? 0}
        aria-valuetext={formatRating(current)}
        onKeyDown={handleKeyDown}
        onPointerLeave={() => setHoverValue(undefined)}
      >
        {Array.from({ length: 5 }, (_, index) => {
          const star = index + 1;
          const fill = preview === undefined ? 0 : preview >= star ? 100 : preview >= star - 0.5 ? 50 : 0;
          return (
            <span className="star-rating-star" key={star}>
              <svg className="star-rating-outline" viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.75 5.57 6.15.9-4.45 4.34 1.05 6.13L12 17.05l-5.5 2.89 1.05-6.13L3.1 9.47l6.15-.9L12 3Z" /></svg>
              <span className="star-rating-fill" style={{ width: `${fill}%` }} aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m12 3 2.75 5.57 6.15.9-4.45 4.34 1.05 6.13L12 17.05l-5.5 2.89 1.05-6.13L3.1 9.47l6.15-.9L12 3Z" /></svg></span>
              <button type="button" className="star-rating-half star-rating-half-left" aria-label={`${star - 0.5} 星`} aria-pressed={current === star - 0.5} disabled={disabled} onPointerEnter={() => setHoverValue((star - 0.5) as Rating)} onFocus={() => setHoverValue((star - 0.5) as Rating)} onBlur={() => setHoverValue(undefined)} onClick={() => choose(star - 0.5)} />
              <button type="button" className="star-rating-half star-rating-half-right" aria-label={`${star} 星`} aria-pressed={current === star} disabled={disabled} onPointerEnter={() => setHoverValue(star as Rating)} onFocus={() => setHoverValue(star as Rating)} onBlur={() => setHoverValue(undefined)} onClick={() => choose(star)} />
            </span>
          );
        })}
      </div>
      <span className="star-rating-value" aria-hidden="true">{formatRating(current)}</span>
      {current !== undefined && <button type="button" className="star-rating-clear" onClick={() => onChange(undefined)} disabled={disabled}>清除</button>}
    </div>
  );
}
