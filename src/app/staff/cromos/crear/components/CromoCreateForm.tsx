"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import ArtistMultiSelect, { type ArtistOption } from "./ArtistMultiSelect";
import CodeGridPreview from "./CodeGridPreview";
import { createCromoAction, generateCodesAction } from "../actions";
import { downloadCromoCodesZip } from "@/scripts/generator";

const SMALLINT_MIN = -32768;
const SMALLINT_MAX = 32767;

// Acepta opcional signo, dígitos y nada más. Evita que parseInt acepte
// "12abc" como 12 (truncamiento silencioso) y bloquea inputs no enteros.
const INT_RE = /^-?\d+$/;

function parseCode(raw: string): number | null {
  const s = raw.trim();
  if (!INT_RE.test(s)) return null;
  const n = Number(s);
  if (!Number.isInteger(n)) return null;
  if (n < SMALLINT_MIN || n > SMALLINT_MAX) return null;
  return n;
}

interface CategoryOpt {
  id: number;
  name: string;
}
interface RarityOpt {
  id: number;
  name: string;
}

interface CromoCreateFormProps {
  categories: CategoryOpt[];
  rarities: RarityOpt[];
  artists: ArtistOption[];
}

// Estilos compartidos entre inputs/textareas/selects para mantener
// coherencia visual sin repetir clases en cada campo.
const FIELD_CLASS =
  "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm placeholder-white/40 focus:outline-none focus:border-amber-300 transition-colors";
const LABEL_CLASS = "text-xs font-semibold text-white/70 uppercase tracking-wide";

