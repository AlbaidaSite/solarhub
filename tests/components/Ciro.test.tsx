// @vitest-environment jsdom
// SUT: src/components/ciro/Ciro.tsx
//
// jsdom no implementa matchMedia, no devuelve rects reales y no trae la
// clase AnimationEvent, así que las tres cosas se suplen aquí. El valor
// concreto de ojo.style.translate tras mover el ratón o enfocar un campo no
// se testea (depende de rAF + la interpolación): lo que se comprueba es el
// cableado (qué listeners hay y si el bucle se despierta). La aritmética ya
// está cubierta por los unitarios de geometria.test.ts.

import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import Ciro from "@/components/ciro/Ciro";
import { AMPLITUD_LATIDO, cqw, G } from "@/components/ciro/geometria";

type Entorno = {
  ancho?: boolean; // (min-width: 768px)
  punteroFino?: boolean; // (pointer: fine)
  reduceMotion?: boolean; // (prefers-reduced-motion: reduce)
};

function stubMatchMedia({ ancho = true, punteroFino = true, reduceMotion = false }: Entorno) {
  vi.stubGlobal("matchMedia", (query: string) => {
    const matches = query.includes("prefers-reduced-motion")
      ? reduceMotion
      : query.includes("pointer: fine")
        ? punteroFino
        : ancho;
    return {
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  });
}

// Rects distintos para cuenca y ojo — si fueran iguales, tope saldría 0 y el
// ojo no tendría recorrido que animar. Centro de la cuenca en (500, 300).
function stubRects() {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
    this: Element,
  ) {
    const esCuenca = !!this.querySelector('img[src$="fondo.svg"]');
    const esOjo = !!this.querySelector('img[src$="ojo.svg"]');
    const lado = esCuenca ? 100 : esOjo ? 40 : 10;
    // Los campos de prueba se colocan con data-x para fijar de qué lado del
    // ojo caen; el resto de elementos no participan en la medición.
    const cx = Number((this as HTMLElement).dataset?.x ?? 500);
    return {
      x: cx - lado / 2,
      y: 300 - lado / 2,
      left: cx - lado / 2,
      top: 300 - lado / 2,
      right: cx + lado / 2,
      bottom: 300 + lado / 2,
      width: lado,
      height: lado,
      toJSON() {},
    } as DOMRect;
  });
}

function ojoDeDom(container: HTMLElement) {
  return (container.querySelector('img[src$="ojo.svg"]') as HTMLElement).parentElement!;
}

// jsdom no define AnimationEvent, así que fireEvent.animationEnd acabaría
// mandando un Event pelado y sin `animationName` — justo el dato que mira el
// componente para saber si el que ha terminado es el fogonazo.
class AnimationEventStub extends Event {
  animationName: string;
  constructor(type: string, init: AnimationEventInit = {}) {
    super(type, init);
    this.animationName = init.animationName ?? "";
  }
}

beforeEach(() => {
  stubRects();
  vi.stubGlobal("AnimationEvent", AnimationEventStub);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Ciro · estructura", () => {
  it("renderiza 11 <img> (8 llamas + fondo + ojo + cara), todos con alt vacío", () => {
    stubMatchMedia({ ancho: false });
    const { container } = render(<Ciro />);
    const imgs = container.querySelectorAll("img");
    expect(imgs).toHaveLength(11);
    imgs.forEach((img) => expect(img.getAttribute("alt")).toBe(""));
  });

  it("el contenedor es aria-hidden y no intercepta clics", () => {
    stubMatchMedia({ ancho: false });
    const { container } = render(<Ciro />);
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root.className).toContain("pointer-events-none");
  });

  it("el ancho está acotado por size pero encoge con la ventana", () => {
    stubMatchMedia({ ancho: false });
    const { container } = render(<Ciro size={400} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--ciro-lado")).toBe(
      "min(400px, calc(50vw - 200px), 60vh)",
    );
    expect(root.className).toContain("ciro-raiz");
  });

  it("las piezas se miden en cqw, así que escalan solas con el contenedor", () => {
    stubMatchMedia({ ancho: false });
    const { container } = render(<Ciro size={400} />);
    const cara = container.querySelector('img[src$="cara.svg"]') as HTMLElement;
    expect(cara.style.width).toBe(cqw(G.cara));
  });
});

