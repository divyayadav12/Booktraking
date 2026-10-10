import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { createEmployeeSchema, updateEmployeeStatusSchema } from '../validators/employee.validator';
import * as employeeService from '../services/employee.service';
import { successResponse, errorResponse } from '../utils/response';

export async function getEmployees(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const employees = await employeeService.listEmployees();
    return successResponse(res, 'Employees retrieved', employees);
  } catch (error) {
    next(error);
  }
}

export async function createEmployee(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const validated = createEmployeeSchema.parse(req.body);
    const employee = await employeeService.createEmployee(validated, req.user.id);
    return successResponse(res, 'Employee account created successfully', employee, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { id } = req.params;
    const validated = updateEmployeeStatusSchema.parse(req.body);

    const updated = await employeeService.updateEmployeeStatus(id, validated.isActive, req.user.id);
    return successResponse(
      res,
      `Employee account ${validated.isActive ? 'activated' : 'deactivated'} successfully`,
      updated
    );
  } catch (error) {
    next(error);
  }
}
