import mongoose from 'mongoose';
import { RoleType } from '../models/User';

export interface AuthUser {
  id: string;
  email: string;
  roles: RoleType[];
}

export const isAdmin = (user?: AuthUser): boolean => {
  return !!user?.roles.includes('admin');
};

export const isSeller = (user?: AuthUser): boolean => {
  return !!user?.roles.some(role => ['vendor', 'wholesaler', 'manufacturer'].includes(role));
};

export const isCustomer = (user?: AuthUser): boolean => {
  return !!user?.roles.includes('customer');
};

export const sameObjectId = (a: any, b: any): boolean => {
  if (!a || !b) return false;
  return a.toString() === b.toString();
};

export const requireSelfOrAdmin = (req: any, targetId: string): boolean => {
  const authUser = req.user;
  if (!authUser) return false;
  if (authUser.roles?.includes('admin')) return true;
  if (authUser.id && targetId && authUser.id.toString() === targetId.toString()) return true;
  if (authUser.roles?.some((r: string) => ['vendor', 'wholesaler', 'manufacturer', 'seller', 'delivery_partner'].includes(r))) return true;
  return false;
};

