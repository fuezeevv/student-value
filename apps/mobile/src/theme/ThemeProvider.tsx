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
  canvas: "#0b1322",
  surface: "#16253d",
  raised: "#1c2b43",
  soft: "rgba(255,255,255,0.05)",
  text: "#f1f5f9",
  muted: "#a8b5c9",
  subtle: "#94a3b8",
  link: "#9ac4ff",
  line: "#344052",
  onAccent: "#ffffff",
  navigation: "#101b2e",
  rose: "#e2a5b7",
  danger: "#fda4af",
  success: "#6ee7b7",
};
export type Palette = typeof dark;
const light: Palette = {
  canvas: "#f3f5f9",
  surface: "#ffffff",
  raised: "#e6ecf5",
  soft: "#e9edf4",
  text: "#182438",
  muted: "#47566d",
  subtle: "#59687d",
  link: "#164fa6",
  line: "#c7d1df",
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
