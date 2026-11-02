"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Film,
  Loader2,
  MapPin,
  Search,
  Trash2,
} from "lucide-react";
import AuroraField from "@/components/ui/AuroraField";
import CornerButton from "@/components/ui/CornerButton";
import { parseCoordinates } from "@/lib/parseCoordinates";
import { preventEnterSubmit } from "@/lib/preventEnterSubmit";
import { videoDisplayState, type VideoDisplay } from "@/lib/media/videoDisplay";
import { deleteMapMediaAction, updatePinAction } from "../../../actions";
import type { UpdatePinData } from "../../../actions";
import { useMediaUploads, type UploadFailure } from "../../../hooks/useMediaUploads";
import MediaSection from "../../../nueva/components/MediaSection";
import type { MediaEntry } from "../../../nueva/components/MediaSection";
import UploadStatusList from "../../../nueva/components/UploadStatusList";
import type { MapMedia, PinDetail, Sticker } from "@/types/map";
import type { Country } from "../../../actions";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditPinFormProps {
  detail: PinDetail;
  stickers: Sticker[];
  countries: Country[];
}

type SubmitPhase = "form" | "uploading" | "partial_error";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Estado de un vídeo de Bunny ya guardado, visto por quien puede editarlo:
// es aquí donde el autor o staff ve los que han fallado. null si no es de Bunny.
function bunnyDisplay(m: MapMedia, now: number): VideoDisplay | null {
  if (m.source !== "bunny-video") return null;
  return videoDisplayState(
    { video_status: m.videoStatus, created_at: m.createdAt },
    { canManage: true, now }
  );
}

