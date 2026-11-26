import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import { getTimetableRepository } from "../storage/repository";
export type ThemeChoice = "system" | "light" | "dark";
const dark = {
  canvas: "#11162e",
  surface: "#222a4c",
  raised: "#2e3864",
  soft: "rgba(255,255,255,0.05)",
  text: "#f1f3ff",
  muted: "#b9c4e4",
  subtle: "#a6b2d5",
  link: "#b8c6ff",
  line: "#485477",
  onAccent: "#ffffff",
  navigation: "#1b2241",
  rose: "#e2a5b7",
  danger: "#fda4af",
  success: "#6ee7b7",
};
export type Palette = typeof dark;
const light: Palette = {
  canvas: "#edf0ff",
  surface: "#ffffff",
  raised: "#e0e6fc",
  soft: "#e9edfc",
  text: "#1c2445",
  muted: "#485479",
  subtle: "#526186",
  link: "#3548b3",
  line: "#cad3f0",
  onAccent: "#ffffff",
  navigation: "#ffffff",
  rose: "#943850",
  danger: "#a2223d",
  success: "#136b4b",
};
const Context = createContext({
  colors: dark,
  isDark: true,
  choice: "system" as ThemeChoice,
  setChoice: (_choice: ThemeChoice) => {},
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    getTimetableRepository()
      .getPreference("appearance")
      .then((value) => {
        if (active && ["system", "light", "dark"].includes(value ?? ""))
          setChoiceState(value as ThemeChoice);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const isDark = choice === "system" ? system !== "light" : choice === "dark";
  const value = useMemo(
    () => ({
      colors: isDark ? dark : light,
      isDark,
      choice,
      setChoice: (next: ThemeChoice) => {
        setChoiceState(next);
        void getTimetableRepository()
          .setPreference("appearance", next)
          .catch(() => {});
      },
    }),
    [choice, isDark],
  );
  return (
    <Context.Provider value={value}>{ready ? children : null}</Context.Provider>
  );
}
export const useTheme = () => useContext(Context);
export function useThemedStyles<T>(factory: (colors: Palette) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
