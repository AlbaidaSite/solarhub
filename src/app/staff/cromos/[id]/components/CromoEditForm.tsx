"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateCodesAction } from "../../crear/actions";
import { updateCromoAction } from "../actions";
import ArtistMultiSelect, {
  type ArtistOption,
} from "../../crear/components/ArtistMultiSelect";
import CodeGridPreview from "../../crear/components/CodeGridPreview";

interface CategoryOpt { id: number; name: string }
interface RarityOpt   { id: number; name: string }

interface InitialValues {
  name: string;
  description: string;
  number: string;
  categoryId: string;
  rarityId: string;
  howTo: string;
  howToExtended: string;
  copies: string;
  allowMultiple: boolean;
  forLoukou: boolean;
  artistIds: number[];
  frontImgPath: string;
  backImgPath: string;
}

interface CromoEditFormProps {
  cromoId: number;
  labelsId: number;
  initial: InitialValues;
  initialCodes: string[];         // ordered by copy_number
  categories: CategoryOpt[];
  rarities: RarityOpt[];
  artists: ArtistOption[];
}

const SMALLINT_MIN = -32768;
const SMALLINT_MAX = 32767;
const INT_RE = /^-?\d+$/;

function parseCode(raw: string): number | null {
  const s = raw.trim();
  if (!INT_RE.test(s)) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= SMALLINT_MIN && n <= SMALLINT_MAX ? n : null;
}

const FIELD_CLASS =
  "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white text-sm placeholder-white/40 focus:outline-none focus:border-amber-300 transition-colors";
const LABEL_CLASS = "text-xs font-semibold text-white/70 uppercase tracking-wide";

