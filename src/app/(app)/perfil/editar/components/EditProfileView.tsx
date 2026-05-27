"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  AtSign,
  Eye,
  EyeClosed,
  TriangleAlert,
} from "lucide-react";

import AuroraField from "@/components/ui/AuroraField";
import CornerButton from "@/components/ui/CornerButton";
import { supabase } from "@/lib/supabase/client";
import { deactivateAccountAction } from "../../actions";

type Section = "email" | "username" | "password";

const VALID_SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>?";
const SYMBOL_REGEX = /[!@#$%^&*()\-_=+\[\]{};:,.<>?]/;

function validatePassword(pw: string): string[] {
  const errors: string[] = [];
  if (pw.length < 8 || pw.length > 100) errors.push("Entre 8 y 100 caracteres");
  if ((pw.match(/[A-Z]/g) ?? []).length < 2) errors.push("Al menos 2 mayúsculas");
  if ((pw.match(/[a-z]/g) ?? []).length < 2) errors.push("Al menos 2 minúsculas");
  if ((pw.match(/[0-9]/g) ?? []).length < 2) errors.push("Al menos 2 números");
  if (!SYMBOL_REGEX.test(pw))
    errors.push(`Al menos un símbolo válido: ${VALID_SYMBOLS}`);
  return errors;
}

type DeactivateStep = "confirm1" | "confirm2";

export default function EditProfileView({
  currentEmail,
  currentUsername,
}: {
  currentEmail: string;
  currentUsername: string;
}) {
  const [section, setSection] = useState<Section>("email");
  const [deactivateStep, setDeactivateStep] = useState<DeactivateStep | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDeactivate = () => {
    startTransition(async () => {
      await deactivateAccountAction();
    });
  };

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-md mb-8">
        <Link
          href="/perfil"
          className="inline-flex items-center gap-1 text-white/60 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={16} /> Volver al perfil
        </Link>
      </div>

      <div className="w-full flex items-center justify-center gap-4 md:gap-5 mb-10 flex-wrap">
        <SectionTab active={section === "email"} onClick={() => setSection("email")}>
          Correo
        </SectionTab>
        <span aria-hidden className="text-zinc-600 text-xl">/</span>
        <SectionTab
          active={section === "username"}
          onClick={() => setSection("username")}
        >
          Usuario
        </SectionTab>
        <span aria-hidden className="text-zinc-600 text-xl">/</span>
        <SectionTab
          active={section === "password"}
          onClick={() => setSection("password")}
        >
          Contraseña
        </SectionTab>
      </div>

      {section === "email" && <EmailForm key="email" current={currentEmail} />}
      {section === "username" && (
        <UsernameForm key="username" current={currentUsername} />
      )}
      {section === "password" && (
        <PasswordForm key="password" currentEmail={currentEmail} />
      )}

      {/* Deactivation trigger */}
      <div className="mt-16 w-full max-w-sm border-t border-white/10 pt-8 flex flex-col items-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => setDeactivateStep("confirm1")}
          className="flex items-center gap-2 text-sm text-white/30 hover:text-red-400 transition-colors cursor-pointer"
        >
          <TriangleAlert size={14} />
          Desactivar cuenta
        </button>
      </div>

      {/* Deactivation modal */}
      {deactivateStep && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => !isPending && setDeactivateStep(null)}
        >
          <div
            className="bg-zinc-900 border border-white/15 rounded-2xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {deactivateStep === "confirm1" ? (
              <>
                <p className="text-white font-semibold text-center">
                  Desactivar cuenta
                </p>
                <p className="text-white/70 text-sm text-center leading-relaxed">
                  Esta acción <strong className="text-white">solo desactiva tu cuenta</strong>, no la elimina.
                  Tus datos se conservarán. Si deseas borrar tu cuenta permanentemente,
                  deberás solicitarlo a un administrador en persona.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeactivateStep("confirm2")}
                    className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors cursor-pointer"
                  >
                    Entiendo, continuar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeactivateStep(null)}
                    className="flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-white font-semibold text-center">
                  ¿Estás seguro?
                </p>
                <p className="text-white/70 text-sm text-center leading-relaxed">
                  Tu sesión se cerrará y no podrás acceder a la plataforma.
                  Para reactivar la cuenta, tendrás que iniciar sesión de nuevo
                  y abrir una nueva solicitud de registro con el mismo correo electrónico.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDeactivateStep(null)}
                    disabled={isPending}
                    className="flex-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    No, cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDeactivate}
                    disabled={isPending}
                    className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isPending ? "Desactivando…" : "Sí, desactivar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xl font-bold transition-colors ${
        active ? "text-white" : "text-white/40 hover:text-white/70"
      }`}
    >
      {children}
    </button>
  );
}

function EmailForm({ current }: { current: string }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Introduce un correo");
      return;
    }
    if (trimmed.toLowerCase() === current.toLowerCase()) {
      setError("Es el mismo correo que tienes ahora");
      return;
    }

    setLoading(true);

    const { data: taken, error: rpcErr } = await supabase.rpc("email_exists", {
      email_to_check: trimmed,
    });
    if (rpcErr) {
      setError("No se pudo verificar el correo");
      setLoading(false);
      return;
    }
    if (taken) {
      setError("Ese correo ya está en uso");
      setLoading(false);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ email: trimmed });
    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setEmail("");
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full min-w-65 max-w-sm flex flex-col gap-6"
    >
      <p className="text-lg text text-zinc-400">
        <strong>Correo actual:</strong><br></br><span className="text-white">{current}</span>
      </p>

      <AuroraField
        type="email"
        name="email"
        placeholder="Nuevo correo"
        icon={<Mail size={20} strokeWidth={2.5} />}
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && (
        <p className="text-emerald-400 text-sm">
          Te hemos enviado un email para confirmar el cambio.
        </p>
      )}

      <CornerButton type="submit" disabled={loading} className="self-center">
        {loading ? "Guardando…" : "Cambiar correo"}
      </CornerButton>
    </form>
  );
}

function UsernameForm({ current }: { current: string }) {
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const trimmed = username.trim();
    if (!trimmed) {
      setError("Introduce un usuario");
      return;
    }
    if (trimmed.toLowerCase() === current.toLowerCase()) {
      setError("Es el mismo usuario que tienes ahora");
      return;
    }

    setLoading(true);

    const { data: taken, error: rpcErr } = await supabase.rpc("username_exists", {
      username_to_check: trimmed,
    });
    if (rpcErr) {
      setError("No se pudo verificar el usuario");
      setLoading(false);
      return;
    }
    if (taken) {
      setError("Ese usuario ya está en uso");
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sesión no encontrada");
      setLoading(false);
      return;
    }

    const { error: updateErr } = await supabase
      .from("profile")
      .update({ username: trimmed })
      .eq("id", user.id);

    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setUsername("");
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full min-w-65 max-w-sm flex flex-col gap-6"
    >
      <p className="text-lg text-zinc-400">
        <strong>Usuario actual:</strong><br></br><span className="text-white">{current}</span>
      </p>

      <AuroraField
        type="text"
        name="username"
        placeholder="Nuevo usuario"
        icon={<AtSign size={20} strokeWidth={2.5} />}
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && <p className="text-emerald-400 text-sm">Usuario actualizado.</p>}

      <CornerButton type="submit" disabled={loading} className="self-center">
        {loading ? "Guardando…" : "Cambiar usuario"}
      </CornerButton>
    </form>
  );
}

function PasswordForm({ currentEmail }: { currentEmail: string }) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [pwErrors, setPwErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setPwErrors([]);

    const errs = validatePassword(newPw);
    if (errs.length > 0) {
      setPwErrors(errs);
      return;
    }
    if (newPw !== confirmPw) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (newPw === currentPw) {
      setError("La nueva contraseña debe ser distinta de la actual");
      return;
    }

    setLoading(true);

    // Re-verifica la contraseña actual antes de aceptar el cambio
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPw,
    });
    if (signInErr) {
      setError("Contraseña actual incorrecta");
      setLoading(false);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({
      password: newPw,
    });
    if (updateErr) {
      setError(updateErr.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
    setLoading(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full min-w-65 max-w-sm flex flex-col gap-5"
    >
      <AuroraField
        type={showCurrent ? "text" : "password"}
        name="currentPassword"
        placeholder="Contraseña actual"
        {...eyeToggleProps(showCurrent, setShowCurrent)}
        autoComplete="current-password"
        value={currentPw}
        onChange={(e) => setCurrentPw(e.target.value)}
        required
      />

      <AuroraField
        type={showNew ? "text" : "password"}
        name="newPassword"
        placeholder="Nueva contraseña"
        {...eyeToggleProps(showNew, setShowNew)}
        autoComplete="new-password"
        value={newPw}
        onChange={(e) => setNewPw(e.target.value)}
        required
      />

      <AuroraField
        type={showConfirm ? "text" : "password"}
        name="confirmPassword"
        placeholder="Repetir nueva contraseña"
        {...eyeToggleProps(showConfirm, setShowConfirm)}
        autoComplete="new-password"
        value={confirmPw}
        onChange={(e) => setConfirmPw(e.target.value)}
        required
      />

      {pwErrors.length > 0 && (
        <ul className="text-red-400 text-sm flex flex-col gap-1 list-disc list-inside">
          {pwErrors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {success && (
        <p className="text-emerald-400 text-sm">Contraseña actualizada.</p>
      )}

      <CornerButton type="submit" disabled={loading} className="mt-2 self-center">
        {loading ? "Guardando…" : "Cambiar contraseña"}
      </CornerButton>
    </form>
  );
}

// Devuelve los props (icon + onIconClick + iconAriaLabel) que AuroraField
// necesita para mostrar el icono del ojo y togglear la visibilidad.
// IMPORTANTE: AuroraField ya envuelve el icono en un <button> interno
// (IconButton), así que aquí pasamos solo el icono — un <button> dentro
// del icono provocaba <button> anidado.
function eyeToggleProps(on: boolean, setOn: (v: boolean) => void) {
  return {
    icon: on
      ? <EyeClosed size={20} strokeWidth={2.5} />
      : <Eye size={20} strokeWidth={2.5} />,
    onIconClick: () => setOn(!on),
    iconAriaLabel: on ? "Ocultar contraseña" : "Mostrar contraseña",
  };
}