describe("Ciro · activación condicional del seguimiento", () => {
  it("con (pointer: fine) y sin reduced-motion, registra pointermove en window", () => {
    stubMatchMedia({});
    const addSpy = vi.spyOn(window, "addEventListener");
    render(<Ciro />);
    expect(addSpy).toHaveBeenCalledWith("pointermove", expect.any(Function), { passive: true });
  });

  it("con (pointer: coarse), no registra ningún pointermove", () => {
    stubMatchMedia({ punteroFino: false });
    const addSpy = vi.spyOn(window, "addEventListener");
    render(<Ciro />);
    expect(addSpy).not.toHaveBeenCalledWith("pointermove", expect.any(Function), expect.anything());
  });

  it("por debajo del breakpoint no se registra ningún pointermove", () => {
    stubMatchMedia({ ancho: false });
    const addSpy = vi.spyOn(window, "addEventListener");
    render(<Ciro />);
    expect(addSpy).not.toHaveBeenCalledWith("pointermove", expect.any(Function), expect.anything());
  });

  it("con prefers-reduced-motion: reduce, no registra ningún pointermove", () => {
    stubMatchMedia({ reduceMotion: true });
    const addSpy = vi.spyOn(window, "addEventListener");
    render(<Ciro />);
    expect(addSpy).not.toHaveBeenCalledWith("pointermove", expect.any(Function), expect.anything());
  });

  it("al desmontar, retira todos los listeners y limpia ojo.style.translate", () => {
    stubMatchMedia({});
    const winRemove = vi.spyOn(window, "removeEventListener");
    const docRemove = vi.spyOn(document, "removeEventListener");
    const rootRemove = vi.spyOn(document.documentElement, "removeEventListener");

    const { container, unmount } = render(<Ciro />);
    const ojo = ojoDeDom(container);
    ojo.style.translate = "5px 5px";

    unmount();

    expect(winRemove).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(winRemove).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(winRemove).toHaveBeenCalledWith("scroll", expect.any(Function));
    expect(rootRemove).toHaveBeenCalledWith("pointerleave", expect.any(Function));
    expect(docRemove).toHaveBeenCalledWith("focusin", expect.any(Function));
    expect(docRemove).toHaveBeenCalledWith("focusout", expect.any(Function));
    expect(ojo.style.translate).toBe("");
  });
});

describe("Ciro · aparta la vista del campo de contraseña", () => {
  // El campo va fuera de Ciro a propósito: el componente escucha focusin en
  // `document`, sin que los formularios tengan que saber que existe.
  function renderConCampos() {
    return render(
      <>
        <input type="password" autoComplete="current-password" data-x="200" data-testid="pw-izq" />
        <input type="text" autoComplete="username" data-x="200" data-testid="usuario" />
        <Ciro />
      </>,
    );
  }

  it("al enfocar una contraseña, el ojo arranca su animación", () => {
    stubMatchMedia({});
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const { getByTestId } = renderConCampos();
    expect(raf).not.toHaveBeenCalled();

    getByTestId("pw-izq").focus();
    expect(raf).toHaveBeenCalled();
  });

  it("un campo que no es de contraseña deja el ojo quieto", () => {
    stubMatchMedia({});
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const { getByTestId } = renderConCampos();

    getByTestId("usuario").focus();
    expect(raf).not.toHaveBeenCalled();
  });

  it("sigue apartando la vista con la contraseña revelada (type=text + autocomplete)", () => {
    stubMatchMedia({});
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const { getByTestId } = render(
      <>
        <input type="text" autoComplete="new-password" data-x="800" data-testid="pw-visible" />
        <Ciro />
      </>,
    );

    getByTestId("pw-visible").focus();
    expect(raf).toHaveBeenCalled();
  });

  it("con puntero grueso también aparta la vista, aunque no siga al cursor", () => {
    stubMatchMedia({ punteroFino: false });
    const raf = vi.spyOn(window, "requestAnimationFrame");
    const { getByTestId } = renderConCampos();

    getByTestId("pw-izq").focus();
    expect(raf).toHaveBeenCalled();
  });
});

