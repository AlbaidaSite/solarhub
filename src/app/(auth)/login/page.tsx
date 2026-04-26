import type { Metadata } from "next";
import AuthView from "../components/AuthView";

export const metadata: Metadata = {
  title: "SolarHub - Acceso",
};

export default function AuthPage() {
  return <AuthView />;
}
