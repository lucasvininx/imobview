"use client";
import { createContext, useContext, useState } from "react";
import { Moon, Sun } from "lucide-react";
const ThemeContext = createContext<{
  theme: "light" | "dark";
  toggle: () => void;
}>({ theme: "light", toggle: () => {} });
export function ThemeProvider({
  initial,
  children,
}: {
  initial: "light" | "dark";
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState(initial);
  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.cookie = `imobview-theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setTheme(next);
  }
  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function ThemeToggle() {
  const { theme, toggle } = useContext(ThemeContext);
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={
        theme === "light" ? "Ativar modo escuro" : "Ativar modo claro"
      }
      title={theme === "light" ? "Modo escuro" : "Modo claro"}
    >
      {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
