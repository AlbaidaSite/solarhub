"use client";

import { useState } from "react";
import { Sun } from "lucide-react";
import LoginForm from "./LoginForm";
import RegisterRequestForm from "./RegisterRequestForm";

type Mode = "login" | "register";

export default function AuthView() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="relative min-h-full flex flex-col items-center justify-center px-6 py-10 md:flex-row md:py-0">
      <div className="md:hidden w-full flex items-center justify-center gap-5 mb-10">
        <TabButton active={mode === "login"} onClick={() => setMode("login")}>
          Inicia sesión
        </TabButton>
        <span aria-hidden className="text-zinc-600 text-xl">/</span>
        <TabButton active={mode === "register"} onClick={() => setMode("register")}>
          Solicita registro
        </TabButton>
      </div>

      <FormSection visible={mode === "login"} side="left">
        <LoginForm />
      </FormSection>

      <Divider />

      <FormSection visible={mode === "register"} side="right">
        <RegisterRequestForm />
      </FormSection>
    </div>
  );
}

function TabButton({
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

function FormSection({
  visible,
  side,
  children,
}: {
  visible: boolean;
  side: "left" | "right";
  children: React.ReactNode;
}) {
  return (
    <section
      className={`
        w-full items-center justify-center
        ${visible ? "flex" : "hidden md:flex"}
        md:flex-1 ${side === "left" ? "md:pr-16" : "md:pl-16"}
      `}
    >
      <div className="flex justify-center">
        {children}
      </div>
    </section>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      className="hidden md:flex absolute inset-y-0 left-1/2 -translate-x-1/2 items-center justify-center"
    >
      <div className="absolute bg-linear-to-b from-transparent via-zinc-700 to-transparent h-full w-px" />
      <div className="relative w-24 h-24 rounded-full border border-zinc-700 bg-black flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.25)]">
        <div className="w-16 h-16 rounded-full bg-linear-to-br from-indigo-500/30 to-amber-400/30 border border-indigo-400/40 flex items-center justify-center">
          <Sun className="text-amber-300" size={28} />
        </div>
      </div>
    </div>
  );
}
