// lib/validations/security.ts

import { z } from "zod";

export const userSchema = z
  .object({
    id: z.string().nullable().optional(),
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .optional()
      .or(z.literal(""))
      .nullable(),
    // ✅ FIX: Remove the { required_error } object to satisfy the compiler.
    // Use z.coerce.number() if this field comes from a form input string.
    roleId: z.number(), 
    tenantId: z.string().nullable().optional(),
    avatarUrl: z
      .string()
      .url("Avatar must be a valid URL")
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    // ... keep your existing logic
    const isCreate = !data.id;
    const pwd = data.password ?? "";

    if (isCreate) {
      if (!pwd || pwd.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password is required for new users and must be at least 8 characters",
          path: ["password"],
        });
      }
    } else {
      if (pwd && pwd.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Password must be at least 8 characters",
          path: ["password"],
        });
      }
    }
  });

// ... keep roleSchema and permissionSchema as is
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