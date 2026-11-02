// @vitest-environment jsdom
// SUT: src/app/(app)/mapa/components/BunnyVideo.tsx
//
// El iframe del reproductor solo aparece tras pulsar play (la URL firmada
// se pide en ese momento) y, mientras el vídeo se procesa, se consulta su
// estado cada PROCESSING_POLL_INTERVAL_MS hasta un máximo.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/app/(app)/mapa/video-actions", () => ({
  getVideoEmbedUrlAction: vi.fn(),
  syncVideoStatusAction: vi.fn(),
}));

import {
  getVideoEmbedUrlAction,
  syncVideoStatusAction,
} from "@/app/(app)/mapa/video-actions";
import BunnyVideo from "@/app/(app)/mapa/components/BunnyVideo";
import {
  PROCESSING_POLL_INTERVAL_MS,
  PROCESSING_POLL_MAX_MS,
} from "@/lib/bunny/constants";

const EMBED_URL = "https://player.mediadelivery.net/embed/12345/abc?token=t&expires=1";

function renderVideo(initialDisplay: "playable" | "processing" | "failed" | "hidden") {
  return render(
    <BunnyVideo
      mediaId={55}
      thumbnailUrl="https://vz-test.b-cdn.net/abc/thumbnail.jpg"
      initialDisplay={initialDisplay}
      title="Parque del Retiro"
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("BunnyVideo · listo para reproducir", () => {
  it("al inicio hay miniatura y botón de play, pero no iframe", () => {
    const { container } = renderVideo("playable");
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://vz-test.b-cdn.net/abc/thumbnail.jpg",
    );
    expect(screen.getByRole("button", { name: "Reproducir vídeo" })).toBeInTheDocument();
    expect(getVideoEmbedUrlAction).not.toHaveBeenCalled();
  });

  it("al pulsar play pide la URL firmada y pinta el iframe", async () => {
    vi.mocked(getVideoEmbedUrlAction).mockResolvedValue({ ok: true, url: EMBED_URL });
    const { container } = renderVideo("playable");

    await userEvent.click(screen.getByRole("button", { name: "Reproducir vídeo" }));

    expect(getVideoEmbedUrlAction).toHaveBeenCalledWith(55);
    const iframe = container.querySelector("iframe")!;
    expect(iframe).toHaveAttribute("src", EMBED_URL);
    expect(iframe).toHaveAttribute("title", "Parque del Retiro");
    expect(iframe.getAttribute("allow")).toContain("autoplay");
    expect(iframe.getAttribute("allow")).toContain("fullscreen");
    expect(iframe).toHaveAttribute("allowfullscreen");
  });

  it("si la action falla, muestra el error y no hay iframe", async () => {
    vi.mocked(getVideoEmbedUrlAction).mockResolvedValue({
      ok: false,
      error: "El vídeo todavía no está disponible.",
    });
    const { container } = renderVideo("playable");

    await userEvent.click(screen.getByRole("button", { name: "Reproducir vídeo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El vídeo todavía no está disponible.");
    expect(container.querySelector("iframe")).toBeNull();
  });
});

describe("BunnyVideo · procesando", () => {
  it("muestra el aviso y consulta el estado cada intervalo hasta el máximo", async () => {
    vi.useFakeTimers();
    vi.mocked(syncVideoStatusAction).mockResolvedValue({ ok: true, display: "processing" });
    renderVideo("processing");

    expect(screen.getByText("Procesando vídeo…")).toBeInTheDocument();
    expect(syncVideoStatusAction).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROCESSING_POLL_INTERVAL_MS);
    });
    expect(syncVideoStatusAction).toHaveBeenCalledTimes(1);
    expect(syncVideoStatusAction).toHaveBeenCalledWith(55);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROCESSING_POLL_MAX_MS * 2);
    });
    const maxPolls = Math.floor(PROCESSING_POLL_MAX_MS / PROCESSING_POLL_INTERVAL_MS);
    expect(syncVideoStatusAction).toHaveBeenCalledTimes(maxPolls);
  });

  it("cuando el polling devuelve playable, deja de consultar y ofrece play", async () => {
    vi.useFakeTimers();
    vi.mocked(syncVideoStatusAction).mockResolvedValue({ ok: true, display: "playable" });
    renderVideo("processing");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROCESSING_POLL_INTERVAL_MS);
    });
    expect(screen.getByRole("button", { name: "Reproducir vídeo" })).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(PROCESSING_POLL_INTERVAL_MS * 3);
    });
    expect(syncVideoStatusAction).toHaveBeenCalledTimes(1);
  });
});

describe("BunnyVideo · otros estados", () => {
  it("failed: mensaje de error para quien puede arreglarlo", () => {
    renderVideo("failed");
    expect(screen.getByText(/No se ha podido procesar el vídeo/)).toBeInTheDocument();
  });

  it("hidden: no renderiza nada", () => {
    const { container } = renderVideo("hidden");
    expect(container).toBeEmptyDOMElement();
  });
});
