import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProblemException } from './problem.exception.js';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

export const AdminGuard = () =>
  applyDecorators(UseGuards(AuthGuardClass), Roles('ADMIN'));
export const LectorOAdminGuard = () =>
  applyDecorators(UseGuards(AuthGuardClass), Roles('LECTOR_O_ADMIN'));

@Injectable()
export class AuthGuardClass implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    if (!roles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ProblemException(
        401,
        'NO_AUTENTICADO',
        'No autenticado',
        'Token de bearer requerido',
      );
    }

    const token = authHeader.substring(7).trim();
    const adminToken = process.env.LAB_ADMIN_TOKEN;
    const readerToken = process.env.LAB_READER_TOKEN;

    let isAdmin = false;
    let isReader = false;

    if (adminToken && token === adminToken) {
      isAdmin = true;
    }
    if (readerToken && token === readerToken) {
      isReader = true;
    }

    if (!isAdmin && !isReader) {
      throw new ProblemException(
        401,
        'NO_AUTENTICADO',
        'No autenticado',
        'Token inválido',
      );
    }

    if (roles.includes('ADMIN') && !isAdmin) {
      throw new ProblemException(
        403,
        'NO_AUTORIZADO',
        'No autorizado',
        'Se requiere rol ADMIN',
      );
    }

    return true;
  }
}