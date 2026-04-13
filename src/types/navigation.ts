import { LucideIcon } from 'lucide-react';

export interface Dot {
  x: number
  y: number
  size: number
  connectsTo?: number[]
}

export interface MenuItem {
  icon: LucideIcon
  label: string
  href?: string
  dots?: Dot[]
}

export interface Star {
  id: number
  x: number
  y: number
  size: number
  animationDelay: number
}