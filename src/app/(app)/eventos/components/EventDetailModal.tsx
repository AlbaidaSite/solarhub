"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useDialog, FocusScope } from "react-aria";
import { ArrowLeft, BellOff, BellRing, Check, ExternalLink, Pencil, Share2, Sparkles, Trash2, X } from "lucide-react";
import { eventTypeClasses } from "@/lib/eventTypeClasses";
import { isBirthday, type EventOccurrence, type EventPrice } from "@/types/events";
import {
  checkEventEditPermissionAction,
  deleteEventAction,
  getEventExtraPhotosAction,
  getEventPricesAction,
  toggleEventInterestAction,
} from "../actions";
import {
  formatEventDateOnly,
  formatEventEndDate,
  formatEventPrice,
  formatEventTime,
  todayInMadrid,
} from "../lib/formatting";
import { isPastOccurrence } from "../lib/eventOccurrences";

interface EventDetailModalProps {
  occurrence: EventOccurrence;
  onClose: () => void;
  // Presente solo cuando el modal se abrió desde la lista de eventos del
  // día (móvil): sustituye el cierre por una flecha "volver" — Escape y el
  // botón hacen lo mismo, vuelven a la lista en vez de cerrar del todo.
  onBack?: () => void;
  // Presente cuando el llamante puede refrescar su lista de eventos tras
  // un borrado (ver EventsCalendar.tsx).
  onDelete?: () => void;
  // Notifica al llamante tras alternar el interés, para que actualice su
  // caché de ocurrencias (misma idea que onDelete) — así el borde del
  // punto de tipo de evento y el resto de campanas del mismo evento
  // (listado móvil) se refrescan sin volver a pedir el mes entero.
  onInterestToggled?: (eventId: number, liked: boolean) => void;
}

type DeleteStep = null | "confirm1" | "confirm2";

