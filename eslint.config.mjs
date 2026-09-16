import eslintConfigNext from "eslint-config-next";

export default [
  ...eslintConfigNext,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      // Deshabilitar reglas React 19 estrictas sobre setState en effects y refs
      // Estos patrones funcionan correctamente en React 18
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
    },
  },
];
