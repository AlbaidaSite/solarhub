// eslint-config-next 16 ya se publica como flat config (un array de
// objetos con `plugins`, `languageOptions`, `ignores`…). Se importa
// directamente.
//
// Antes esto pasaba por `FlatCompat.extends("next/core-web-vitals",
// "next/typescript")`, que es el puente para configs con formato .eslintrc
// antiguo -- lo que generaba create-next-app en tiempos de Next 15. Al
// subir a Next 16 ese puente se quedó metiendo un array flat por la
// tubería de eslintrc: la validación de esquema falla y, al intentar
// serializar el error, choca con las referencias circulares de los
// plugins. De ahí el "TypeError: Converting circular structure to JSON"
// que reventaba ESLint entero antes de mirar un solo archivo.
//
// core-web-vitals ya incluye la config base de Next (hace spread de su
// index), así que no hay que añadirla aparte.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // El repo ya marca con guion bajo lo que no se usa a propósito
    // (`_plantId`, `_idSlug`, `_currentUserId`…): handlers que tienen que
    // respetar una firma, o props que se desestructuran solo para
    // excluirlas de un objeto. La regla de eslint-config-next no conoce
    // esa convención y los reportaba igual, escondiendo los que sí son
    // olvidos de verdad.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    // Las tres últimas ya vienen en los ignores de eslint-config-next; se
    // repiten aquí para no depender de que siga siendo así.
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
