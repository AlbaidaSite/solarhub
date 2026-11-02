// @vitest-environment jsdom
// SUT: src/app/(app)/mapa/hooks/useMediaUploads.ts + nueva/components/UploadStatusList.tsx
//
// Subida de la multimedia de un pin: fotos a Storage + addMapMediaAction,
// vídeos de uno en uno por TUS a Bunny (tus-js-client mockeado). Un fallo
// de TUS cancela la fila con abortVideoUploadAction y queda como error,
// que el formulario ofrece reintentar.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UploadFailure } from "@/app/(app)/mapa/hooks/useMediaUploads";
import type { MediaEntry } from "@/app/(app)/mapa/nueva/components/MediaSection";

// ─── tus-js-client: cada Upload queda registrado y el test decide qué pasa ──

interface TusOptions {
  endpoint: string;
  headers: Record<string, string>;
  metadata: Record<string, string>;
  retryDelays: number[];
  removeFingerprintOnSuccess: boolean;
  onProgress: (sent: number, total: number) => void;
  onSuccess: () => void;
  onError: (err: Error) => void;
}

const tus = vi.hoisted(() => ({
  uploads: [] as Array<{ file: Blob; options: TusOptions }>,
  // Por defecto, éxito inmediato.
  onStart: (options: TusOptions) => options.onSuccess(),
}));

vi.mock("tus-js-client", () => ({
  Upload: class {
    constructor(
      private file: Blob,
      private options: TusOptions,
    ) {
      tus.uploads.push({ file, options });
    }
    start() {
      tus.onStart(this.options);
    }
  },
}));

const storageUpload = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload: storageUpload }) } },
}));

vi.mock("@/app/(app)/mapa/actions", () => ({
  addMapMediaAction: vi.fn(),
}));

vi.mock("@/app/(app)/mapa/video-actions", () => ({
  createVideoUploadAction: vi.fn(),
  abortVideoUploadAction: vi.fn(),
  syncVideoStatusAction: vi.fn(),
}));

import { addMapMediaAction } from "@/app/(app)/mapa/actions";
import {
  abortVideoUploadAction,
  createVideoUploadAction,
  syncVideoStatusAction,
} from "@/app/(app)/mapa/video-actions";
import { useMediaUploads } from "@/app/(app)/mapa/hooks/useMediaUploads";
import UploadStatusList from "@/app/(app)/mapa/nueva/components/UploadStatusList";

function entry(id: string, mediaType: "PHOTO" | "VIDEO", type: string): MediaEntry {
  const blob = new Blob(["x".repeat(100)], { type });
  return {
    clientId: id,
    originalName: `${id}.${mediaType === "PHOTO" ? "webp" : "mp4"}`,
    mediaType,
    processedBlob: blob,
    processedSize: blob.size,
    previewUrl: "",
    status: "ready",
    errorMsg: null,
    durationS: mediaType === "VIDEO" ? 40 : undefined,
  };
}

function Harness({
  entries,
  onDone,
}: {
  entries: MediaEntry[];
  onDone: (failures: UploadFailure[]) => void;
}) {
  const { statuses, runUploadRound } = useMediaUploads();
  return (
    <>
      <button type="button" onClick={async () => onDone(await runUploadRound(9, entries))}>
        Subir
      </button>
      <UploadStatusList entries={entries} statuses={statuses} />
    </>
  );
}

let nextMediaId = 100;

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  tus.uploads = [];
  tus.onStart = (options) => options.onSuccess();
  nextMediaId = 100;
  storageUpload.mockImplementation(async (path: string) => ({ data: { path }, error: null }));
  vi.mocked(addMapMediaAction).mockResolvedValue({ ok: true });
  vi.mocked(createVideoUploadAction).mockImplementation(async () => {
    const mediaId = nextMediaId++;
    return {
      ok: true,
      mediaId,
      videoId: `guid-${mediaId}`,
      libraryId: "12345",
      title: `pin-9-${mediaId}`,
      expires: 1_900_000_000,
      signature: `sig-${mediaId}`,
    };
  });
  vi.mocked(abortVideoUploadAction).mockResolvedValue({ ok: true });
  vi.mocked(syncVideoStatusAction).mockResolvedValue({ ok: true, display: "processing" });
});

