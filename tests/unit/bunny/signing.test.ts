// SUT: src/lib/bunny/signing.ts
// Firmas de Bunny Stream con vectores fijos (calculados con una
// implementación independiente del algoritmo de Bunny) y los casos en que
// la verificación del webhook debe fallar sin lanzar.

import { describe, it, expect } from "vitest";
import {
  buildEmbedUrl,
  buildThumbnailUrl,
  signEmbedToken,
  signTusUpload,
  verifyWebhookSignature,
} from "@/lib/bunny/signing";

const WEBHOOK_SECRET = "test-readonly-key";
const WEBHOOK_BODY =
  '{"VideoLibraryId":12345,"VideoGuid":"32d140e2-e4f4-4eec-9d53-20371e9be607","Status":3}';
const WEBHOOK_SIGNATURE = "b84153c5c7b23d56834806aeb92ab7a174b89e6e77b751d0db8a23cb701e52a4";

function verify(overrides: Partial<Parameters<typeof verifyWebhookSignature>[0]> = {}) {
  return verifyWebhookSignature({
    rawBody: WEBHOOK_BODY,
    signature: WEBHOOK_SIGNATURE,
    version: "v1",
    algorithm: "hmac-sha256",
    secret: WEBHOOK_SECRET,
    ...overrides,
  });
}

describe("signEmbedToken", () => {
  it("sha256_hex(tokenKey + videoId + expires)", () => {
    expect(signEmbedToken({ tokenKey: "mysecretkey", videoId: "abc-123", expires: 1700000000 })).toBe(
      "54ce9c375a5def073eb128910d013c1f5ae5385fae501af7e807fe4f8de927f4",
    );
  });
});

describe("signTusUpload", () => {
  it("sha256_hex(libraryId + apiKey + expires + videoId)", () => {
    expect(
      signTusUpload({
        libraryId: "12345",
        apiKey: "test-api-key",
        expires: 1700086400,
        videoId: "32d140e2-e4f4-4eec-9d53-20371e9be607",
      }),
    ).toBe("697d5f98506d9d1c6f218cf0166922a2c53c05aeb2a724a405fcfc5a898ed8f9");
  });
});

describe("verifyWebhookSignature", () => {
  it("acepta la firma correcta del cuerpo exacto", () => {
    expect(verify()).toBe(true);
  });

  it.each([
    ["versión distinta de v1", { version: "v2" }],
    ["algoritmo distinto de hmac-sha256", { algorithm: "hmac-sha1" }],
    ["firma en mayúsculas", { signature: WEBHOOK_SIGNATURE.toUpperCase() }],
    ["firma de otra longitud", { signature: WEBHOOK_SIGNATURE.slice(0, 62) }],
    ["firma con caracteres no hex", { signature: `${WEBHOOK_SIGNATURE.slice(0, 63)}g` }],
    ["cabecera de firma ausente", { signature: null }],
    ["cabecera de versión ausente", { version: null }],
    ["cabecera de algoritmo ausente", { algorithm: null }],
    ["body con un byte alterado", { rawBody: WEBHOOK_BODY.replace('"Status":3', '"Status":4') }],
    ["body re-serializado con espacios", { rawBody: JSON.stringify(JSON.parse(WEBHOOK_BODY), null, 1) }],
    ["secreto equivocado", { secret: "otra-clave" }],
  ])("%s → false sin lanzar", (_label, overrides) => {
    expect(() => verify(overrides)).not.toThrow();
    expect(verify(overrides)).toBe(false);
  });
});

describe("builders de URL", () => {
  it("buildEmbedUrl: library, vídeo, token, expires y parámetros extra", () => {
    expect(
      buildEmbedUrl({
        libraryId: "12345",
        videoId: "abc-123",
        token: "tok",
        expires: 1700000000,
        params: { autoplay: true, preload: true, playsinline: true },
      }),
    ).toBe(
      "https://player.mediadelivery.net/embed/12345/abc-123?token=tok&expires=1700000000&autoplay=true&preload=true&playsinline=true",
    );
  });

  it("buildEmbedUrl sin parámetros extra", () => {
    expect(buildEmbedUrl({ libraryId: "1", videoId: "v", token: "t", expires: 2 })).toBe(
      "https://player.mediadelivery.net/embed/1/v?token=t&expires=2",
    );
  });

  it("buildThumbnailUrl", () => {
    expect(buildThumbnailUrl("vz-abc.b-cdn.net", "abc-123")).toBe(
      "https://vz-abc.b-cdn.net/abc-123/thumbnail.jpg",
    );
  });
});
