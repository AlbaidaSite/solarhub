"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Calendar, MapPin, Search } from "lucide-react";
import AuroraField from "@/components/ui/AuroraField";
import CornerButton from "@/components/ui/CornerButton";
import { parseCoordinates } from "@/lib/parseCoordinates";
import { preventEnterSubmit } from "@/lib/preventEnterSubmit";
import { createPinAction, deletePinAction } from "../../actions";
import { useMediaUploads, type UploadFailure } from "../../hooks/useMediaUploads";
import MediaSection from "./MediaSection";
import type { MediaEntry } from "./MediaSection";
import UploadStatusList from "./UploadStatusList";
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
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
  const { statuses: uploadStatuses, runUploadRound } = useMediaUploads();
  const [uploadFailures, setUploadFailures] = useState<UploadFailure[]>([]);
  const [createdPinId, setCreatedPinId] = useState<number | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

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
    // El multimedia es obligatorio: una pegatina sin foto ni vídeo no
    // aporta nada al mapa y no hay forma de verificarla.
    if (readyEntries.length === 0) {
      setSubmitError("Añade al menos una foto o un vídeo");
      return;
    }

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

    // 2. Upload media — siempre hay al menos uno (validado arriba)
    const failures = await runUploadRound(pinId, readyEntries);

    if (failures.length === 0) {
      router.push("/mapa");
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
    } else {
      setUploadFailures(failures);
      setSubmitPhase("partial_error");
    }
  };

  // ---------------------------------------------------------------------------
  // Descartar el pin recién creado
  // ---------------------------------------------------------------------------

  // Si ninguna subida cuajó, el pin quedaría publicado sin multimedia,
  // que es justo lo que la regla prohíbe. La única salida sin reintentar
  // es deshacer el alta.
  const handleDiscard = async () => {
    if (!createdPinId) return;
    setIsDiscarding(true);
    await deletePinAction(createdPinId);
    router.push("/mapa");
  };

  // ---------------------------------------------------------------------------
  // Upload progress / error view
  // ---------------------------------------------------------------------------

  // Archivos que SÍ llegaron a adjuntarse al pin. Con cero, el pin
  // incumple la regla de multimedia obligatorio y no se puede "continuar".
  const attachedCount = Object.values(uploadStatuses).filter(
    (st) => st.kind === "ok",
  ).length;

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
              {attachedCount > 0
                ? "El pin se guardó correctamente pero algunos archivos no se pudieron subir."
                : "El pin se guardó pero no se pudo subir ningún archivo. Una pegatina no puede quedarse sin multimedia: reintenta la subida o descarta el pin."}
            </p>
          )}

          {/* Per-file status */}
          <UploadStatusList entries={readyEntries} statuses={uploadStatuses} />

          {submitPhase === "partial_error" && (
            <div className="flex flex-col gap-3 pt-2">
              <CornerButton type="button" onClick={handleRetry} className="self-start">
                Reintentar archivos fallidos
              </CornerButton>
              {attachedCount > 0 ? (
                <button
                  type="button"
                  onClick={() => { router.push("/mapa"); }}
                  className="text-sm text-white/50 hover:text-white transition-colors self-start cursor-pointer"
                >
                  Continuar sin esos archivos
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={isDiscarding}
                  className="text-sm text-white/50 hover:text-red-400 transition-colors self-start cursor-pointer disabled:opacity-50"
                >
                  {isDiscarding ? "Descartando…" : "Descartar la pegatina"}
                </button>
              )}
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

      <form
        onSubmit={handleSubmit}
        onKeyDown={preventEnterSubmit}
        className="w-full max-w-lg flex flex-col gap-8"
      >

        {/* 1. Sticker selector */}
        <fieldset>
          <legend className="text-base md:text-lg font-medium text-zinc-400 mb-3">
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

        {/* 2. Place */}
        <div className="flex flex-col gap-1">
          <label className="text-base md:text-lg font-medium text-zinc-400">
            Lugar donde se colocó <span className="text-red-400">*</span>
          </label>
          <AuroraField
            type="text"
            placeholder="Ej: Parque del Retiro"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* 3. State (optional) */}
        <div className="flex flex-col gap-1">
          <label className="text-base md:text-lg font-medium text-zinc-400">Ciudad</label>
          <AuroraField
            type="text"
            placeholder="Ej: Sevilla"
            value={state}
            onChange={(e) => setState(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* 4. Country combobox */}
        <div ref={countryWrapperRef} className="relative flex flex-col gap-1">
          <label className="text-base md:text-lg font-medium text-zinc-400">
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

        {/* 5. Coordinates */}
        <div className="flex flex-col gap-1">
          <label className="text-base md:text-lg font-medium text-zinc-400">
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
          <label className="text-base md:text-lg font-medium text-zinc-400">
            Fecha en la que se colocó <span className="text-red-400">*</span>
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
          required
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
