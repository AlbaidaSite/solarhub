"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Clock, X } from "lucide-react";

type Period = "AM" | "PM";

interface ClockTimePickerProps {
  /** Valor en formato 24h "HH:MM", o "" si no hay hora seleccionada. */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

const DIAL_SIZE = 220;
const DIAL_CENTER = DIAL_SIZE / 2;
const DIAL_RADIUS = 88;
const HAND_LENGTH = DIAL_RADIUS - 20;

function parseTime24(value: string): { hour24: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return { hour24: Number(match[1]), minute: Number(match[2]) };
}

function to12h(hour24: number): { hour12: number; period: Period } {
  const period: Period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, period };
}

function to24hString(hour12: number, minute: number, period: Period): string {
  const hour24 = period === "PM" ? (hour12 % 12) + 12 : hour12 % 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDisplay12h(value: string): string {
  const parsed = parseTime24(value);
  if (!parsed) return "";
  const { hour12, period } = to12h(parsed.hour24);
  return `${hour12}:${String(parsed.minute).padStart(2, "0")} ${period}`;
}

// Ángulo en grados medido en sentido horario desde las 12 (arriba), 0-360.
function angleFromCenter(dx: number, dy: number): number {
  return (Math.atan2(dx, -dy) * (180 / Math.PI) + 360) % 360;
}

// Selector de hora tipo reloj analógico (esfera + AM/PM), igual que el
// TimePicker nativo de Android/Material. Se guarda y expone en 24h ("HH:MM")
// para encajar con combineDateTime()/<input type="time"> de siempre, pero
// toda la interacción visible es en 12h con AM/PM, como pide el diseño.
export default function ClockTimePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Hora",
  ariaLabel,
  className = "",
}: ClockTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"hour" | "minute">("hour");
  const [draftHour12, setDraftHour12] = useState(12);
  const [draftMinute, setDraftMinute] = useState(0);
  const [draftPeriod, setDraftPeriod] = useState<Period>("AM");

  const containerRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  function openPicker() {
    if (disabled) return;
    const parsed = parseTime24(value);
    if (parsed) {
      const { hour12, period } = to12h(parsed.hour24);
      setDraftHour12(hour12);
      setDraftMinute(parsed.minute);
      setDraftPeriod(period);
    } else {
      const now = new Date();
      const { hour12, period } = to12h(now.getHours());
      setDraftHour12(hour12);
      setDraftMinute(now.getMinutes());
      setDraftPeriod(period);
    }
    setMode("hour");
    setIsOpen(true);
  }

  // Mismo patrón de cierre por clic fuera que MonthYearPicker.tsx.
  useEffect(() => {
    if (!isOpen) return;
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isOpen]);

  function applyAngle(angleDeg: number) {
    if (mode === "hour") {
      const idx = Math.round(angleDeg / 30) % 12;
      setDraftHour12(idx === 0 ? 12 : idx);
    } else {
      const m = Math.round(angleDeg / 6) % 60;
      setDraftMinute(m);
    }
  }

  function angleFromPointer(clientX: number, clientY: number): number {
    const rect = dialRef.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return angleFromCenter(clientX - cx, clientY - cy);
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    isDraggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    applyAngle(angleFromPointer(e.clientX, e.clientY));
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;
    applyAngle(angleFromPointer(e.clientX, e.clientY));
  }

  function handlePointerUp() {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    // Tras soltar sobre la esfera de horas, se pasa directo a minutos
    // (mismo flujo que el picker de Android): un solo gesto por campo.
    setMode((m) => (m === "hour" ? "minute" : m));
  }

  function handleConfirm() {
    onChange(to24hString(draftHour12, draftMinute, draftPeriod));
    setIsOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  const display = formatDisplay12h(value);

  const marks = Array.from({ length: 12 }, (_, i) => {
    const angleDeg = i * 30;
    const rad = (angleDeg * Math.PI) / 180;
    const x = DIAL_CENTER + DIAL_RADIUS * Math.sin(rad);
    const y = DIAL_CENTER - DIAL_RADIUS * Math.cos(rad);
    const markValue = mode === "hour" ? (i === 0 ? 12 : i) : i * 5;
    const label = mode === "hour" ? String(markValue) : String(markValue).padStart(2, "0");
    const isActive = mode === "hour" ? draftHour12 === markValue : draftMinute === markValue;
    return { key: `${mode}-${i}`, x, y, label, isActive };
  });

  const handAngle = mode === "hour" ? (draftHour12 % 12) * 30 : draftMinute * 6;

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative group/aurora">
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-label={ariaLabel}
          className="flex w-full items-center gap-2 bg-transparent py-2 text-left disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Clock
            size={18}
            strokeWidth={2}
            className="shrink-0 text-white transition-colors group-focus-within/aurora:text-amber-300"
          />
          <span
            className={`min-w-0 flex-1 truncate text-base font-semibold ${value ? "text-white" : "text-zinc-500"}`}
          >
            {value ? display : placeholder}
          </span>
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleClear(e as unknown as React.MouseEvent);
              }}
              aria-label="Borrar hora"
              className="shrink-0 text-white/40 transition-colors hover:text-red-400"
            >
              <X size={14} />
            </span>
          )}
        </button>
        <div
          aria-hidden
          className={`absolute left-0 right-0 bottom-0 h-1.5 [clip-path:polygon(0_0,100%_100%,100%_0%)] transition-colors duration-200 ${
            isOpen ? "bg-amber-300" : "bg-white"
          }`}
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 z-30 mt-2 w-[260px] rounded-2xl border border-white/15 bg-zinc-900 p-4 shadow-xl">
          <p className="mb-3 text-xs font-semibold tracking-wide text-white/40">SELECCIONAR HORA</p>

          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-baseline gap-1 text-3xl font-bold">
              <button
                type="button"
                onClick={() => setMode("hour")}
                className={`cursor-pointer rounded px-1.5 py-0.5 transition-colors ${
                  mode === "hour" ? "bg-amber-300/20 text-amber-300" : "text-white/70 hover:text-white"
                }`}
              >
                {draftHour12}
              </button>
              <span className="text-white/40">:</span>
              <button
                type="button"
                onClick={() => setMode("minute")}
                className={`cursor-pointer rounded px-1.5 py-0.5 transition-colors ${
                  mode === "minute" ? "bg-amber-300/20 text-amber-300" : "text-white/70 hover:text-white"
                }`}
              >
                {String(draftMinute).padStart(2, "0")}
              </button>
            </div>
            <div className="flex flex-col gap-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDraftPeriod("AM")}
                className={`cursor-pointer rounded px-2 py-1 transition-colors ${
                  draftPeriod === "AM" ? "bg-amber-300/20 text-amber-300" : "text-white/50 hover:text-white"
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => setDraftPeriod("PM")}
                className={`cursor-pointer rounded px-2 py-1 transition-colors ${
                  draftPeriod === "PM" ? "bg-amber-300/20 text-amber-300" : "text-white/50 hover:text-white"
                }`}
              >
                PM
              </button>
            </div>
          </div>

          <div
            ref={dialRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative mx-auto touch-none select-none rounded-full bg-white/5"
            style={{ width: DIAL_SIZE, height: DIAL_SIZE }}
          >
            <span
              aria-hidden
              className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300"
              style={{ left: DIAL_CENTER, top: DIAL_CENTER }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute bg-amber-300/70"
              style={{
                left: DIAL_CENTER,
                top: DIAL_CENTER - 1,
                height: 2,
                width: HAND_LENGTH,
                transformOrigin: "0 50%",
                transform: `rotate(${handAngle - 90}deg)`,
              }}
            />
            {marks.map((mark) => (
              <span
                key={mark.key}
                aria-hidden
                className={`pointer-events-none absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  mark.isActive ? "bg-amber-300 text-black" : "text-white/80"
                }`}
                style={{ left: mark.x, top: mark.y }}
              >
                {mark.label}
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-end gap-4 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="cursor-pointer text-white/50 transition-colors hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="cursor-pointer text-amber-300 transition-colors hover:text-amber-200"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