function existingMediaLabel(m: MapMedia, display: VideoDisplay | null): string {
  if (m.type === "PHOTO") return "Foto";
  if (display === "processing") return "Vídeo · procesando";
  if (display === "failed") return "Vídeo · no se pudo procesar";
  return "Vídeo";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EditPinForm({ detail, stickers, countries }: EditPinFormProps) {
  const router = useRouter();
  const { pin } = detail;

  // Form fields — pre-filled from existing pin data
  const [selectedStickerId, setSelectedStickerId] = useState<number | null>(pin.sticker_id);
  const [countrySearch, setCountrySearch] = useState(detail.countryName);
  const [selectedCountryCode, setSelectedCountryCode] = useState(pin.country_code);
  const [showCountryList, setShowCountryList] = useState(false);
  const [state, setState] = useState(pin.state ?? "");
  const [place, setPlace] = useState(pin.place);
  const [coordsInput, setCoordsInput] = useState(`${pin.latitude}, ${pin.longitude}`);
  const [dateValue, setDateValue] = useState(pin.created_at.slice(0, 10));
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Existing media — items removed here are deleted immediately from DB + storage
  const [existingMedia, setExistingMedia] = useState<MapMedia[]>(detail.media);
  const [deletingMediaId, setDeletingMediaId] = useState<number | null>(null);
  const [deleteMediaError, setDeleteMediaError] = useState<string | null>(null);

  // New media to upload on submit
  const [mediaEntries, setMediaEntries] = useState<MediaEntry[]>([]);

  // Submit state
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { statuses: uploadStatuses, runUploadRound } = useMediaUploads();
  const [uploadFailures, setUploadFailures] = useState<UploadFailure[]>([]);
  // Instante de referencia para saber si una subida de vídeo se abandonó.
  const [now] = useState(() => Date.now());

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

  // Multimedia con la que se quedaría el pin al guardar. El borrado de
  // los archivos ya guardados es inmediato (no se difiere al submit), así
  // que `existingMedia` ya refleja lo que hay en BD en este momento.
  const totalMediaAfterSave = existingMedia.length + readyEntries.length;
  // Quitar el último archivo dejaría el pin sin multimedia, y el servidor
  // lo rechaza (ver deleteMapMediaAction). Para sustituirlo hay que subir
  // el nuevo y guardar primero.
  const canDeleteExistingMedia = existingMedia.length > 1;

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
  // Existing media deletion (immediate)
  // ---------------------------------------------------------------------------

  const handleDeleteExistingMedia = async (mediaId: number) => {
    setDeletingMediaId(mediaId);
    setDeleteMediaError(null);
    const result = await deleteMapMediaAction(mediaId, pin.id);
    setDeletingMediaId(null);
    if (result.ok) {
      setExistingMedia((prev) => prev.filter((m) => m.id !== mediaId));
    } else {
      setDeleteMediaError(result.error);
    }
  };

  // ---------------------------------------------------------------------------
  // New media callbacks
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
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!selectedStickerId) { setSubmitError("Selecciona una pegatina"); return; }
    if (!selectedCountryCode) { setSubmitError("Selecciona un país de la lista"); return; }
    if (!place.trim()) { setSubmitError("El lugar es obligatorio"); return; }
    if (!parsedCoords) { setSubmitError("Las coordenadas no son válidas"); return; }
    if (!dateValue) { setSubmitError("La fecha es obligatoria"); return; }
    if (hasProcessing) { setSubmitError("Espera a que terminen de procesarse los archivos"); return; }
    if (hasMediaErrors) { setSubmitError("Elimina los archivos con error antes de guardar"); return; }
    // Multimedia obligatorio, igual que en el alta. Solo puede saltar en
    // pines antiguos, creados cuando el campo aún era opcional.
    if (totalMediaAfterSave === 0) {
      setSubmitError("La pegatina necesita al menos una foto o un vídeo");
      return;
    }

    setIsSubmitting(true);
    try {
      const updateData: UpdatePinData = {
        sticker_id: selectedStickerId,
        country_code: selectedCountryCode,
        state: state.trim() || null,
        place: place.trim(),
        latitude: parsedCoords.lat,
        longitude: parsedCoords.lng,
        created_at: new Date(`${dateValue}T12:00:00Z`).toISOString(),
      };

      const updateResult = await updatePinAction(pin.id, updateData);
      if (!updateResult.ok) {
        setSubmitError(updateResult.error);
        return;
      }

      if (readyEntries.length === 0) {
        router.push("/mapa");
        return;
      }

      setSubmitPhase("uploading");
      const failures = await runUploadRound(pin.id, readyEntries);

      if (failures.length === 0) {
        router.push("/mapa");
      } else {
        setUploadFailures(failures);
        setSubmitPhase("partial_error");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error inesperado al guardar");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Retry
  // ---------------------------------------------------------------------------

  const handleRetry = async () => {
    const failedIds = new Set(uploadFailures.map((f) => f.clientId));
    const entriesToRetry = mediaEntries.filter((e) => failedIds.has(e.clientId));

    setUploadFailures([]);
    setSubmitPhase("uploading");

    const failures = await runUploadRound(pin.id, entriesToRetry);

    if (failures.length === 0) {
      router.push("/mapa");
    } else {
      setUploadFailures(failures);
      setSubmitPhase("partial_error");
    }
  };

  // ---------------------------------------------------------------------------
  // Upload progress / error view
  // ---------------------------------------------------------------------------

  // Archivos que SÍ llegaron a adjuntarse en esta ronda. Junto con los ya
  // guardados dicen si el pin cumple o no el mínimo de multimedia.
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
            <p className="text-white/60 text-sm">Subiendo archivos multimedia al servidor…</p>
          )}
          {submitPhase === "partial_error" && (
            <p className="text-chip text-amber-300 text-sm">
              {existingMedia.length + attachedCount > 0
                ? "El pin se actualizó correctamente pero algunos archivos no se pudieron subir."
                : "El pin se actualizó pero no se pudo subir ningún archivo, así que sigue sin multimedia. Reinténtalo para completarlo."}
            </p>
          )}
          <UploadStatusList entries={readyEntries} statuses={uploadStatuses} />
          {submitPhase === "partial_error" && (
            <div className="flex flex-col gap-3 pt-2">
              <CornerButton type="button" onClick={handleRetry} className="self-start">
                Reintentar archivos fallidos
              </CornerButton>
              <button
                type="button"
                onClick={() => { router.push("/mapa"); }}
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
      <div className="w-full max-w-lg mb-6">
        <button
          type="button"
          onClick={() => router.push("/mapa")}
          className="inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors text-sm cursor-pointer"
        >
          <ArrowLeft size={16} /> Volver al mapa
        </button>
      </div>

      <h1 className="text-3xl font-bold text-white mb-8">Editar pegatina</h1>

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

        {/* 7. Existing media */}
        {existingMedia.length > 0 && (
          <fieldset>
            <legend className="text-base md:text-lg font-medium text-zinc-400 mb-3">
              Multimedia actual
            </legend>
            {deleteMediaError && (
              <p className="text-red-400 text-sm mb-3">{deleteMediaError}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {existingMedia.map((m) => {
                const isDeleting = deletingMediaId === m.id;
                const display = bunnyDisplay(m, now);
                return (
                  <div
                    key={m.id}
                    className="relative flex flex-col gap-1.5 bg-white/5 rounded-xl p-2 border border-white/10"
                  >
                    <div className="relative w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center">
                      {m.type === "PHOTO" ? (
                        <Image
                          src={m.url}
                          alt=""
                          fill
                          sizes="200px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <>
                          {m.source === "bunny-video" && display === "playable" && m.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- miniatura del CDN de Bunny: <img> plano para no gastar la optimización de imágenes de Vercel.
                            <img
                              src={m.thumbnailUrl}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          ) : display === "failed" ? (
                            <AlertCircle size={28} className="text-red-400/70" />
                          ) : (
                            <Film size={28} className="text-white/30" />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <div className="w-0 h-0 border-y-6 border-y-transparent border-l-10 border-l-white/70" />
                          </div>
                        </>
                      )}
                      {isDeleting && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 size={20} className="text-amber-300 animate-spin" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-white/50">{existingMediaLabel(m, display)}</p>
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingMedia(m.id)}
                      disabled={
                        isDeleting || deletingMediaId !== null || !canDeleteExistingMedia
                      }
                      aria-label="Eliminar archivo"
                      title={
                        canDeleteExistingMedia
                          ? "Eliminar archivo"
                          : "Es el único archivo de la pegatina: sube otro y guarda antes de poder borrarlo"
                      }
                      className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/60 hover:text-red-400 hover:bg-black/80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
            {!canDeleteExistingMedia && (
              <p className="mt-3 text-xs text-white/40">
                Una pegatina no puede quedarse sin multimedia. Para sustituir
                este archivo, sube el nuevo y guarda; después ya podrás
                borrar el antiguo.
              </p>
            )}
          </fieldset>
        )}

        {/* 8. New media to add — limit accounts for existing items */}
        <MediaSection
          entries={mediaEntries}
          onAdd={handleAddMedia}
          onRemove={handleRemoveMedia}
          onUpdate={handleUpdateMedia}
          maxFiles={Math.max(0, 5 - existingMedia.length)}
          required={existingMedia.length === 0}
        />

        {/* Submit error */}
        {submitError && (
          <p className="text-chip text-red-400 text-sm">{submitError}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={() => router.push("/mapa")}
            className="text-white/50 hover:text-white transition-colors text-sm cursor-pointer"
          >
            Cancelar
          </button>
          <CornerButton type="submit" disabled={isSubmitting || hasProcessing || deletingMediaId !== null}>
            {isSubmitting ? "Guardando…" : hasProcessing ? "Procesando archivos…" : "Guardar cambios"}
          </CornerButton>
        </div>
      </form>
    </div>
  );
}
