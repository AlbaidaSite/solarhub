"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Link as LinkIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import AuroraField from "@/components/ui/AuroraField";
import ClockTimePicker from "@/components/ui/ClockTimePicker";
import CornerButton from "@/components/ui/CornerButton";
import { supabase } from "@/lib/supabase/client";
import {
  addEventPhotosAction,
  deleteEventPhotoAction,
  updateEventAction,
  type CreateEventPrice,
  type EventEditDetail,
} from "../../../actions";
import { combineDateTime, isEndBeforeStart } from "../../../lib/eventDates";
import MediaSection from "../../../../mapa/nueva/components/MediaSection";
import type { MediaEntry } from "../../../../mapa/nueva/components/MediaSection";
import { BIRTHDAY_EVENT_TYPE_CODE, type EventTypeInfo } from "@/types/events";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditEventFormProps {
  detail: EventEditDetail;
  eventTypes: EventTypeInfo[];
  isStaff: boolean;
  isLoukou: boolean;
}

interface PriceRow {
  clientId: string;
  reason: string;
  price: string;
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

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "solarhub-assets";

// Inversas de combineDateTime (NewEventForm.tsx): un timestamp ISO se lee
// en hora LOCAL del navegador (asumida Europe/Madrid, mismo criterio que
// el resto del calendario) para rellenar los campos de fecha/hora sueltos
// del formulario.
function isoToDateInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function isoToTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function mimeToExt(blob: Blob, originalName: string): string {
  if (blob.type.includes("webp")) return "webp";
  if (blob.type.includes("jpeg") || blob.type.includes("jpg")) return "jpg";
  if (blob.type.includes("png")) return "png";
  if (blob.type.includes("gif")) return "gif";
  return originalName.split(".").pop() ?? "bin";
}

async function uploadBlob(
  eventId: number,
  entry: MediaEntry,
): Promise<{ path: string } | { error: string }> {
  const blob = entry.processedBlob!;
  const ext = mimeToExt(blob, entry.originalName);
  const storagePath = `event-images/${eventId}/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, blob, { contentType: blob.type, upsert: false });

  if (error) return { error: error.message };
  return { path: data.path };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EditEventForm({ detail, eventTypes, isStaff, isLoukou }: EditEventFormProps) {
  const router = useRouter();

  // Form fields — pre-filled from the existing event
  const [title, setTitle] = useState(detail.title);
  const [place, setPlace] = useState(detail.place ?? "");
  const [eventTypeId, setEventTypeId] = useState<number | null>(detail.eventTypeId);
  const [startDate, setStartDate] = useState(isoToDateInput(detail.eventDate));
  const [startTime, setStartTime] = useState(
    detail.startTimeIncluded ? isoToTimeInput(detail.eventDate) : "",
  );
  const [endDate, setEndDate] = useState(detail.endDate ? isoToDateInput(detail.endDate) : "");
  const [endTime, setEndTime] = useState(
    detail.endDate && detail.endTimeIncluded ? isoToTimeInput(detail.endDate) : "",
  );
  const [prices, setPrices] = useState<PriceRow[]>(
    detail.prices.map((p) => ({ clientId: crypto.randomUUID(), reason: p.reason ?? "", price: String(p.price) })),
  );
  const [description, setDescription] = useState(detail.description ?? "");
  const [url, setUrl] = useState(detail.url ?? "");
  const [includesCromo, setIncludesCromo] = useState(detail.includesCromo);
  const [hideExternal, setHideExternal] = useState(detail.hideExternal);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fotos existentes (portada + extra) — la portada se muestra pero no se
  // puede quitar desde aquí (para eso hay que subir una nueva desde
  // "Nuevo evento"); las fotos extra sí se pueden borrar una a una, igual
  // que la multimedia existente en EditPinForm.
  const [existingPhotos, setExistingPhotos] = useState(detail.photos);
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);
  const [deletePhotoError, setDeletePhotoError] = useState<string | null>(null);

  // New media entries (managed by MediaSection, lifted here)
  const [mediaEntries, setMediaEntries] = useState<MediaEntry[]>([]);

  // Submit state
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatuses, setUploadStatuses] = useState<Record<string, EntryUploadStatus>>({});
  const [uploadFailures, setUploadFailures] = useState<UploadFailure[]>([]);

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const hasProcessing = mediaEntries.some((e) => e.status === "processing");
  const hasMediaErrors = mediaEntries.some((e) => e.status === "error");
  const readyEntries = mediaEntries.filter((e) => e.status === "ready");

  const isBirthdayType =
    eventTypes.find((et) => et.id === eventTypeId)?.code === BIRTHDAY_EVENT_TYPE_CODE;

  // ---------------------------------------------------------------------------
  // Existing photo deletion (immediate)
  // ---------------------------------------------------------------------------

  const handleDeleteExistingPhoto = async (photoId: number) => {
    setDeletingPhotoId(photoId);
    setDeletePhotoError(null);
    const result = await deleteEventPhotoAction(photoId, detail.id);
    setDeletingPhotoId(null);
    if (result.ok) {
      setExistingPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } else {
      setDeletePhotoError(result.error);
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
      prev.map((e) => (e.clientId === clientId ? { ...e, ...changes } : e)),
    );
  }, []);

  // ---------------------------------------------------------------------------
  // Price row callbacks
  // ---------------------------------------------------------------------------

  const handleAddPrice = () => {
    setPrices((prev) => [...prev, { clientId: crypto.randomUUID(), reason: "", price: "" }]);
  };

  const handleRemovePrice = (clientId: string) => {
    setPrices((prev) => prev.filter((p) => p.clientId !== clientId));
  };

  const handlePriceChange = (clientId: string, changes: Partial<Pick<PriceRow, "reason" | "price">>) => {
    setPrices((prev) => prev.map((p) => (p.clientId === clientId ? { ...p, ...changes } : p)));
  };

  // ---------------------------------------------------------------------------
  // Upload round (used by both submit and retry)
  // ---------------------------------------------------------------------------

  const runUploadRound = useCallback(
    async (eventId: number, entriesToUpload: MediaEntry[]) => {
      setUploadStatuses((prev) => {
        const next = { ...prev };
        for (const e of entriesToUpload) next[e.clientId] = { kind: "uploading" };
        return next;
      });

      const settled = await Promise.allSettled(
        entriesToUpload.map((entry) => uploadBlob(eventId, entry)),
      );

      const paths: string[] = [];
      const failures: UploadFailure[] = [];

      for (let i = 0; i < entriesToUpload.length; i++) {
        const entry = entriesToUpload[i];
        const result = settled[i];

        if (result.status === "fulfilled" && "path" in result.value) {
          const { path } = result.value;
          paths.push(path);
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

      if (paths.length > 0) {
        await addEventPhotosAction(eventId, paths);
      }

      return failures;
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!title.trim()) { setSubmitError("El título es obligatorio"); return; }
    if (!place.trim()) { setSubmitError("El lugar es obligatorio"); return; }
    if (!eventTypeId) { setSubmitError("Selecciona un tipo de evento"); return; }
    if (!startDate) { setSubmitError("La fecha de inicio es obligatoria"); return; }
    // Se comparan los instantes completos —fecha Y hora—, que es justo lo
    // que revalida el servidor. Comparando solo las fechas, un evento que
    // termina el mismo día a una hora anterior pasaba este filtro y volvía
    // rechazado desde el servidor con ESTE mismo mensaje: parecía que el
    // aviso se hubiera quedado pegado después de corregir las fechas.
    const startInstant = combineDateTime(startDate, startTime || null);
    const endInstant = endDate ? combineDateTime(endDate, endTime || null) : null;
    if (isEndBeforeStart(startInstant, endInstant)) {
      setSubmitError("La fecha de fin no puede ser anterior a la de inicio");
      return;
    }
    if (hasProcessing) { setSubmitError("Espera a que terminen de procesarse los archivos"); return; }
    if (hasMediaErrors) { setSubmitError("Elimina los archivos con error antes de guardar"); return; }

    const parsedPrices: CreateEventPrice[] = [];
    for (const row of prices) {
      if (!row.reason.trim() && !row.price.trim()) continue;
      const value = Number(row.price.replace(",", "."));
      if (!Number.isFinite(value) || value < 0) {
        setSubmitError(`Precio no válido${row.reason.trim() ? ` para "${row.reason.trim()}"` : ""}`);
        return;
      }
      parsedPrices.push({ reason: row.reason.trim() || null, price: value });
    }

    setIsSubmitting(true);

    const updateResult = await updateEventAction(detail.id, {
      title: title.trim(),
      place: place.trim(),
      eventTypeId,
      eventDate: startInstant,
      startTimeIncluded: startTime.trim() !== "",
      endDate: endInstant,
      endTimeIncluded: endDate ? endTime.trim() !== "" : true,
      description: description.trim() || null,
      url: url.trim() || null,
      recurrence: isBirthdayType ? "YEARLY" : "NONE",
      includesCromo: isStaff && includesCromo,
      hideExternal: (isStaff || isLoukou) && hideExternal,
      prices: parsedPrices,
    });

    if (!updateResult.ok) {
      setSubmitError(updateResult.error);
      setIsSubmitting(false);
      return;
    }

    if (readyEntries.length === 0) {
      // Sin router.refresh() al lado: lanzado en paralelo al push cancela
      // la navegación y deja el formulario "guardando" para siempre, con
      // los datos ya guardados. La caché del destino la invalida
      // revalidatePath() dentro de la action (ver eventos/actions.ts).
      router.push("/eventos");
      return;
    }

    setSubmitPhase("uploading");
    const failures = await runUploadRound(detail.id, readyEntries);
    setIsSubmitting(false);

    if (failures.length === 0) {
      router.push("/eventos");
    } else {
      setUploadFailures(failures);
      setSubmitPhase("partial_error");
    }
  };

  // ---------------------------------------------------------------------------
  // Retry failed uploads
  // ---------------------------------------------------------------------------

  const handleRetry = async () => {
    const failedIds = new Set(uploadFailures.map((f) => f.clientId));
    const entriesToRetry = mediaEntries.filter((e) => failedIds.has(e.clientId));

    setUploadFailures([]);
    setSubmitPhase("uploading");

    const failures = await runUploadRound(detail.id, entriesToRetry);

    if (failures.length === 0) {
      router.push("/eventos");
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
            <p className="text-white/60 text-sm">Subiendo fotos al servidor…</p>
          )}
          {submitPhase === "partial_error" && (
            <p className="text-chip text-amber-300 text-sm">
              El evento se actualizó correctamente pero algunas fotos no se pudieron subir.
            </p>
          )}

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
                Reintentar fotos fallidas
              </CornerButton>
              <button
                type="button"
                onClick={() => { router.push("/eventos"); }}
                className="text-sm text-white/50 hover:text-white transition-colors self-start cursor-pointer"
              >
                Continuar sin esas fotos
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
          onClick={() => router.push("/eventos")}
          className="inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors text-sm cursor-pointer"
        >
          <ArrowLeft size={16} /> Volver al calendario
        </button>
      </div>

      <h1 className="text-3xl font-bold text-white mb-8">Editar evento</h1>

      <form
        onSubmit={handleSubmit}
        onChange={() => setSubmitError(null)}
        className="w-full max-w-lg flex flex-col gap-8"
      >

        {/* Título */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-400">
            Título <span className="text-red-400">*</span>
          </label>
          <AuroraField
            type="text"
            placeholder="Concepto del evento"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* Lugar */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-400">
            Lugar <span className="text-red-400">*</span>
          </label>
          <AuroraField
            type="text"
            placeholder="Ej: Solar"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            autoComplete="off"
          />
        </div>

        {/* Fecha de inicio */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-400">
            Fecha de inicio <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-2">
            <AuroraField
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              icon={<Calendar size={20} strokeWidth={2} />}
              iconPosition="left"
              className="scheme-dark"
              containerClassName="flex-1"
            />
            <ClockTimePicker
              value={startTime}
              onChange={setStartTime}
              ariaLabel="Hora de inicio"
              className="w-32"
            />
          </div>
        </div>

        {/* Fecha de fin */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-400">
            Fecha de fin <span className="text-zinc-500 font-normal">(opcional)</span>
          </label>
          <div className="flex gap-2">
            <AuroraField
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              icon={<Calendar size={20} strokeWidth={2} />}
              iconPosition="left"
              className="scheme-dark"
              containerClassName="flex-1"
            />
            <ClockTimePicker
              value={endTime}
              onChange={setEndTime}
              disabled={!endDate}
              ariaLabel="Hora de fin"
              className="w-32"
            />
          </div>
        </div>

        {/* Precio */}
        <fieldset>
          <legend className="text-sm font-medium text-zinc-400 mb-3">
            Precio <span className="text-zinc-500 font-normal">(opcional)</span>
          </legend>
          {prices.length > 0 && (
            <div className="flex flex-col gap-2 mb-2">
              {prices.map((row) => (
                <div key={row.clientId} className="flex gap-2 items-center">
                  <div style={{ flex: "1 1 0px", minWidth: 0 }}>
                    <AuroraField
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={row.price}
                      onChange={(e) => handlePriceChange(row.clientId, { price: e.target.value })}
                      icon={<span className="text-base font-semibold md:text-xl">€</span>}
                      iconPosition="right"
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ flex: "4 1 0px", minWidth: 0 }}>
                    <AuroraField
                      type="text"
                      placeholder="Concepto"
                      value={row.reason}
                      onChange={(e) => handlePriceChange(row.clientId, { reason: e.target.value })}
                      autoComplete="off"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemovePrice(row.clientId)}
                    aria-label="Quitar precio"
                    className="text-white/40 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleAddPrice}
            className="inline-flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
          >
            <Plus size={14} /> Añadir precio
          </button>
        </fieldset>

        {/* Información */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-400">
            Información <span className="text-zinc-500 font-normal">(opcional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Detalles del evento…"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-amber-300/50 transition-colors resize-y"
          />
        </div>

        {/* Link de interés */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-400">
            Link de interés <span className="text-zinc-500 font-normal">(opcional)</span>
          </label>
          <AuroraField
            type="url"
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            icon={<LinkIcon size={20} strokeWidth={2} />}
            iconPosition="left"
            autoComplete="off"
          />
        </div>

        {/* Tipo de evento */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-zinc-400">
            Tipo de evento <span className="text-red-400">*</span>
          </label>
          <AuroraField
            as="select"
            value={eventTypeId ?? ""}
            onChange={(e) => setEventTypeId(Number(e.target.value) || null)}
          >
            <option value="" disabled>Selecciona un tipo…</option>
            {eventTypes.map((et) => (
              <option key={et.id} value={et.id}>{et.name}</option>
            ))}
          </AuroraField>
          {isBirthdayType && (
            <p className="mt-1 text-xs text-zinc-500">Los cumpleaños se repiten cada año automáticamente.</p>
          )}
        </div>

        {/* Portada + fotos existentes */}
        {(detail.imageUrl || existingPhotos.length > 0) && (
          <fieldset>
            <legend className="text-sm font-medium text-zinc-400 mb-3">
              Fotos actuales
            </legend>
            {deletePhotoError && (
              <p className="text-red-400 text-sm mb-3">{deletePhotoError}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              {detail.imageUrl && (
                <div className="relative flex flex-col gap-1.5 bg-white/5 rounded-xl p-2 border border-white/10">
                  <div className="relative w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden">
                    <Image src={detail.imageUrl} alt="" fill sizes="200px" className="object-cover" unoptimized />
                  </div>
                  <p className="text-xs text-white/50">Portada</p>
                </div>
              )}
              {existingPhotos.map((photo) => {
                const isDeleting = deletingPhotoId === photo.id;
                return (
                  <div
                    key={photo.id}
                    className="relative flex flex-col gap-1.5 bg-white/5 rounded-xl p-2 border border-white/10"
                  >
                    <div className="relative w-full aspect-video bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center">
                      <Image src={photo.url} alt="" fill sizes="200px" className="object-cover" unoptimized />
                      {isDeleting && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 size={20} className="text-amber-300 animate-spin" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-white/50">Foto</p>
                    <button
                      type="button"
                      onClick={() => handleDeleteExistingPhoto(photo.id)}
                      disabled={isDeleting || deletingPhotoId !== null}
                      aria-label="Eliminar foto"
                      className="absolute top-1 left-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white/60 hover:text-red-400 hover:bg-black/80 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          </fieldset>
        )}

        {/* Nuevas fotos */}
        <MediaSection
          entries={mediaEntries}
          onAdd={handleAddMedia}
          onRemove={handleRemoveMedia}
          onUpdate={handleUpdateMedia}
          maxFiles={Math.max(0, 3 - existingPhotos.length - (detail.imageUrl ? 1 : 0))}
          photosOnly
        />

        {/* Checkboxes */}
        <div className="flex flex-col gap-3">
          {isStaff && (
            <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
              <input
                type="checkbox"
                checked={includesCromo}
                onChange={(e) => setIncludesCromo(e.target.checked)}
                className="w-4 h-4 accent-amber-300 cursor-pointer"
              />
              ¿Incluye cromo?
            </label>
          )}

          {(isStaff || isLoukou) && (
            <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer">
              <input
                type="checkbox"
                checked={hideExternal}
                onChange={(e) => setHideExternal(e.target.checked)}
                className="w-4 h-4 accent-amber-300 cursor-pointer"
              />
              Mostrar solo a Loukous
            </label>
          )}
        </div>

        {/* Submit error */}
        {submitError && (
          <p className="text-chip text-red-400 text-sm">{submitError}</p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <button
            type="button"
            onClick={() => router.push("/eventos")}
            className="text-white/50 hover:text-white transition-colors text-sm cursor-pointer"
          >
            Cancelar
          </button>
          <CornerButton type="submit" disabled={isSubmitting || hasProcessing || deletingPhotoId !== null}>
            {isSubmitting ? "Guardando…" : hasProcessing ? "Procesando archivos…" : "Guardar cambios"}
          </CornerButton>
        </div>
      </form>
    </div>
  );
}
