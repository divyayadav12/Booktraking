import bcrypt from 'bcryptjs';
import { User, DispatchLog, VerificationAttempt } from '../models';
import { logAudit } from '../utils/audit';

export async function listEmployees() {
  const employees = await User.find({ role: 'EMPLOYEE' }).sort({ createdAt: -1 });

  return await Promise.all(
    employees.map(async (emp) => {
      const [dispatchesCount, attemptsCount] = await Promise.all([
        DispatchLog.countDocuments({ employeeId: emp._id, result: 'SUCCESS' }),
        VerificationAttempt.countDocuments({ employeeId: emp._id }),
      ]);

      return {
        id: emp._id.toString(),
        name: emp.name,
        email: emp.email,
        role: emp.role,
        isActive: emp.isActive,
        createdAt: emp.createdAt,
        updatedAt: emp.updatedAt,
        _count: {
          dispatchLogs: dispatchesCount,
          verificationAttempts: attemptsCount,
        },
      };
    })
  );
}

export async function createEmployee(data: { name: string; email: string; password: string }, adminId: string) {
  const normalizedEmail = data.email.trim().toLowerCase();
  
  const existing = await User.findOne({ email: normalizedEmail });

  if (existing) {
    throw { statusCode: 400, message: 'User with this email already exists', code: 'EMAIL_EXISTS' };
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const employee = await User.create({
    name: data.name.trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'EMPLOYEE',
    isActive: true,
  });

  await logAudit({
    actorUserId: adminId,
    action: 'EMPLOYEE_CREATED',
    entityType: 'User',
    entityId: employee._id.toString(),
    metadata: { name: employee.name, email: employee.email },
  });

  return {
    id: employee._id.toString(),
    name: employee.name,
    email: employee.email,
    role: employee.role,
    isActive: employee.isActive,
    createdAt: employee.createdAt,
  };
}

export async function updateEmployeeStatus(employeeId: string, isActive: boolean, adminId: string) {
  const employee = await User.findById(employeeId);

  if (!employee) {
    throw { statusCode: 404, message: 'Employee not found', code: 'EMPLOYEE_NOT_FOUND' };
  }

  if (employee.role === 'ADMIN') {
    throw { statusCode: 400, message: 'Cannot deactivate an Administrator account from employee management', code: 'CANNOT_MODIFY_ADMIN' };
  }

  employee.isActive = isActive;
  await employee.save();

  await logAudit({
    actorUserId: adminId,
    action: isActive ? 'EMPLOYEE_ACTIVATED' : 'EMPLOYEE_DEACTIVATED',
    entityType: 'User',
    entityId: employee._id.toString(),
    metadata: { email: employee.email, isActive },
  });

  return {
    id: employee._id.toString(),
    name: employee.name,
    email: employee.email,
    role: employee.role,
    isActive: employee.isActive,
    updatedAt: employee.updatedAt,
  };
}
