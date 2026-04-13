import { GalleryHorizontalEnd, Earth, User, Fence, Calendar } from 'lucide-react';
import type { MenuItem } from '../types/navigation';

export const MENU_ITEMS: MenuItem[] = [
  {
    icon: GalleryHorizontalEnd,
    label: 'Cromos',
    href: '/cromos',
    dots: [
      { x: -3, y: -20, size: 4, connectsTo: [1, 3] },
      { x: 20, y: -20, size: 3, connectsTo: [2] },
      { x: 20, y: 20, size: 5, connectsTo: [3] },
      { x: -3, y: 20, size: 3.5 },
      { x: -15, y: -10, size: 4.5, connectsTo: [5] },
      { x: -15, y: 10, size: 3 },
    ],
  },
  {
    icon: Earth,
    label: 'Mapa',
    href: '/mapa',
    dots: [
      { x: -13, y: -20, size: 3.5, connectsTo: [1,5] },
      { x: 13, y: -20, size: 4, connectsTo: [2] },
      { x: 23, y: 0, size: 3, connectsTo: [3] },
      { x: 13, y: 20, size: 4.5, connectsTo: [4] },
      { x: -13, y: 20, size: 5, connectsTo: [5] },
      { x: -23, y: 0, size: 3.5 },
    ],
  },
  {
    icon: User,
    label: 'Perfil',
    href: '/perfil',
    dots: [
      { x: 0, y: -20, size: 4.5, connectsTo: [1,3] },
      { x: 10, y: -10, size: 3 },
      { x: 0, y: 0, size: 3.5, connectsTo: [1,3] },
      { x: -10, y: -10, size: 3 },
      { x: 0, y: 7, size: 4, connectsTo: [5,8] },
      { x: 15, y: 10, size: 5 },
      { x: 15, y: 20, size: 3.5, connectsTo: [5,7] },
      { x: -15, y: 20, size: 3.5, connectsTo: [8] },
      { x: -15, y: 10, size: 3.5 },
    ],
  },
  {
    icon: Fence,
    label: 'Huerto',
    href: '/huerto',
    dots: [
      { x: -20, y: -20, size: 3},
      { x: -20, y: 0, size: 3, connectsTo: [0,2] },
      { x: -20, y: 20, size: 3},
      { x: 0, y: -20, size: 4.5,},
      { x: 0, y: 0, size: 4, connectsTo: [1,3,5,7] },
      { x: 0, y: 20, size: 3.5 },
      { x: 20, y: -20, size: 5 },
      { x: 20, y: 0, size: 3, connectsTo: [6,8]},
      { x: 20, y: 20, size: 3 },
    ],
  },
  {
    icon: Calendar,
    label: 'Eventos',
    href: '/eventos',
    dots: [
      { x: -9, y: -20, size: 4, connectsTo: [1] },
      { x: -9, y: -10, size: 3.5},
      { x: 9, y: -20, size: 4, connectsTo: [3] },
      { x: 9, y: -10, size: 3.5},
      { x: -20, y: -15, size: 5, connectsTo: [5,7] },
      { x: 20, y: -15, size: 3, connectsTo: [6] },
      { x: 20, y: 20, size: 4.5, connectsTo: [7] },
      { x: -20, y: 20, size: 3.5 },
    ],
  },
];