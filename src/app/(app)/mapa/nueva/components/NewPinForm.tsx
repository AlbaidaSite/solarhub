"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AlertCircle, ArrowLeft, Calendar, CheckCircle2, Loader2, MapPin, Search, Upload } from "lucide-react";
import AuroraField from "@/components/ui/AuroraField";
import CornerButton from "@/components/ui/CornerButton";
import { parseCoordinates } from "@/lib/parseCoordinates";
import { supabase } from "@/lib/supabase/client";
import { addMapMediaAction, createPinAction } from "../../actions";
import type { MediaItemToInsert } from "../../actions";
import MediaSection from "./MediaSection";
import type { MediaEntry } from "./MediaSection";
import type { Sticker } from "@/types/map";
import type { Country } from "../../actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NewPinFormProps {
  stickers: Sticker[];
  countries: Country[];
}

type SubmitPhase = "form" | "uploading" | "partial_error";

type EntryUploadStatus =
  | { kind: "idle" }
  | { kind: "uploading" }
  | { kind: "ok"; path: string }
  | { kind: "error"; msg: string };

interface UploadFailure {
  clientId: string;
  name: string;
  msg: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STORAGE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "solarhub-assets";

function todayValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function mimeToExt(blob: Blob, originalName: string): string {
  if (blob.type.includes("webp")) return "webp";
  if (blob.type.includes("jpeg") || blob.type.includes("jpg")) return "jpg";
  if (blob.type.includes("png")) return "png";
  if (blob.type.includes("gif")) return "gif";
  return originalName.split(".").pop() ?? "bin";
}

async function uploadBlob(
  pinId: number,
  entry: MediaEntry
): Promise<{ path: string; mimeType: string; size: number } | { error: string }> {
  const blob = entry.processedBlob!;
  const ext = mimeToExt(blob, entry.originalName);
  const storagePath = `map-media/${pinId}/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, blob, { contentType: blob.type, upsert: false });

  if (error) return { error: error.message };
  return { path: data.path, mimeType: blob.type, size: blob.size };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NewPinForm({ stickers, countries }: NewPinFormProps) {
  const router = useRouter();

  // Form fields
  const [selectedStickerId, setSelectedStickerId] = useState<number | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState("");
  const [showCountryList, setShowCountryList] = useState(false);
  const [state, setState] = useState("");
  const [place, setPlace] = useState("");
  const [coordsInput, setCoordsInput] = useState("");
  const [dateValue, setDateValue] = useState(todayValue);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Media entries (managed by MediaSection, lifted here)
  const [mediaEntries, setMediaEntries] = useState<MediaEntry[]>([]);

  // Submit state
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("form");
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, EntryUploadStatus>>({});
  const [uploadFailures, setUploadFailures] = useState<UploadFailure[]>([]);
  const [createdPinId, setCreatedPinId] = useState<number | null>(null);

  const countryWrapperRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const parsedCoords = coordsInput.trim() ? parseCoordinates(coordsInput) : null;
  const coordsTyped = coordsInput.trim().length > 0;

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const hasProcessing = mediaEntries.some((e) => e.status === "processing");
  const hasMediaErrors = mediaEntries.some((e) => e.status === "error");
  const readyEntries = mediaEntries.filter((e) => e.status === "ready");

  const isDirty =
    selectedStickerId !== null ||
    selectedCountryCode !== "" ||
    state !== "" ||
    place !== "" ||
    coordsInput !== "" ||
    mediaEntries.length > 0;

  // ---------------------------------------------------------------------------
  // Country dropdown: close on outside click
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryWrapperRef.current && !countryWrapperRef.current.contains(e.target as Node)) {
        setShowCountryList(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ---------------------------------------------------------------------------
  // Media callbacks
  // ---------------------------------------------------------------------------

  const handleAddMedia = useCallback((newEntries: MediaEntry[]) => {
    setMediaEntries((prev) => [...prev, ...newEntries]);
  }, []);

  const handleRemoveMedia = useCallback((clientId: string) => {
    setMediaEntries((prev) => {
      const removed = prev.find((e) => e.clientId === clientId);
      if (removed?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((e) => e.clientId !== clientId);
    });
  }, []);

  const handleUpdateMedia = useCallback((clientId: string, changes: Partial<MediaEntry>) => {
    setMediaEntries((prev) =>
      prev.map((e) => (e.clientId === clientId ? { ...e, ...changes } : e))
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Country handlers
  // ---------------------------------------------------------------------------

  const handleCountrySelect = useCallback((country: Country) => {
    setSelectedCountryCode(country.code);
    setCountrySearch(country.name);
    setShowCountryList(false);
  }, []);

  const handleCountryInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCountrySearch(e.target.value);
    setSelectedCountryCode("");
    setShowCountryList(true);
  };

  // ---------------------------------------------------------------------------
  // Cancel
  // ---------------------------------------------------------------------------

  const handleCancel = () => {
    if (isDirty && !window.confirm("¿Descartar los cambios?")) return;
    router.push("/mapa");
  };

  // ---------------------------------------------------------------------------
  // Upload round (used by both initial submit and retry)
  // ---------------------------------------------------------------------------

  const runUploadRound = useCallback(
    async (pinId: number, entriesToUpload: MediaEntry[]) => {
      // Mark all as uploading
      setUploadStatuses((prev) => {
        const next = { ...prev };
        for (const e of entriesToUpload) next[e.clientId] = { kind: "uploading" };
        return next;
      });

      const settled = await Promise.allSettled(
        entriesToUpload.map((entry) => uploadBlob(pinId, entry))
      );

      const toInsert: MediaItemToInsert[] = [];
      const failures: UploadFailure[] = [];

      for (let i = 0; i < entriesToUpload.length; i++) {
        const entry = entriesToUpload[i];
        const result = settled[i];

        if (result.status === "fulfilled" && "path" in result.value) {
          const { path, mimeType, size } = result.value;
          toInsert.push({ path, type: entry.mediaType, mimeType, size });
          setUploadStatuses((prev) => ({ ...prev, [entry.clientId]: { kind: "ok", path } }));
        } else {
          const msg =
            result.status === "rejected"
              ? String(result.reason)
              : (result.value as { error: string }).error;
          failures.push({ clientId: entry.clientId, name: entry.originalName, msg });
          setUploadStatuses((prev) => ({ ...prev, [entry.clientId]: { kind: "error", msg } }));
        }
      }

      // Backend insert for successful uploads
      if (toInsert.length > 0) {
        await addMapMediaAction(pinId, toInsert);
      }

      return failures;
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Form validation
    if (!selectedStickerId) { setSubmitError("Selecciona una pegatina"); return; }
    if (!selectedCountryCode) { setSubmitError("Selecciona un país de la lista"); return; }
    if (!place.trim()) { setSubmitError("El lugar es obligatorio"); return; }
    if (!parsedCoords) { setSubmitError("Las coordenadas no son válidas"); return; }
    if (!dateValue) { setSubmitError("La fecha es obligatoria"); return; }
    if (hasProcessing) { setSubmitError("Espera a que terminen de procesarse los archivos"); return; }
    if (hasMediaErrors) { setSubmitError("Elimina los archivos con error antes de guardar"); return; }

    setSubmitPhase("uploading");

    // 1. Create pin
    const createdAt = new Date(`${dateValue}T12:00:00Z`).toISOString();
    const pinResult = await createPinAction({
      sticker_id: selectedStickerId,
      country_code: selectedCountryCode,
      state: state.trim() || null,
      place: place.trim(),
      latitude: parsedCoords.lat,
      longitude: parsedCoords.lng,
      created_at: createdAt,
    });

    if (!pinResult.ok) {
      setSubmitError(pinResult.error);
      setSubmitPhase("form");
      return;
    }

    const pinId = pinResult.pinId;
    setCreatedPinId(pinId);

    // 2. Upload media (if any)
    if (readyEntries.length === 0) {
      router.push("/mapa");
      router.refresh();
      return;
    }

    const failures = await runUploadRound(pinId, readyEntries);

    if (failures.length === 0) {
      router.push("/mapa");
      router.refresh();
    } else {
      setUploadFailures(failures);
      setSubmitPhase("partial_error");
    }
  };

  // ---------------------------------------------------------------------------
  // Retry failed uploads
  // ---------------------------------------------------------------------------

  const handleRetry = async () => {
    if (!createdPinId) return;

    const failedIds = new Set(uploadFailures.map((f) => f.clientId));
    const entriesToRetry = mediaEntries.filter((e) => failedIds.has(e.clientId));

    setUploadFailures([]);
    setSubmitPhase("uploading");

    const failures = await runUploadRound(createdPinId, entriesToRetry);

    if (failures.length === 0) {
      router.push("/mapa");
      router.refresh();
    } else {
      setUploadFailures(failures);
      setSubmitPhase("partial_error");
    }
  };

  // ---------------------------------------------------------------------------
  // Upload progress / error view
  // ---------------------------------------------------------------------------

  if (submitPhase === "uploading" || submitPhase === "partial_error") {
    return (
      <div className="w-full flex flex-col items-center pb-12">
        <div className="w-full max-w-lg flex flex-col gap-6">
          <h1 className="text-3xl font-bold text-white">
            {submitPhase === "uploading" ? "Guardando…" : "Error parcial"}
          </h1>

          {submitPhase === "uploading" && (
            <p className="text-white/60 text-sm">
              Subiendo archivos multimedia al servidor…
            </p>
          )}
          {submitPhase === "partial_error" && (
            <p className="text-chip text-amber-300 text-sm">
              El pin se guardó correctamente pero algunos archivos no se pudieron subir.
            </p>
          )}

          {/* Per-file status */}
          <div className="flex flex-col gap-3">
            {readyEntries.map((entry) => {
              const status = uploadStatuses[entry.clientId];
              return (
                <div
                  key={entry.clientId}
                  className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10"
                >
                  {!status || status.kind === "idle" ? (
                    <Upload size={16} className="text-white/30 shrink-0" />
                  ) : status.kind === "uploading" ? (
                    <Loader2 size={16} className="text-amber-300 animate-spin shrink-0" />
                  ) : status.kind === "ok" ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-red-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{entry.originalName}</p>
                    {status?.kind === "error" && (
                      <p className="text-xs text-red-400 mt-0.5">{status.msg}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {submitPhase === "partial_error" && (
            <div className="flex flex-col gap-3 pt-2">
              <CornerButton type="button" onClick={handleRetry} className="self-start">
                Reintentar archivos fallidos
              </CornerButton>
              <button
                type="button"
                onClick={() => { router.push("/mapa"); router.refresh(); }}
                className="text-sm text-white/50 hover:text-white transition-colors self-start cursor-pointer"
              >
                Continuar sin esos archivos
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Normal form
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full flex flex-col items-center pb-12">
      {/* Back link */}
      <div className="w-full max-w-lg mb-6">
        <button
          type="button"
          onClick={handleCancel}
          className="inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors text-sm cursor-pointer"
        >
          <ArrowLeft size={16} /> Volver al mapa
        </button>
      </div>

      <h1 className="text-3xl font-bold text-white mb-8">Nueva pegatina</h1>

      <form onSubmit={handleSubmit} className="w-full max-w-lg flex flex-col gap-8">

        {/* 1. Sticker selector */}
        <fieldset>
          <legend className="text-sm font-medium text-zinc-400 mb-3">
            Pegatina <span className="text-red-400">*</span>
          </legend>
          <div className="grid grid-cols-5 gap-2">
            {stickers.map((sticker) => (
              <button
                key={sticker.id}
                type="button"
                onClick={() => setSelectedStickerId(sticker.id)}
                aria-label={sticker.name}
                title={sticker.name}
                aria-pressed={selectedStickerId === sticker.id}
                className={`relative aspect-square rounded-xl border-2 transition-all duration-150 bg-white/5 overflow-hidden ${
                  selectedStickerId === sticker.id
                    ? "border-amber-300 scale-105 bg-amber-300/10"
                    : "border-white/10 hover:border-white/30 hover:scale-105"
                }`}
              >
                <Image
                  src={sticker.icon_path}
                  alt={sticker.name}
                  fill
                  sizes="80px"
                  className="object-contain p-1.5"
                  unoptimized
                />
              </button>
            ))}
          </div>
          {selectedStickerId && (
            <p className="mt-2 text-xs text-amber-300">
              {stickers.find((s) => s.id === selectedStickerId)?.name}
            </p>
          )}
        </fieldset>

        {/* 2. Country combobox */}
        <div ref={countryWrapperRef} className="relative flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-400">
            País <span className="text-red-400">*</span>
          </label>
          <AuroraField
            type="text"
            placeholder="Buscar país…"
            value={countrySearch}
            onChange={handleCountryInputChange}
            onFocus={() => setShowCountryList(true)}
            autoComplete="off"
            icon={<Search size={20} strokeWidth={2} />}
            iconPosition="left"
          />
          {showCountryList && filteredCountries.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 max-h-52 overflow-y-auto bg-zinc-900 border border-white/20 rounded-xl shadow-xl scrollbar-clean">
              {filteredCountries.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleCountrySelect(country)}
                  className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 transition-colors"
                >
                  {country.name}
                </button>
              ))}
            </div>
          )}
          {selectedCountryCode && (
            <p className="text-xs text-amber-300">{selectedCountryCode}</p>
          )}
        </div>

        {/* 3. State (optional) */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-400">Provincia</label>
          <AuroraField
            type="text"
            placeholder="Ej: Sevilla"
            value={state}
            onChange={(e) => setState(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* 4. Place */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-400">
            Lugar <span className="text-red-400">*</span>
          </label>
          <AuroraField
            type="text"
            placeholder="Ej: Parque del Retiro"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* 5. Coordinates */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-400">
            Coordenadas <span className="text-red-400">*</span>
          </label>
          <AuroraField
            type="text"
            placeholder="37.4084606, -6.0798973"
            value={coordsInput}
            onChange={(e) => setCoordsInput(e.target.value)}
            autoComplete="off"
            icon={<MapPin size={20} strokeWidth={2} />}
            iconPosition="left"
          />
          {coordsTyped && (
            parsedCoords ? (
              <p className="text-emerald-400 text-xs mt-1">
                ✓ {parsedCoords.lat.toFixed(6)}, {parsedCoords.lng.toFixed(6)}
              </p>
            ) : (
              <p className="text-red-400 text-xs mt-1">
                Formato inválido. Usa &quot;lat, lng&quot; con punto (37.408, -6.079) o coma decimal (37,408, -6,079)
              </p>
            )
          )}
        </div>

        {/* 6. Date */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-400">
            Fecha <span className="text-red-400">*</span>
          </label>
          <AuroraField
            type="date"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            icon={<Calendar size={20} strokeWidth={2} />}
            iconPosition="left"
            className="scheme-dark"
          />
        </div>

        {/* 7. Multimedia */}
        <MediaSection
          entries={mediaEntries}
          onAdd={handleAddMedia}
          onRemove={handleRemoveMedia}
          onUpdate={handleUpdateMedia}
        />

        {/* Submit error */}
        {submitError && (
          <p className="text-chip text-red-400 text-sm">{submitError}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="text-white/50 hover:text-white transition-colors text-sm cursor-pointer"
          >
            Cancelar
          </button>
          <CornerButton type="submit" disabled={hasProcessing}>
            {hasProcessing ? "Procesando archivos…" : "Guardar"}
          </CornerButton>
        </div>
      </form>
    </div>
  );
}
