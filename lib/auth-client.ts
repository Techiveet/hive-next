// lib/auth-client.ts
"use client";

import { createAuthClient } from "better-auth/react";

// No baseURL => use same-origin /api/auth/... endpoints
export const authClient = createAuthClient();
