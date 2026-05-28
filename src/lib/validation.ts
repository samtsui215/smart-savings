/**
 * Zod schemas for every request body the API accepts.
 * Co-located so the validation rules are one search away from the routes.
 */
import { z } from "zod";

/**
 * Money input from clients is a dollar-string ("12.34" or "3,500.00") or a
 * number. We preprocess strings to strip any thousands-separator commas so
 * the user can paste back what we displayed.
 */
const MoneyInput = z.preprocess(
  (v) => (typeof v === "string" ? v.replace(/,/g, "") : v),
  z.union([
    z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Expected a dollar value like 12.34"),
    z.number().finite(),
  ]),
);

export const CategoryCreateBody = z.object({
  name: z.string().trim().min(1).max(60),
  targetAmount: MoneyInput.optional().nullable(),
  parentId: z.string().optional().nullable(),
});

export const CategoryUpdateBody = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  targetAmount: MoneyInput.nullable().optional(),
  // null = make root; string = move under that parent; undefined = no change
  parentId: z.string().nullable().optional(),
});

export const DepositBody = z.object({
  amount: MoneyInput,
  categoryId: z.string().optional(), // omit -> Unassigned bucket
  note: z.string().max(200).optional(),
});

export const WithdrawBody = z.object({
  amount: MoneyInput,
  categoryId: z.string(),
  note: z.string().max(200).optional(),
});

export const TransferBody = z
  .object({
    amount: MoneyInput,
    fromCategoryId: z.string(),
    toCategoryId: z.string(),
    note: z.string().max(200).optional(),
  })
  .refine((d) => d.fromCategoryId !== d.toCategoryId, {
    message: "Source and target categories must differ",
    path: ["toCategoryId"],
  });

export const AffordBody = z.object({
  amount: MoneyInput,
});

/**
 * Reorder body — caller sends the FULL ordered list of ids in a single
 * sibling group. We assign positions 0..N based on the array index, so
 * client-side `arrayMove` translates directly into persistent order.
 */
export const ReorderBody = z.object({
  parentId: z.string().nullable(),
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});
