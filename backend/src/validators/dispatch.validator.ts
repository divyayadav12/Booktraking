import { z } from 'zod';

export const verifyDispatchSchema = z
  .object({
    orderItemId: z.string().optional(),
    orderId: z.string().optional(),
    enteredBookCode: z.string().optional(),
    enteredCode: z.string().optional(),
    requestId: z.string().optional(),
  })
  .refine((data) => !!(data.enteredCode || data.enteredBookCode), {
    message: 'Either enteredCode or enteredBookCode must be provided',
  });
