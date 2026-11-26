import React from "react";
import { FlowTimetableScreen } from "./src/screens/FlowTimetableScreen";

import { ThemeProvider } from "./src/theme/ThemeProvider";

export default function App() {
  return (
    <ThemeProvider>
      <FlowTimetableScreen />
    </ThemeProvider>
  );
}
