// lib/validations/security.ts

import { z } from "zod";

export const userSchema = z.object({
  id: z.string().nullable().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
  roleId: z.number({ required_error: "Role is required" }),
  tenantId: z.string().nullable().optional(),
}).refine((data) => {
  // If creating (no ID), password is required
  if (!data.id && (!data.password || data.password.length < 8)) {
    return false;
  }
  return true;
}, {
  message: "Password is required for new users",
  path: ["password"],
});

export const roleSchema = z.object({
  id: z.number().nullable().optional(),
  name: z.string().min(2, "Role name must be at least 2 characters"),
  key: z.string().regex(/^[a-z0-9_]+$/, "Key must be lowercase snake_case"),
  permissionIds: z.array(z.number()),
  tenantId: z.string().nullable().optional(),
});

export const permissionSchema = z.object({
  id: z.number().nullable().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  key: z.string().regex(/^[a-z0-9_]+$/, "Key must be lowercase snake_case"),
  tenantId: z.string().nullable().optional(),
});