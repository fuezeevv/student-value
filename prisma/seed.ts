import { PrismaClient } from "@prisma/client";
import { bootstrap } from "./bootstrap";
const p = new PrismaClient();
bootstrap(p)
  .then(() =>
    console.log(
      "Create-only academic bootstrap complete; no demo accounts or progress changes.",
    ),
  )
  .finally(() => p.$disconnect());