// Un cumpleaños nunca debe llegar hasta aquí (ver BirthdayPills.tsx y
// EventListModal.tsx: los cumpleaños no son clicables en ningún sitio).
// Si ocurre, es un error de programación en el llamante — se avisa fuerte
// en desarrollo en vez de renderizar un modal vacío. La comprobación va
// DESPUÉS de todos los hooks (nunca antes de un return condicional: los
// hooks deben ejecutarse siempre en el mismo orden).
export default function EventDetailModal({
  occurrence,
  onClose,
  onBack,
  onDelete,
  onInterestToggled,
}: EventDetailModalProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const { dialogProps, titleProps } = useDialog({}, dialogRef);

  const [prices, setPrices] = useState<EventPrice[] | null>(null);
  const [copied, setCopied] = useState(false);
  const latestPriceRequestIdRef = useRef<number | null>(null);

  // Fotos extra (event_photo) para el carrusel — la portada ya llega
  // resuelta en occurrence.imageUrl, sin esperar a esta petición.
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const latestPhotosRequestIdRef = useRef<number | null>(null);

  // Permiso de edición/borrado: dueño del evento o staff. Se distinguen
  // ambos casos (no un booleano combinado) porque un staff editando/
  // borrando el evento de OTRO usuario muestra los botones en rojo, para
  // que no se confunda con "estoy editando mi propio evento".
  const [permission, setPermission] = useState({ isOwner: false, isStaff: false });
  const [deleteStep, setDeleteStep] = useState<DeleteStep>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletePending, startDeleteTransition] = useTransition();
  const [isInterestPending, startInterestTransition] = useTransition();

  const goBackOrClose = onBack ?? onClose;
  const canEdit = permission.isOwner || permission.isStaff;
  const isStaffActingOnOthersEvent = permission.isStaff && !permission.isOwner;

  useEffect(() => {
    checkEventEditPermissionAction(occurrence.id).then(setPermission);
  }, [occurrence.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (deleteStep !== null) {
          setDeleteStep(null);
        } else {
          goBackOrClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onBack, onClose, deleteStep]);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const prevOverflow = main.style.overflow;
    main.style.overflow = "hidden";
    return () => {
      main.style.overflow = prevOverflow;
    };
  }, []);

  // Deliberadamente NO usa el patrón "let cancelled = false" de cleanup:
  // en desarrollo, con Strict Mode, este efecto se invoca dos veces al
  // montar con el MISMO occurrence.id — y en este proyecto, de esas dos
  // invocaciones solo la PRIMERA llega a resolver de verdad (la segunda
  // se queda colgada; comprobado con logging manual). Con un flag
  // `cancelled` por invocación, esa primera respuesta llega marcada como
  // cancelada (su cleanup ya se disparó) y se descarta — spinner
  // infinito. Comparando contra el id más reciente en vez de contra un
  // flag fijo por invocación, la respuesta que sí llegue (sea de la 1ª o
  // la 2ª) se acepta igual mientras siga siendo la del evento que se
  // está mostrando.
  useEffect(() => {
    latestPriceRequestIdRef.current = occurrence.id;
    getEventPricesAction(occurrence.id)
      .then((rows) => {
        if (latestPriceRequestIdRef.current === occurrence.id) setPrices(rows);
      })
      .catch((err) => {
        // Sin esto, un fallo en la acción deja `prices` en null para
        // siempre y el spinner nunca se resuelve.
        console.error("EventDetailModal: fallo al cargar los precios del evento", err);
        if (latestPriceRequestIdRef.current === occurrence.id) setPrices([]);
      });
  }, [occurrence.id]);

  useEffect(() => {
    setActivePhotoIdx(0);
    latestPhotosRequestIdRef.current = occurrence.id;
    getEventExtraPhotosAction(occurrence.id)
      .then((rows) => {
        if (latestPhotosRequestIdRef.current === occurrence.id) setExtraPhotos(rows);
      })
      .catch((err) => {
        console.error("EventDetailModal: fallo al cargar las fotos adicionales del evento", err);
        if (latestPhotosRequestIdRef.current === occurrence.id) setExtraPhotos([]);
      });
  }, [occurrence.id]);

  if (isBirthday(occurrence)) {
    console.error(
      "EventDetailModal: se intentó abrir el detalle de un cumpleaños; los cumpleaños no tienen modal de detalle.",
      occurrence,
    );
    return null;
  }

  // Portada + fotos extra, en orden — la portada siempre va primera.
  const allPhotos = occurrence.imageUrl ? [occurrence.imageUrl, ...extraPhotos] : extraPhotos;
  const activePhotoUrl = allPhotos[activePhotoIdx] ?? occurrence.imageUrl ?? null;

  const classes = eventTypeClasses(occurrence.eventType.color);
  const dateLabel = formatEventDateOnly(occurrence.occurrenceDate);
  const timeLabel = formatEventTime(occurrence.eventDate, occurrence.startTimeIncluded);
  const endDateLabel = formatEventEndDate(occurrence.endDate, occurrence.endTimeIncluded);

  const handleShare = async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("evento", String(occurrence.id));
    url.searchParams.set("fecha", occurrence.occurrenceDate);
    await navigator.clipboard.writeText(url.toString());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    startDeleteTransition(async () => {
      setDeleteError(null);
      const result = await deleteEventAction(occurrence.id);
      if (result.ok) {
        onDelete?.();
      } else {
        setDeleteError(result.error);
        setDeleteStep(null);
      }
    });
  };

  // Optimista, al estilo "like" de Instagram: la campana cambia al
  // instante (vía onInterestToggled, que actualiza la caché de meses de
  // EventsCalendar.tsx) y solo se deshace si la petición termina
  // fallando — así se siente al momento aunque el servidor tarde.
  const handleToggleInterest = () => {
    const nextLiked = !occurrence.liked;
    onInterestToggled?.(occurrence.id, nextLiked);
    startInterestTransition(async () => {
      const result = await toggleEventInterestAction(occurrence.id);
      if (result.ok) {
        if (result.liked !== nextLiked) onInterestToggled?.(occurrence.id, result.liked);
      } else {
        onInterestToggled?.(occurrence.id, !nextLiked);
        console.error("EventDetailModal: fallo al alternar el interés", result.error);
      }
    });
  };

  // Un evento que ya pasó no admite interés (lo rechaza también
  // toggleEventInterestAction): en vez de una campana que no responde, no
  // hay campana. Los cumpleaños no entran aquí, se repiten cada año.
  const isPast = isPastOccurrence(occurrence, todayInMadrid());

  // Mostrar interés — cualquier autenticado, sin relación con canEdit.
  // Anclada a la esquina superior IZQUIERDA de la imagen (editar/eliminar
  // ocupan la derecha), mismo círculo negro que esos botones pero algo
  // más grande (w-10 en vez de w-9) para que quepa un icono más grande
  // sin quedar apretado. Blanco/80 en reposo, blanco puro en hover,
  // amarillo cuando ya hay interés marcado (y blanco en hover también en
  // ese estado).
  const interestButton = isPast ? null : (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handleToggleInterest();
      }}
      disabled={isInterestPending}
      aria-label={occurrence.liked ? "Quitar interés" : "Mostrar interés"}
      aria-pressed={occurrence.liked}
      title={occurrence.liked ? "Quitar interés" : "Mostrar interés"}
      className={`absolute top-3 left-3 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50 ${
        occurrence.liked ? "text-yellow-400 hover:text-white" : "text-white/80 hover:text-white"
      }`}
    >
      {occurrence.liked ? <BellRing size={24} /> : <BellOff size={24} />}
    </button>
  );

  // Editar / eliminar — solo dueño del evento o staff. Ancladas a la
  // esquina superior derecha de la IMAGEN (no del modal), con círculo
  // negro detrás de cada icono para distinguirse de cualquier fondo. En
  // rojo cuando quien edita es staff pero NO el dueño, para no
  // confundirlo con "es mi evento".
  const editDeleteButtons = canEdit ? (
    <div
      className="absolute top-3 right-3 z-10 flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => router.push(`/eventos/editar/${occurrence.id}`)}
        aria-label="Editar evento"
        title={isStaffActingOnOthersEvent ? "Editar (evento de otro usuario)" : "Editar"}
        className={`w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors cursor-pointer ${
          isStaffActingOnOthersEvent ? "text-red-400 hover:text-red-300" : "text-white/80 hover:text-amber-300"
        }`}
      >
        <Pencil size={18} />
      </button>
      <button
        type="button"
        onClick={() => {
          setDeleteError(null);
          setDeleteStep("confirm1");
        }}
        aria-label="Eliminar evento"
        title={isStaffActingOnOthersEvent ? "Eliminar (evento de otro usuario)" : "Eliminar"}
        className={`w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors cursor-pointer ${
          isStaffActingOnOthersEvent ? "text-red-400 hover:text-red-300" : "text-white/80 hover:text-red-400"
        }`}
      >
        <Trash2 size={18} />
      </button>
    </div>
  ) : null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/87 backdrop-blur-md overflow-y-auto scrollbar-clean"
      onClick={goBackOrClose}
    >
      <FocusScope contain restoreFocus autoFocus>
        <div
          {...dialogProps}
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-detail-title"
          className="min-h-full w-full max-w-2xl mx-auto flex flex-col gap-5 px-6 pt-32 pb-8"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cierre / volver — mismo tratamiento que PinModal.tsx */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goBackOrClose();
            }}
            aria-label={onBack ? "Volver a la lista" : "Cerrar"}
            className="fixed top-6 left-6 z-10 p-2 rounded-full text-red-300/70 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
          >
            {onBack ? <ArrowLeft size={35} /> : <X size={35} />}
          </button>

          {/* Confirmación de borrado en dos pasos — mismo patrón que
              PinModal.tsx. */}
          {deleteStep !== null && (
            <div
              className="fixed inset-0 z-20 flex items-center justify-center bg-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-zinc-900 border border-white/15 rounded-2xl p-6 w-80 flex flex-col gap-5 shadow-2xl mx-4">
                <p className="text-white font-semibold">
                  {deleteStep === "confirm1"
                    ? "¿Eliminar este evento?"
                    : "Esta acción no se puede deshacer."}
                </p>
                {deleteStep === "confirm2" && (
                  <p className="text-white/50 text-sm -mt-2">
                    Se borrarán también sus precios y fotos asociadas.
                  </p>
                )}
                {deleteError && <p className="text-red-400 text-sm">{deleteError}</p>}
                <div className="flex gap-3">
                  {deleteStep === "confirm1" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setDeleteStep("confirm2")}
                        className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors cursor-pointer"
                      >
                        Sí, eliminar
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteStep(null)}
                        className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setDeleteStep(null)}
                        disabled={isDeletePending}
                        className="flex-1 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeletePending}
                        className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {isDeletePending ? "Eliminando…" : "Confirmar"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Imagen o tesela de tipo: si hay foto, se muestra a tamaño
              intrínseco (limitada por ancho Y alto, lo que llegue antes)
              en vez de forzar un aspect-ratio panorámico fijo — así una
              foto vertical no queda aplastada en una caja horizontal.
              Editar/eliminar van anclados a la esquina superior derecha
              de la IMAGEN, no del modal. */}
          <div className="w-full flex justify-center shrink-0">
            {activePhotoUrl ? (
              <div className="relative inline-block max-w-full">
                {/* eslint-disable-next-line @next/next/no-img-element -- tamaño intrínseco: next/image "fill" exige un contenedor con tamaño ya fijado, justo lo contrario de lo que hace falta aquí. */}
                <img
                  src={activePhotoUrl}
                  alt={occurrence.title}
                  className="max-w-full max-h-[42rem] w-auto h-auto rounded-xl border border-white/10 object-contain bg-zinc-900"
                />
                {interestButton}
                {editDeleteButtons}
              </div>
            ) : (
              <div
                className={`relative w-full aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-white/10 flex items-center justify-center gap-3 ${classes.dot}`}
              >
                <div className="relative h-16 w-16 shrink-0">
                  <Image
                    src={occurrence.eventType.icon_path}
                    alt=""
                    fill
                    sizes="64px"
                    className="object-contain"
                    unoptimized
                  />
                </div>
                {interestButton}
                {editDeleteButtons}
              </div>
            )}
          </div>

          {/* Carrusel de miniaturas: solo con más de una foto (portada +
              extra) — mismo tratamiento visual que el carrusel de
              PinModal.tsx. */}
          {allPhotos.length > 1 && (
            <div className="flex flex-wrap gap-2 scrollbar-clean pb-1">
              {allPhotos.map((photoUrl, idx) => (
                <button
                  key={`${photoUrl}-${idx}`}
                  type="button"
                  onClick={() => setActivePhotoIdx(idx)}
                  aria-label={`Ver foto ${idx + 1}`}
                  className={`relative shrink-0 w-15 h-10 rounded-lg overflow-hidden border-2 transition-all cursor-pointer bg-zinc-900 ${
                    idx === activePhotoIdx
                      ? "border-amber-300"
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <Image src={photoUrl} alt="" fill sizes="80px" className="object-cover" unoptimized />
                </button>
              ))}
            </div>
          )}

          <h1 id="event-detail-title" {...titleProps} className="text-4xl font-bold text-white">
            {occurrence.title}
          </h1>

          <div className="flex flex-col gap-1 text-white">
            {/* Hora en su propio span con margen izquierdo (no solo un
                espacio suelto en el string): separación visual real
                respecto a la fecha, más grande que antes. */}
            <p className="flex items-baseline text-2xl font-semibold">
              <span>{dateLabel}</span>
              {timeLabel && <span className="ml-4 text-lg font-normal text-white/70">{timeLabel}</span>}
            </p>
            {endDateLabel && <p className="text-sm text-white/60">Hasta: {endDateLabel}</p>}
          </div>

          {occurrence.place && (
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-white/50">Lugar</span>
              <p className="text-base text-white">{occurrence.place}</p>
            </div>
          )}

          {occurrence.description && (
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider text-white/50">Información</span>
              <p className="text-base text-white whitespace-pre-line">{occurrence.description}</p>
            </div>
          )}

          {occurrence.url && (
            <a
              href={occurrence.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 self-start px-6 py-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/40 text-blue-300 text-base font-semibold transition-colors"
            >
              <ExternalLink size={20} />
              Más información
            </a>
          )}

          {/* Precio: nada mientras carga (prices === null) — sin spinner
              ni cabecera "Precio" de por medio, así un evento sin precio
              nunca muestra este bloque ni siquiera un instante. Solo
              aparece si la carga termina y SÍ hay filas. */}
          {prices !== null && prices.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wider text-white/50">Precio</span>
              <ul className="flex flex-col gap-1">
                {prices.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-4 text-white">
                    <span className="text-base text-white/80">{p.reason ?? "Entrada"}</span>
                    <span className="text-lg font-semibold">{formatEventPrice(p.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Distintivos de tipo/cromo + compartir: última fila, con el
              icono de compartir fijado al extremo derecho de la misma
              fila (ya no flotante sobre la imagen). */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium text-white ${classes.badgeBg} ${classes.badgeBorder}`}
              >
                <span className="relative h-4 w-4 shrink-0">
                  <Image src={occurrence.eventType.icon_path} alt="" fill sizes="16px" className="object-contain" unoptimized />
                </span>
                {occurrence.eventType.name}
              </span>
              {occurrence.includesCromo && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-300/15 px-3 py-1 text-sm font-medium text-amber-200">
                  <Sparkles size={14} /> Incluye cromo
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {copied && (
                <span className="flex items-center gap-1 text-sm text-amber-300">
                  <Check size={16} /> Enlace copiado
                </span>
              )}
              <button
                type="button"
                onClick={handleShare}
                aria-label="Copiar enlace del evento"
                title="Compartir"
                className="p-2 rounded-full text-white/60 hover:text-amber-300 hover:bg-white/5 transition-colors cursor-pointer"
              >
                <Share2 size={22} />
              </button>
            </div>
          </div>
        </div>
      </FocusScope>
    </div>
  );
}
