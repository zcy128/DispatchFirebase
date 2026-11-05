import {
  Award,
  Briefcase,
  Building2,
  DollarSign,
  Eye,
  GraduationCap,
  Radio,
  ShieldAlert,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { UserRole } from '../../types/employee';

export interface RoleTheme {
  color: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  icon: ComponentType<{ className?: string }>;
  tag: string;
}

export const ROLE_THEMES: Record<UserRole, RoleTheme> = {
  admin: {
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/30',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-300',
    icon: ShieldAlert,
    tag: 'Full Administrator',
  },
  manager: {
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-300',
    icon: Briefcase,
    tag: 'Executive Read-Only',
  },
  dispatcher: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    badgeBg: 'bg-blue-500/20',
    badgeText: 'text-blue-300',
    icon: Radio,
    tag: 'Operations & Routes',
  },
  supervisor: {
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    badgeBg: 'bg-cyan-500/20',
    badgeText: 'text-cyan-300',
    icon: Eye,
    tag: 'Yard Supervision',
  },
  'office staff': {
    color: 'text-slate-300',
    bgColor: 'bg-slate-700/30',
    borderColor: 'border-slate-600/40',
    badgeBg: 'bg-slate-700/50',
    badgeText: 'text-slate-200',
    icon: Building2,
    tag: 'Office Support',
  },
  studentcare: {
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    badgeBg: 'bg-violet-500/20',
    badgeText: 'text-violet-300',
    icon: GraduationCap,
    tag: 'Student Safety',
  },
  fleet: {
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    icon: Wrench,
    tag: 'Maintenance & Assets',
  },
  HR: {
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
    badgeBg: 'bg-pink-500/20',
    badgeText: 'text-pink-300',
    icon: Users,
    tag: 'Human Resources',
  },
  payroll: {
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/30',
    badgeBg: 'bg-teal-500/20',
    badgeText: 'text-teal-300',
    icon: DollarSign,
    tag: 'Compensation & Payroll',
  },
  training: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    icon: Award,
    tag: 'Safety & Recertification',
  },
  driver: {
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    icon: Truck,
    tag: 'Driver Mobile App',
  },
  helper: {
    color: 'text-lime-400',
    bgColor: 'bg-lime-500/10',
    borderColor: 'border-lime-500/30',
    badgeBg: 'bg-lime-500/20',
    badgeText: 'text-lime-300',
    icon: Users,
    tag: 'Bus Attendant / Helper',
  },
};