export default function CromoCreateForm({
  categories,
  rarities,
  artists,
}: CromoCreateFormProps) {
  const router = useRouter();

  // Campos del formulario
  const [name, setName] = useState("");
  const [frontImage, setFrontImage] = useState<File | null>(null);
  const [backImage, setBackImage] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [number, setNumber] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [rarityId, setRarityId] = useState<string>("");
  const [howTo, setHowTo] = useState("");
  const [howToExtended, setHowToExtended] = useState("");
  const [artistIds, setArtistIds] = useState<number[]>([]);
  const [copies, setCopies] = useState("");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [forLoukou, setForLoukou] = useState(false);
  const [hidden, setHidden] = useState(false);

  // Estado de generación / creación. Los codes se guardan como strings
  // para permitir edición libre (incluido "-" intermedio). Se parsean a
  // números al validar/enviar.
  const [codes, setCodes] = useState<string[] | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isGenerating, startGenerating] = useTransition();
  const [isCreating, startCreating] = useTransition();

  // Si cambian categoría o copias después de generar, los códigos quedan
  // desincronizados con la categoría/copias actual: invalidamos.
  const invalidateCodes = () => {
    if (codes !== null) setCodes(null);
    if (createError) setCreateError(null);
  };

  // Parseo derivado: códigos válidos como números, o null si alguno falla.
  const codesNumeric = codes?.map(parseCode) ?? null;
  const codesValid =
    codesNumeric !== null && codesNumeric.every((n) => n !== null);

  const updateCode = (idx: number, value: string) => {
    setCodes((prev) => (prev ? prev.map((c, i) => (i === idx ? value : c)) : null));
    if (createError) setCreateError(null);
  };

  const handleGenerate = () => {
    setGenerateError(null);
    setCreateError(null);
    const catId = Number(categoryId);
    const cop = Number(copies);
    if (!Number.isInteger(catId) || catId <= 0) {
      setGenerateError("Selecciona una categoría primero.");
      return;
    }
    if (!Number.isInteger(cop) || cop <= 0) {
      setGenerateError("Indica el número de copias (entero positivo).");
      return;
    }
    startGenerating(async () => {
      const result = await generateCodesAction(catId, cop);
      if (result.ok) {
        setCodes(result.codes.map((c) => String(c)));
      } else {
        setCodes(null);
        setGenerateError(result.error);
      }
    });
  };

  const handleCreate = () => {
    setCreateError(null);
    if (!codes || codes.length === 0) {
      setCreateError("Genera primero los códigos.");
      return;
    }
    if (!codesValid || !codesNumeric) {
      setCreateError(
        `Hay códigos inválidos. Cada code debe ser un entero en [${SMALLINT_MIN}, ${SMALLINT_MAX}].`,
      );
      return;
    }
    if (!frontImage || !backImage) {
      setCreateError("Faltan las imágenes (frente y dorso).");
      return;
    }
    if (!name.trim()) {
      setCreateError("El nombre es obligatorio.");
      return;
    }

    const finalCodes = codesNumeric as number[];

    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("description", description);
    fd.append("number", number);
    fd.append("categoryId", categoryId);
    fd.append("rarityId", rarityId);
    fd.append("howTo", howTo);
    fd.append("howToExtended", howToExtended);
    fd.append("copies", copies);
    fd.append("allowMultiple", allowMultiple ? "true" : "false");
    fd.append("forLoukou", forLoukou ? "true" : "false");
    fd.append("hidden", hidden ? "true" : "false");
    fd.append("artistIds", JSON.stringify(artistIds));
    fd.append("codes", JSON.stringify(finalCodes));
    fd.append("frontImage", frontImage);
    fd.append("backImage", backImage);

    startCreating(async () => {
      const result = await createCromoAction(fd);
      if (result.ok) {
        // Tras guardar OK, dispara la descarga del ZIP con un SVG por code.
        // Si la descarga fallase, navegamos igualmente al listado.
        try {
          await downloadCromoCodesZip(finalCodes, name.trim(), Number(number));
        } catch (err) {
          console.error("Error generando ZIP:", err);
        }
        router.push("/staff/cromos");
        router.refresh();
      } else {
        setCreateError(result.error);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto w-full">
      {/* ── COLUMNA IZQUIERDA: FORMULARIO ─────────────────────────────────── */}
      <div className="rounded-xl border border-white/15 bg-black/30 p-5 flex flex-col gap-4">
        <h2 className="text-lg font-bold text-white">Datos del cromo</h2>

        <Field label="Nombre">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={FIELD_CLASS}
            required
          />
        </Field>

        <Field label="Img. Frontal (.webp)">
          <input
            type="file"
            accept="image/webp"
            onChange={(e) => setFrontImage(e.target.files?.[0] ?? null)}
            className={`${FIELD_CLASS} file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-white/10 file:text-white/80 file:cursor-pointer`}
          />
        </Field>

        <Field label="Img. Dorso (.webp)">
          <input
            type="file"
            accept="image/webp"
            onChange={(e) => setBackImage(e.target.files?.[0] ?? null)}
            className={`${FIELD_CLASS} file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-white/10 file:text-white/80 file:cursor-pointer`}
          />
        </Field>

        <Field label="Descripción">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${FIELD_CLASS} resize-y`}
          />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Número">
            <input
              type="number"
              min={1}
              value={number}
              onChange={(e) => {
                setNumber(e.target.value);
                invalidateCodes();
              }}
              className={FIELD_CLASS}
            />
          </Field>

          <Field label="Categoría">
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                invalidateCodes();
              }}
              className={`${FIELD_CLASS} cursor-pointer [&>option]:bg-zinc-900`}
            >
              <option value="">Selecciona…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Rareza">
          <select
            value={rarityId}
            onChange={(e) => setRarityId(e.target.value)}
            className={`${FIELD_CLASS} cursor-pointer [&>option]:bg-zinc-900`}
          >
            <option value="">Selecciona…</option>
            {rarities.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        </div>

        <Field label="Pista corta (how_to)">
          <input
            type="text"
            value={howTo}
            onChange={(e) => setHowTo(e.target.value)}
            className={FIELD_CLASS}
          />
        </Field>

        <Field label="Pista (how_to_extended)">
          <textarea
            value={howToExtended}
            onChange={(e) => setHowToExtended(e.target.value)}
            rows={3}
            className={`${FIELD_CLASS} resize-y`}
          />
        </Field>

        <Field label="Artistas">
          <ArtistMultiSelect
            artists={artists}
            selectedIds={artistIds}
            onChange={setArtistIds}
          />
        </Field>

        <Field label="Copias">
          <input
            type="number"
            min={1}
            value={copies}
            onChange={(e) => {
              setCopies(e.target.value);
              invalidateCodes();
            }}
            className={FIELD_CLASS}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={allowMultiple}
              onChange={(e) => setAllowMultiple(e.target.checked)}
              className="size-4 rounded accent-amber-300 cursor-pointer"
            />
            Múltiple? <span className="text-white/40 text-xs">(allow_multiple_users)</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={forLoukou}
              onChange={(e) => setForLoukou(e.target.checked)}
              className="size-4 rounded accent-amber-300 cursor-pointer"
            />
            Restringido? <span className="text-white/40 text-xs">(for_loukou)</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-white/80 cursor-pointer">
            <input
              type="checkbox"
              checked={hidden}
              onChange={(e) => setHidden(e.target.checked)}
              className="size-4 rounded accent-amber-300 cursor-pointer"
            />
            Oculto? <span className="text-white/40 text-xs">(hide_til_registered)</span>
          </label>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="mt-2 w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold shadow transition-colors cursor-pointer"
        >
          {isGenerating ? "Generando…" : "Generar"}
        </button>

        {generateError && (
          <p className="text-red-400 text-sm">{generateError}</p>
        )}
      </div>

      {/* ── COLUMNA DERECHA: CÓDIGOS GENERADOS ────────────────────────────── */}
      <div className="rounded-xl border border-white/15 bg-black/30 p-5 flex flex-col gap-4">
        <h2 className="text-lg font-bold text-white">Códigos por copia</h2>

        {!codes && (
          <p className="text-white/50 text-sm">
            Pulsa <span className="text-white/80">Generar</span> en la columna izquierda
            para obtener un código aleatorio por cada copia (
            {Number(copies) || "—"} en total).
          </p>
        )}

        {codes && codes.length > 0 && (
          <>
            <p className="text-xs text-white/50">
              Los códigos son sugerencias aleatorias; puedes editarlos antes
              de crear el cromo. La cuadrícula se actualiza al instante.
            </p>

            <div className="rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full text-sm text-white">
                <thead className="bg-white/10 text-white/60 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">Copia</th>
                    <th className="px-3 py-2 text-left">Code</th>
                    <th className="px-3 py-2 text-center">Preview</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {codes.map((codeStr, i) => {
                    const parsed = parseCode(codeStr);
                    const invalid = parsed === null;
                    return (
                      <tr key={i} className="hover:bg-white/5">
                        <td className="px-3 py-1.5 tabular-nums w-14">#{i + 1}</td>
                        <td className="px-3 py-1.5">
                          <input
                            type="number"
                            min={SMALLINT_MIN}
                            max={SMALLINT_MAX}
                            step={1}
                            value={codeStr}
                            onChange={(e) => updateCode(i, e.target.value)}
                            aria-invalid={invalid}
                            className={`w-full px-2 py-1 rounded bg-white/5 border text-right font-mono text-sm focus:outline-none transition-colors ${
                              invalid
                                ? "border-red-500/60 text-red-300 focus:border-red-400"
                                : "border-white/15 text-white focus:border-amber-300"
                            }`}
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <div className="flex justify-center">
                            {/* Si el code es inválido, mostramos el grid con
                                code=0 (todos los anillos vacíos) como
                                placeholder visual. */}
                            <CodeGridPreview code={parsed ?? 0} cellSize={3} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={isCreating || !codesValid}
              className="mt-2 w-full px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-zinc-900 font-bold shadow transition-colors cursor-pointer"
            >
              {isCreating ? "Creando…" : "Crear Cromo"}
            </button>

            {!codesValid && (
              <p className="text-amber-300 text-xs">
                Hay códigos inválidos: deben ser enteros en [{SMALLINT_MIN}, {SMALLINT_MAX}].
              </p>
            )}
            {createError && <p className="text-red-400 text-sm">{createError}</p>}
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={LABEL_CLASS}>{label}</span>
      {children}
    </label>
  );
}
