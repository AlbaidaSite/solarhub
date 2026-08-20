import type { KeyboardEvent } from "react";

// Bloquea el "implicit submission" del navegador: pulsar Enter dentro de un
// input envía el formulario aunque no se haya tocado el botón de guardar, y
// en formularios largos (evento, pin, cromo…) eso acaba creando o guardando
// por accidente mientras se rellenan los campos. Con esto, guardar exige
// siempre pulsar el botón.
//
// Se deja pasar Enter cuando el foco está en algo que lo usa para otra cosa:
//   - textarea → salto de línea
//   - button / input de tipo botón → activar ese botón (incluido el submit,
//     así que el teclado sigue pudiendo guardar de forma explícita)
//   - enlaces y elementos con role="button" (zonas de drop, iconos) →
//     su propia activación por teclado
//   - contenido editable → escritura normal
// Durante una composición IME (isComposing) Enter confirma el texto: el
// navegador ya no lo trata como submit, pero se filtra igualmente para no
// interferir.
export function preventEnterSubmit(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key !== "Enter") return;
  if (e.nativeEvent.isComposing) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return;
  if (target.isContentEditable) return;
  if (target.getAttribute("role") === "button") return;
  if (
    target instanceof HTMLInputElement &&
    (target.type === "submit" || target.type === "button" || target.type === "reset")
  ) {
    return;
  }

  e.preventDefault();
}
