import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

/**
 * Native React Hook Form resolver for Zod v4 (zod@4.6.x).
 * Avoids @hookform/resolvers v3 mismatch where Zod v4 issues throw uncaught ZodError.
 */
export function createZodFormResolver<T extends FieldValues>(
  schema: z.ZodType<T>
): Resolver<T> {
  return async (values) => {
    const parsed = await schema.safeParseAsync(values);
    if (parsed.success) {
      return {
        values: parsed.data,
        errors: {},
      };
    }

    const fieldErrors: Record<string, unknown> = {};
    for (const issue of parsed.error.issues) {
      const pathKey = issue.path.map(String).join(".");
      if (!pathKey) continue;

      const segments = issue.path.map(String);
      let cursor: Record<string, unknown> = fieldErrors;
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        if (!cursor[seg] || typeof cursor[seg] !== "object") {
          cursor[seg] = {};
        }
        cursor = cursor[seg] as Record<string, unknown>;
      }
      const leaf = segments[segments.length - 1];
      if (!cursor[leaf]) {
        cursor[leaf] = {
          type: issue.code,
          message: issue.message,
        };
      }
    }

    return {
      values: {} as Record<string, never>,
      errors: fieldErrors as FieldErrors<T>,
    };
  };
}