describe("useMediaUploads · vídeos por TUS", () => {
  it("firma la subida, la manda a Bunny con las cabeceras de TUS y consulta el estado", async () => {
    const onDone = vi.fn();
    render(<Harness entries={[entry("v1", "VIDEO", "video/mp4")]} onDone={onDone} />);

    await userEvent.click(screen.getByRole("button", { name: "Subir" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith([]));

    expect(createVideoUploadAction).toHaveBeenCalledWith({
      pinId: 9,
      sizeBytes: 100,
      durationS: 40,
      mimeType: "video/mp4",
    });
    expect(tus.uploads).toHaveLength(1);
    const { options } = tus.uploads[0];
    expect(options.endpoint).toBe("https://video.bunnycdn.com/tusupload");
    expect(options.headers).toEqual({
      AuthorizationSignature: "sig-100",
      AuthorizationExpire: "1900000000",
      VideoId: "guid-100",
      LibraryId: "12345",
    });
    expect(options.metadata).toEqual({ filetype: "video/mp4", title: "pin-9-100" });
    expect(options.retryDelays).toEqual([0, 3000, 5000, 10000, 20000, 60000]);
    expect(options.removeFingerprintOnSuccess).toBe(true);
    expect(syncVideoStatusAction).toHaveBeenCalledWith(100);
    // Los vídeos nunca pasan por Storage ni por addMapMediaAction.
    expect(storageUpload).not.toHaveBeenCalled();
    expect(addMapMediaAction).not.toHaveBeenCalled();
  });

  it("muestra el progreso de la subida por fichero", async () => {
    let finish!: () => void;
    tus.onStart = (options) => {
      options.onProgress(42, 100);
      finish = options.onSuccess;
    };
    const onDone = vi.fn();
    render(<Harness entries={[entry("v1", "VIDEO", "video/mp4")]} onDone={onDone} />);

    await userEvent.click(screen.getByRole("button", { name: "Subir" }));
    expect(await screen.findByText("Subiendo 42 %")).toBeInTheDocument();

    await act(async () => finish());
    await waitFor(() => expect(onDone).toHaveBeenCalledWith([]));
    expect(screen.queryByText("Subiendo 42 %")).not.toBeInTheDocument();
  });

  it("un fallo de TUS cancela la fila y queda como error para reintentar", async () => {
    tus.onStart = (options) => options.onError(new Error("network"));
    const onDone = vi.fn();
    render(<Harness entries={[entry("v1", "VIDEO", "video/mp4")]} onDone={onDone} />);

    await userEvent.click(screen.getByRole("button", { name: "Subir" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());

    expect(abortVideoUploadAction).toHaveBeenCalledWith(100);
    expect(syncVideoStatusAction).not.toHaveBeenCalled();
    const failures = onDone.mock.calls[0][0] as UploadFailure[];
    expect(failures).toEqual([
      { clientId: "v1", name: "v1.mp4", msg: expect.stringContaining("No se ha podido subir el vídeo") },
    ]);
    expect(screen.getByText(/No se ha podido subir el vídeo/)).toBeInTheDocument();
  });

  it("si el servidor rechaza el vídeo, no se intenta TUS y se muestra su motivo", async () => {
    vi.mocked(createVideoUploadAction).mockResolvedValue({ ok: false, error: "El vídeo dura más de 60 s." });
    const onDone = vi.fn();
    render(<Harness entries={[entry("v1", "VIDEO", "video/mp4")]} onDone={onDone} />);

    await userEvent.click(screen.getByRole("button", { name: "Subir" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(tus.uploads).toHaveLength(0);
    expect(abortVideoUploadAction).not.toHaveBeenCalled();
    expect(screen.getByText("El vídeo dura más de 60 s.")).toBeInTheDocument();
  });

  it("los vídeos se suben en secuencia, no a la vez", async () => {
    const finishers: Array<() => void> = [];
    tus.onStart = (options) => finishers.push(options.onSuccess);
    const onDone = vi.fn();
    render(
      <Harness
        entries={[entry("v1", "VIDEO", "video/mp4"), entry("v2", "VIDEO", "video/mp4")]}
        onDone={onDone}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Subir" }));
    await waitFor(() => expect(tus.uploads).toHaveLength(1));
    // El segundo espera en cola mientras el primero no termine.
    expect(createVideoUploadAction).toHaveBeenCalledTimes(1);
    expect(screen.getByText("En cola")).toBeInTheDocument();

    await act(async () => finishers[0]());
    await waitFor(() => expect(tus.uploads).toHaveLength(2));
    expect(createVideoUploadAction).toHaveBeenCalledTimes(2);

    await act(async () => finishers[1]());
    await waitFor(() => expect(onDone).toHaveBeenCalledWith([]));
  });

  it("registra beforeunload mientras sube y lo libera al terminar", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    let finish!: () => void;
    tus.onStart = (options) => {
      finish = options.onSuccess;
    };
    const onDone = vi.fn();
    render(<Harness entries={[entry("v1", "VIDEO", "video/mp4")]} onDone={onDone} />);

    await userEvent.click(screen.getByRole("button", { name: "Subir" }));
    await waitFor(() => expect(add).toHaveBeenCalledWith("beforeunload", expect.any(Function)));
    const handler = add.mock.calls.find(([type]) => type === "beforeunload")![1];
    expect(remove).not.toHaveBeenCalledWith("beforeunload", handler);

    await act(async () => finish());
    await waitFor(() => expect(remove).toHaveBeenCalledWith("beforeunload", handler));
  });
});

describe("useMediaUploads · fotos", () => {
  it("las fotos siguen yendo a Storage y se registran con addMapMediaAction", async () => {
    const onDone = vi.fn();
    render(
      <Harness
        entries={[entry("p1", "PHOTO", "image/webp"), entry("v1", "VIDEO", "video/mp4")]}
        onDone={onDone}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Subir" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith([]));

    expect(storageUpload).toHaveBeenCalledTimes(1);
    expect(storageUpload.mock.calls[0][0]).toMatch(/^map-media\/9\/.+\.webp$/);
    expect(addMapMediaAction).toHaveBeenCalledWith(9, [
      expect.objectContaining({ type: "PHOTO", mimeType: "image/webp" }),
    ]);
    expect(createVideoUploadAction).toHaveBeenCalledTimes(1);
  });

  it("un fallo de Storage queda como error de esa foto", async () => {
    storageUpload.mockResolvedValue({ data: null, error: { message: "quota exceeded" } });
    const onDone = vi.fn();
    render(<Harness entries={[entry("p1", "PHOTO", "image/webp")]} onDone={onDone} />);

    await userEvent.click(screen.getByRole("button", { name: "Subir" }));
    await waitFor(() =>
      expect(onDone).toHaveBeenCalledWith([{ clientId: "p1", name: "p1.webp", msg: "quota exceeded" }]),
    );
    expect(addMapMediaAction).not.toHaveBeenCalled();
  });
});
