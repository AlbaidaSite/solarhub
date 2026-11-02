// @vitest-environment jsdom
// SUT: src/app/(app)/mapa/nueva/components/MediaSection.tsx
//
// Los vídeos se validan en el navegador antes de enviar (tipo, tamaño y
// duración, ver lib/media/videoValidation.ts) y los errores salen junto al
// fichero. jsdom no decodifica vídeo: se simula la lectura de metadatos.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { act, fireEvent, render, screen, cleanup } from "@testing-library/react";
import MediaSection, { type MediaEntry } from "@/app/(app)/mapa/nueva/components/MediaSection";

function Harness() {
  const [entries, setEntries] = useState<MediaEntry[]>([]);
  return (
    <MediaSection
      entries={entries}
      onAdd={(added) => setEntries((prev) => [...prev, ...added])}
      onRemove={() => undefined}
      onUpdate={(id, changes) =>
        setEntries((prev) => prev.map((e) => (e.clientId === id ? { ...e, ...changes } : e)))
      }
    />
  );
}

function videoFile(name: string, sizeBytes: number): File {
  const file = new File(["x"], name, { type: "video/mp4" });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

const srcDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "src");
const durationDescriptor = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "duration");

// Simula que el navegador lee la duración al asignar src.
function fakeVideoMetadata(durationS: number) {
  Object.defineProperty(HTMLMediaElement.prototype, "duration", {
    configurable: true,
    get: () => durationS,
  });
  Object.defineProperty(HTMLMediaElement.prototype, "src", {
    configurable: true,
    set(this: HTMLMediaElement) {
      setTimeout(() => this.dispatchEvent(new Event("loadedmetadata")), 0);
    },
    get: () => "",
  });
}

// jsdom no implementa object URLs.
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeEach(() => {
  cleanup();
  URL.createObjectURL = () => "blob:x";
  URL.revokeObjectURL = () => undefined;
});

afterEach(() => {
  if (srcDescriptor) Object.defineProperty(HTMLMediaElement.prototype, "src", srcDescriptor);
  if (durationDescriptor) Object.defineProperty(HTMLMediaElement.prototype, "duration", durationDescriptor);
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  vi.useRealTimers();
});

function pick(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe("MediaSection · validación de vídeos", () => {
  it("muestra junto al fichero todos los errores (tamaño y duración)", async () => {
    fakeVideoMetadata(75);
    render(<Harness />);

    pick(videoFile("largo.mp4", 600 * 1024 * 1024));

    expect(await screen.findByText(/supera el tamaño máximo \(500 MB\)/)).toHaveTextContent(
      /dura más de 60 s/,
    );
  });

  it("si el navegador no puede leer la duración, no es un error", async () => {
    vi.useFakeTimers();
    render(<Harness />);

    pick(videoFile("hevc.mov", 20 * 1024 * 1024));
    // Sin loadedmetadata: vence la espera de 5 s de la duración y la de 6 s
    // de la miniatura.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });

    expect(screen.queryByText(/dura más de/)).not.toBeInTheDocument();
    expect(screen.queryByText(/supera el tamaño/)).not.toBeInTheDocument();
    expect(screen.getByText("20.0 MB")).toBeInTheDocument();
  });

  it("un vídeo de más de 15 MB ya no se rechaza (el límite de vídeo es 500 MB)", async () => {
    fakeVideoMetadata(40);
    vi.useFakeTimers();
    render(<Harness />);

    pick(videoFile("normal.mp4", 80 * 1024 * 1024));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });

    expect(screen.queryByText(/máx\. 15 MB/)).not.toBeInTheDocument();
    expect(screen.getByText("80.0 MB")).toBeInTheDocument();
  });
});
