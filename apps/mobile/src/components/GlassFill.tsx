import { GradientFill } from "./GradientFill";

export function GlassFill({ dark = false }: { dark?: boolean }) {
  return (
    <GradientFill
      diagonal
      stops={[
        { offset: 0, color: dark ? "#303e70" : "#e2e8ff", opacity: 0.88 },
        { offset: 1, color: dark ? "#171d38" : "#fbfcff", opacity: 0.95 },
      ]}
    />
  );
}
