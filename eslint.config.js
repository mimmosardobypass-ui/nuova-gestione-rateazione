import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": "off",
      "no-restricted-syntax": [
        "error",
        {
          "selector": "CallExpression[callee.name='parseInt'] MemberExpression[property.name=/.*[Ii]d$/]",
          "message": "Usa toIntId() per convertire ID numerici invece di parseInt()."
        },
        {
          "selector": "CallExpression[callee.name='parseInt'][arguments.0.name=/.*[Ii]d$/]",
          "message": "Usa toIntId() per convertire ID numerici invece di parseInt()."
        },
        {
          "selector": "CallExpression[callee.property.name='toISOString'] MemberExpression[property.name='slice']",
          "message": "Non usare toISOString().slice(0,10). Usa toLocalISO()/toISODateLocal per evitare problemi di timezone."
        },
        {
          "selector": "NewExpression[callee.name='Date'][arguments.0.type='Literal'][arguments.0.value=/^\\d{4}-\\d{2}-\\d{2}$/]",
          "message": "Evita new Date(\"YYYY-MM-DD\"). Manipola stringhe ISO con addMonthsISO/setDayISO o usa toLocalISO per serializzare."
        },
        {
          "selector": "CallExpression[callee.name='format'][arguments.1.type='Literal'][arguments.1.value='yyyy-MM-dd']",
          "message": "Non usare format(date, 'yyyy-MM-dd'). Usa toLocalISO(date) per evitare problemi di timezone."
        }
      ],
    },
  }
);
