"use client";

import { useState } from "react";
import {
  Mail,
  User,
  AtSign,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import AuroraField from "@/components/ui/AuroraField";
import CornerButton from "@/components/ui/CornerButton";
import { supabase } from "@/lib/supabase/client";
import { checkEmailStatusAction, reRegisterAction } from "./registerActions";

// "reregister" = deactivated account, no pending request → allow update
type Step = "account" | "profile" | "reregister" | "success";

const VALID_SYMBOLS = "!@#$%^&*()-_=+[]{};:,.<>?";
const SYMBOL_REGEX = /[!@#$%^&*()\-_=+\[\]{};:,.<>?]/;

function validatePassword(pw: string): string[] {
  const errors: string[] = [];
  if (pw.length < 8 || pw.length > 100) errors.push("Entre 8 y 100 caracteres");
  if ((pw.match(/[A-Z]/g) ?? []).length < 2) errors.push("Al menos 2 mayúsculas");
  if ((pw.match(/[a-z]/g) ?? []).length < 2) errors.push("Al menos 2 minúsculas");
  if ((pw.match(/[0-9]/g) ?? []).length < 2) errors.push("Al menos 2 números");
  if (!SYMBOL_REGEX.test(pw)) errors.push(`Al menos un símbolo válido: ${VALID_SYMBOLS}`);
  return errors;
}

export default function RegisterRequestForm() {
  const [step, setStep] = useState<Step>("account");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Step 1: email + password ──────────────────────────────────────────────

  const handleAccountSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const errs = validatePassword(password);
    setPasswordErrors(errs);
    if (errs.length > 0) return;

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    const status = await checkEmailStatusAction(email);

    if (status === "active") {
      setError("Ya existe una cuenta activa con este correo. Inicia sesión.");
      setLoading(false);
      return;
    }

    if (status === "pending") {
      setError("Su solicitud aún se está evaluando por un administrador.");
      setLoading(false);
      return;
    }

    if (status === "can_reregister") {
      // Deactivated account, no pending request → re-registration flow
      setLoading(false);
      setStep("reregister");
      return;
    }

    // status === "not_found" → normal new registration
    setLoading(false);
    setStep("profile");
  };

  // ── Step 2a: new user profile ─────────────────────────────────────────────

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data: usernameTaken, error: usernameErr } = await supabase.rpc(
      "username_exists",
      { username_to_check: username }
    );

    if (usernameErr) {
      setError("No se pudo verificar el username. Inténtalo de nuevo.");
      setLoading(false);
      return;
    }

    if (usernameTaken) {
      setError("Este username ya está en uso");
      setLoading(false);
      return;
    }

    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authErr || !authData.user) {
      setError(authErr?.message ?? "No se pudo crear el usuario");
      setLoading(false);
      return;
    }

    const userId = authData.user.id;

    const { error: profileErr } = await supabase
      .from("profile")
      .insert({ id: userId, username, name });

    if (profileErr) {
      setError(profileErr.message);
      setLoading(false);
      return;
    }

    const { error: reqErr } = await supabase.from("request").insert({
      user_id: userId,
      message: message.trim() || null,
    });

    if (reqErr) {
      setError(reqErr.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    setLoading(false);
    setStep("success");
  };

  // ── Step 2b: re-registration (deactivated account) ───────────────────────

  const handleReRegisterSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await reRegisterAction(
      email,
      password,
      username,
      message.trim() || null,
    );

    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setLoading(false);
    setStep("success");
  };

  // ── Success ───────────────────────────────────────────────────────────────

  if (step === "success") {
    return (
      <div className="w-full min-w-65 max-w-sm text-center flex flex-col gap-3">
        <h2 className="text-3xl font-bold text-white">Solicitud enviada</h2>
        <p className="text-zinc-400">
          Te avisaremos por correo cuando un administrador la revise.
        </p>
      </div>
    );
  }

  // ── Re-registration profile step ─────────────────────────────────────────

  if (step === "reregister") {
    return (
      <form
        onSubmit={handleReRegisterSubmit}
        className="w-full min-w-65 max-w-sm flex flex-col gap-8"
      >
        <div className="flex flex-col gap-2">
          <h2 className="hidden md:block text-3xl font-bold text-white text-center">
            Renovar solicitud
          </h2>
          <p className="text-zinc-400 text-sm text-center leading-relaxed">
            Tu cuenta está desactivada. Actualiza tu usuario y envía una nueva solicitud.
          </p>
          <button
            type="button"
            onClick={() => { setError(null); setStep("account"); }}
            className="self-start flex items-center gap-1 text-white/60 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={14} /> Atrás
          </button>
        </div>

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

        <div>
          <label
            htmlFor="reregister-message"
            className="block mb-2 text-sm font-medium text-zinc-400"
          >
            Mensaje (opcional)
          </label>
          <textarea
            id="reregister-message"
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Cuéntanos por qué quieres volver…"
            className="w-full bg-transparent border border-white/30 rounded-lg p-3 text-base font-medium text-white placeholder:text-white/50 focus:outline-none focus:border-amber-300 transition-colors resize-none"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <CornerButton type="submit" disabled={loading} className="mt-4 self-center">
          {loading ? "Enviando…" : "Renovar solicitud"}
        </CornerButton>
      </form>
    );
  }

  // ── New user profile step ─────────────────────────────────────────────────

  if (step === "profile") {
    return (
      <form
        onSubmit={handleProfileSubmit}
        className="w-full min-w-65 max-w-sm flex flex-col gap-8"
      >
        <div className="flex flex-col gap-2">
          <h2 className="hidden md:block text-3xl font-bold text-white text-center">
            Solicita registro
          </h2>
          <button
            type="button"
            onClick={() => { setError(null); setStep("account"); }}
            className="self-start flex items-center gap-1 text-white/60 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={14} /> Atrás
          </button>
        </div>

        <AuroraField
          type="text"
          name="name"
          placeholder="Nombre"
          icon={<User size={20} strokeWidth={2.5} />}
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <AuroraField
          type="text"
          name="username"
          placeholder="Nombre de Usuario"
          icon={<AtSign size={20} strokeWidth={2.5} />}
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <div>
          <label
            htmlFor="register-message"
            className="block mb-2 text-sm font-medium text-zinc-400"
          >
            Mensaje (opcional)
          </label>
          <textarea
            id="register-message"
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Cuéntanos por qué quieres unirte…"
            className="w-full bg-transparent border border-white/30 rounded-lg p-3 text-base font-medium text-white placeholder:text-white/50 focus:outline-none focus:border-amber-300 transition-colors resize-none"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <CornerButton type="submit" disabled={loading} className="mt-4 self-center">
          {loading ? "Enviando…" : "Mandar solicitud"}
        </CornerButton>
      </form>
    );
  }

  // ── Account step (email + password) ──────────────────────────────────────

  return (
    <form
      onSubmit={handleAccountSubmit}
      className="w-full min-w-65 max-w-sm flex flex-col gap-8"
    >
      <h2 className="hidden md:block text-3xl font-bold text-white text-center mb-4">
        Solicita registro
      </h2>

      <AuroraField
        type="email"
        name="email"
        placeholder="Correo"
        icon={<Mail size={20} strokeWidth={2.5} />}
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <AuroraField
        type={showPassword ? "text" : "password"}
        name="password"
        placeholder="Contraseña"
        icon={showPassword ? <EyeOff size={20} strokeWidth={2.5} /> : <Eye size={20} strokeWidth={2.5} />}
        onIconClick={() => setShowPassword((s) => !s)}
        iconAriaLabel={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <AuroraField
        type={showConfirmPassword ? "text" : "password"}
        name="confirmPassword"
        placeholder="Repetir contraseña"
        icon={showConfirmPassword ? <EyeOff size={20} strokeWidth={2.5} /> : <Eye size={20} strokeWidth={2.5} />}
        onIconClick={() => setShowConfirmPassword((s) => !s)}
        iconAriaLabel={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
      />

      {passwordErrors.length > 0 && (
        <ul className="text-red-400 text-sm flex flex-col gap-1 list-disc list-inside">
          {passwordErrors.map((err, i) => <li key={i}>{err}</li>)}
        </ul>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <CornerButton type="submit" disabled={loading} className="mt-4 self-center">
        {loading ? "Comprobando…" : "Solicitar"}
      </CornerButton>
    </form>
  );
}
