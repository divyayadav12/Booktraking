import { z } from 'zod';

export const createEmployeeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const updateEmployeeStatusSchema = z.object({
  isActive: z.boolean(),
});
