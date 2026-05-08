"use client";

import { useState } from "react";
import { AtSign, Lock } from "lucide-react";
import AuroraField from "@/components/ui/AuroraField";
import CornerButton from "@/components/ui/CornerButton";
import { supabase } from "@/lib/supabase/client";

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const identifier = String(formData.get("identifier") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    let email = identifier;

    // Si no parece un email, lo tratamos como username y resolvemos el email asociado
    if (!identifier.includes("@")) {
      const { data: lookup, error: lookupError } = await supabase.rpc(
        "email_for_username",
        { username_to_check: identifier }
      );

      if (lookupError || !lookup) {
        setError("Email o contraseña incorrectos");
        setLoading(false);
        return;
      }

      email = lookup;
    }

    const { data: { user: signedInUser }, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signedInUser) {
      setError("Email o contraseña incorrectos");
      setLoading(false);
      return;
    }

    // Block deactivated accounts before completing the login
    const { data: creds } = await supabase
      .from("credentials")
      .select("is_active")
      .eq("user_id", signedInUser.id)
      .maybeSingle();

    if (!creds?.is_active) {
      await supabase.auth.signOut();
      setError("Email o contraseña incorrectos");
      setLoading(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect") ?? "/";
    window.location.href = redirect;
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full min-w-65 max-w-sm flex flex-col gap-10"
    >
      <h2 className="hidden md:block text-3xl font-bold text-white text-center mb-4">
        Inicia sesión
      </h2>

      <AuroraField
        type="text"
        name="identifier"
        placeholder="Email o usuario"
        icon={<AtSign size={20} strokeWidth={2.5} />}
        autoComplete="username"
        required
      />

      <AuroraField
        type="password"
        name="password"
        placeholder="Contraseña"
        icon={<Lock size={20} strokeWidth={2.5} />}
        autoComplete="current-password"
        required
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <CornerButton type="submit" disabled={loading} className="mt-4 self-center">
        {loading ? "Accediendo…" : "Acceder"}
      </CornerButton>
    </form>
  );
}
