import { z } from 'zod';

export const verifyDispatchSchema = z
  .object({
    orderItemId: z.string().optional(),
    orderId: z.string().optional(),
    enteredBookCode: z.string().min(1, 'Book code cannot be empty'),
    requestId: z.string().optional(),
  })
  .refine((data) => data.orderItemId || data.orderId, {
    message: 'Either orderItemId or orderId must be provided',
  });