export default function CromoEditForm({
  cromoId,
  labelsId,
  initial,
  initialCodes,
  categories,
  rarities,
  artists,
}: CromoEditFormProps) {
  const router = useRouter();

  // ── Campos del formulario ─────────────────────────────────────────────────
  const [name, setName]               = useState(initial.name);
  const [frontImage, setFrontImage]   = useState<File | null>(null);
  const [backImage, setBackImage]     = useState<File | null>(null);
  const [description, setDescription] = useState(initial.description);
  const [number, setNumber]           = useState(initial.number);
  const [categoryId, setCategoryId]   = useState(initial.categoryId);
  const [rarityId, setRarityId]       = useState(initial.rarityId);
  const [howTo, setHowTo]             = useState(initial.howTo);
  const [howToExtended, setHowToExtended] = useState(initial.howToExtended);
  const [artistIds, setArtistIds]     = useState<number[]>(initial.artistIds);
  const [copies, setCopies]           = useState(initial.copies);
  const [allowMultiple, setAllowMultiple] = useState(initial.allowMultiple);
  const [forLoukou, setForLoukou]     = useState(initial.forLoukou);

  // ── Estado de códigos ─────────────────────────────────────────────────────
  const [codes, setCodes] = useState<string[]>(initialCodes);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [saveError, setSaveError]         = useState<string | null>(null);
  const [isSaving, startSaving]     = useTransition();
  const [isGenerating, startGen]    = useTransition();

  // Cuando copies < codes.length → truncar directamente.
  // Cuando copies > codes.length → marcar que hay pendientes de generar.
  const copiesNum   = parseInt(copies, 10);
  const codesValid  = codes.every((c) => parseCode(c) !== null);
  const needsMore   = Number.isFinite(copiesNum) && copiesNum > codes.length;
  const exceedMore  = Number.isFinite(copiesNum) && copiesNum < codes.length;

  const handleCopiesChange = (value: string) => {
    setCopies(value);
    setSaveError(null);
    const n = parseInt(value, 10);
    if (Number.isFinite(n) && n > 0 && n < codes.length) {
      // Truncar códigos excedentes automáticamente
      setCodes((prev) => prev.slice(0, n));
    }
  };

  const handleGenerateMore = () => {
    setGenerateError(null);
    const catId = Number(categoryId);
    const total = parseInt(copies, 10);
    const missing = total - codes.length;
    if (!Number.isFinite(catId) || catId <= 0) {
      setGenerateError("Selecciona una categoría primero.");
      return;
    }
    if (missing <= 0) return;
    startGen(async () => {
      const result = await generateCodesAction(catId, missing);
      if (result.ok) {
        setCodes((prev) => [...prev, ...result.codes.map(String)]);
      } else {
        setGenerateError(result.error);
      }
    });
  };

  const handleSave = () => {
    setSaveError(null);
    if (!codesValid) {
      setSaveError(`Hay códigos inválidos. Deben ser enteros en [${SMALLINT_MIN}, ${SMALLINT_MAX}].`);
      return;
    }
    const finalCopies = parseInt(copies, 10);
    if (codes.length !== finalCopies) {
      setSaveError("El número de códigos no coincide con las copias.");
      return;
    }

    const finalCodes = codes.map((s) => parseCode(s)) as number[];

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
    fd.append("artistIds", JSON.stringify(artistIds));
    fd.append("codes", JSON.stringify(finalCodes));
    fd.append("currentFrontPath", initial.frontImgPath);
    fd.append("currentBackPath", initial.backImgPath);
    if (frontImage) fd.append("frontImage", frontImage);
    if (backImage)  fd.append("backImage", backImage);

    startSaving(async () => {
      const result = await updateCromoAction(cromoId, labelsId, fd);
      if (result.ok) {
        router.push("/staff/cromos");
        router.refresh();
      } else {
        setSaveError(result.error);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto w-full">
      {/* ── COLUMNA IZQUIERDA: FORMULARIO ───────────────────────────────── */}
      <div className="rounded-xl border border-white/15 bg-black/30 p-5 flex flex-col gap-4">
        <h2 className="text-lg font-bold text-white">Datos del cromo</h2>

        <Field label="Nombre">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={FIELD_CLASS} />
        </Field>

        <Field label={`Img. Frontal — actual: ${initial.frontImgPath.split("/").pop()}`}>
          <input type="file" accept="image/webp"
            onChange={(e) => setFrontImage(e.target.files?.[0] ?? null)}
            className={`${FIELD_CLASS} file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-white/10 file:text-white/80 file:cursor-pointer`} />
        </Field>

        <Field label={`Img. Dorso — actual: ${initial.backImgPath.split("/").pop()}`}>
          <input type="file" accept="image/webp"
            onChange={(e) => setBackImage(e.target.files?.[0] ?? null)}
            className={`${FIELD_CLASS} file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-white/10 file:text-white/80 file:cursor-pointer`} />
        </Field>

        <Field label="Descripción">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)}
            rows={3} className={`${FIELD_CLASS} resize-y`} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Número">
            <input type="number" min={1} value={number} onChange={(e) => setNumber(e.target.value)} className={FIELD_CLASS} />
          </Field>

          <Field label="Categoría">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className={`${FIELD_CLASS} cursor-pointer [&>option]:bg-zinc-900`}>
              <option value="">Selecciona…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Rareza">
          <select value={rarityId} onChange={(e) => setRarityId(e.target.value)}
            className={`${FIELD_CLASS} cursor-pointer [&>option]:bg-zinc-900`}>
            <option value="">Selecciona…</option>
            {rarities.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Field>

        <Field label="Pista corta (how_to)">
          <input type="text" value={howTo} onChange={(e) => setHowTo(e.target.value)} className={FIELD_CLASS} />
        </Field>

        <Field label="Pista (how_to_extended)">
          <textarea value={howToExtended} onChange={(e) => setHowToExtended(e.target.value)}
            rows={3} className={`${FIELD_CLASS} resize-y`} />
        </Field>

        <Field label="Artistas">
          <ArtistMultiSelect artists={artists} selectedIds={artistIds} onChange={setArtistIds} />
        </Field>

        <Field label="Copias">
          <input type="number" min={1} value={copies}
            onChange={(e) => handleCopiesChange(e.target.value)} className={FIELD_CLASS} />
        </Field>

        <div className="flex flex-col gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-white/80 cursor-pointer">
            <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)}
              className="size-4 rounded accent-amber-300 cursor-pointer" />
            Múltiple? <span className="text-white/40 text-xs">(allow_multiple_users)</span>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-white/80 cursor-pointer">
            <input type="checkbox" checked={forLoukou} onChange={(e) => setForLoukou(e.target.checked)}
              className="size-4 rounded accent-amber-300 cursor-pointer" />
            Restringido? <span className="text-white/40 text-xs">(for_loukou)</span>
          </label>
        </div>
      </div>

      {/* ── COLUMNA DERECHA: UNIQUES / CODES ──────────────────────────── */}
      <div className="rounded-xl border border-white/15 bg-black/30 p-5 flex flex-col gap-4">
        <h2 className="text-lg font-bold text-white">Códigos por copia</h2>

        {exceedMore && (
          <p className="text-amber-300 text-xs">
            Has reducido las copias de {initialCodes.length} a {copies}. Los códigos excedentes
            se han eliminado del listado y se borrarán en la base de datos al guardar.
          </p>
        )}

        {needsMore && (
          <div className="flex flex-col gap-2">
            <p className="text-amber-300 text-xs">
              Hay {parseInt(copies, 10) - codes.length} copia(s) sin código. Genera los nuevos
              antes de guardar.
            </p>
            <button type="button" onClick={handleGenerateMore} disabled={isGenerating}
              className="w-full px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold transition-colors cursor-pointer">
              {isGenerating ? "Generando…" : "Generar códigos adicionales"}
            </button>
            {generateError && <p className="text-red-400 text-sm">{generateError}</p>}
          </div>
        )}

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
                        type="number" min={SMALLINT_MIN} max={SMALLINT_MAX} step={1}
                        value={codeStr}
                        onChange={(e) => {
                          const updated = [...codes];
                          updated[i] = e.target.value;
                          setCodes(updated);
                          setSaveError(null);
                        }}
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
                        <CodeGridPreview code={parsed ?? 0} cellSize={3} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {codes.length === 0 && (
            <p className="px-4 py-6 text-center text-white/40 text-sm">Sin uniques.</p>
          )}
        </div>

        <button type="button" onClick={handleSave}
          disabled={isSaving || !codesValid || needsMore}
          className="mt-2 w-full px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-zinc-900 font-bold shadow transition-colors cursor-pointer">
          {isSaving ? "Guardando…" : "Guardar cambios"}
        </button>

        {!codesValid && (
          <p className="text-amber-300 text-xs">
            Hay códigos inválidos: deben ser enteros en [{SMALLINT_MIN}, {SMALLINT_MAX}].
          </p>
        )}
        {saveError && <p className="text-red-400 text-sm">{saveError}</p>}
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