describe("Ciro · latido", () => {
  it("amplitud y duración viven en el contenedor, en unidades relativas", () => {
    stubMatchMedia({ ancho: false });
    const { container } = render(<Ciro size={400} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue("--ciro-amp")).toBe(cqw(AMPLITUD_LATIDO));
    expect(root.style.getPropertyValue("--ciro-dur")).not.toBe("");
  });

  it("las ocho llamas comparten ciclo: ninguna lleva duración ni retardo propios", () => {
    stubMatchMedia({ ancho: false });
    const { container } = render(<Ciro />);
    const latidos = container.querySelectorAll<HTMLElement>(".ciro-latido");
    expect(latidos).toHaveLength(8);

    latidos.forEach((el) => {
      expect(el.style.getPropertyValue("--ciro-dur")).toBe("");
      expect(el.style.getPropertyValue("--ciro-delay")).toBe("");
      expect(el.style.animationDelay).toBe("");
    });
  });

  it("las cortas van en contrafase y las largas no", () => {
    stubMatchMedia({ ancho: false });
    const { container } = render(<Ciro />);

    const contra = container.querySelectorAll(".ciro-latido-contra");
    expect(contra).toHaveLength(4);

    // Cada span en contrafase envuelve una llama corta, y ninguna larga.
    contra.forEach((el) => {
      expect(el.querySelector('img[src$="corto.svg"]')).not.toBeNull();
    });

    const largos = container.querySelectorAll('img[src$="largo.svg"]');
    expect(largos).toHaveLength(4);
    largos.forEach((img) => {
      expect(img.parentElement).not.toHaveClass("ciro-latido-contra");
    });
  });
});

describe("Ciro · fogonazo al hacer clic", () => {
  function caraDe(container: HTMLElement) {
    return container.querySelector('img[src$="cara.svg"]') as HTMLElement;
  }

  it("la cara recupera los clics aunque el contenedor no los intercepte", () => {
    stubMatchMedia({});
    const { container } = render(<Ciro />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain("pointer-events-none");
    expect(caraDe(container).className).toContain("pointer-events-auto");
  });

  it("al hacer clic en la cara, el contenedor entra en fogonazo", () => {
    stubMatchMedia({});
    const { container } = render(<Ciro />);
    const root = container.firstElementChild as HTMLElement;

    expect(root).not.toHaveClass("ciro-fogonazo");
    fireEvent.click(caraDe(container));
    expect(root).toHaveClass("ciro-fogonazo");
  });

  it("al acabar la animación se retira la clase, y el latido base sigue intacto", () => {
    stubMatchMedia({});
    const { container } = render(<Ciro />);
    const root = container.firstElementChild as HTMLElement;

    fireEvent.click(caraDe(container));
    fireEvent.animationEnd(root, { animationName: "ciro-fogonazo" });

    expect(root).not.toHaveClass("ciro-fogonazo");
    expect(container.querySelectorAll(".ciro-latido")).toHaveLength(8);
  });

  it("otra animación que termine no cancela el fogonazo", () => {
    stubMatchMedia({});
    const { container } = render(<Ciro />);
    const root = container.firstElementChild as HTMLElement;

    fireEvent.click(caraDe(container));
    fireEvent.animationEnd(root, { animationName: "otra-cosa" });

    expect(root).toHaveClass("ciro-fogonazo");
  });

  it("con reduced-motion, el clic no dispara nada", () => {
    stubMatchMedia({ reduceMotion: true });
    const { container } = render(<Ciro />);
    const root = container.firstElementChild as HTMLElement;

    fireEvent.click(caraDe(container));
    expect(root).not.toHaveClass("ciro-fogonazo");
  });
});
