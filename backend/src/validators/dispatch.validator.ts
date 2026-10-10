import { z } from 'zod';

export const verifyDispatchSchema = z.object({
  orderItemId: z.string().min(1, 'Order item ID is required'),
  enteredBookCode: z.string().min(1, 'Book code cannot be empty'),
  requestId: z.string().optional(),
});
