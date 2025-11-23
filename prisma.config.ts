import "dotenv/config";

import { defineConfig, env } from "prisma/config";

import path from "node:path";

type Env = {
  DATABASE_URL: string;
};

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: 'tsx --env-file=.env prisma/seed.ts',
  },
  datasource: {
    url: env<Env>("DATABASE_URL"),
  },
});
