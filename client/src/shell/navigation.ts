import {
  BookOpen, Check, Compass, GraduationCap, Heart, House, ListChecks,
  MoonStar, Target, TrendingUp
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type AtlasRoom = {
  id: string;
  label: string;
  mobileLabel: string;
  to: string;
  icon: LucideIcon;
  paths: string[];
  tabs: { label: string; to: string; paths: string[] }[];
};

export type AtlasDestination = {
  label: string;
  detail: string;
  to: string;
  icon: LucideIcon;
};

export const rooms: AtlasRoom[] = [
  {
    id: 'residence', label: 'Residence', mobileLabel: 'Home', to: '/residence', icon: House,
    paths: ['/residence', '/blueprint'],
    tabs: [
      { label: 'Home', to: '/residence', paths: ['/residence'] },
      { label: 'Life Blueprint', to: '/blueprint', paths: ['/blueprint'] }
    ]
  },
  {
    id: 'rhythm', label: 'Daily Rhythm', mobileLabel: 'Rhythm', to: '/daily-rhythm', icon: MoonStar,
    paths: ['/daily-rhythm', '/values', '/habits'],
    tabs: [
      { label: 'Daily Check-in', to: '/daily-rhythm', paths: ['/daily-rhythm'] },
      { label: 'Faith & Practice', to: '/values', paths: ['/values'] },
      { label: 'Habits & Self-Control', to: '/habits', paths: ['/habits'] }
    ]
  },
  {
    id: 'execution', label: 'Execution & Focus', mobileLabel: 'Focus', to: '/actions', icon: ListChecks,
    paths: ['/actions', '/focus', '/calendar'],
    tabs: [
      { label: 'Projects & Tasks', to: '/actions', paths: ['/actions', '/focus'] },
      { label: 'Calendar', to: '/calendar', paths: ['/calendar'] }
    ]
  },
  {
    id: 'growth', label: 'Growth & Direction', mobileLabel: 'Growth', to: '/goals', icon: TrendingUp,
    paths: ['/goals', '/learning-library', '/growth'],
    tabs: [
      { label: 'Goals & Milestones', to: '/goals', paths: ['/goals'] },
      { label: 'Learning & Library', to: '/learning-library', paths: ['/learning-library'] },
      { label: 'Reviews & Insights', to: '/growth', paths: ['/growth'] }
    ]
  }
];

export const commandDestinations: AtlasDestination[] = [
  { label: 'Life Blueprint', detail: 'See the outcomes and life areas you are building towards', to: '/blueprint', icon: Compass },
  { label: 'Daily Check-in', detail: 'Return to today’s practices, habits and priorities', to: '/daily-rhythm', icon: Check },
  { label: 'Faith & Spirituality', detail: 'Daily practice and spiritual reflection', to: '/values', icon: MoonStar },
  { label: 'Habits & Self-Control', detail: 'Build routines and personal commitments', to: '/habits', icon: Heart },
  { label: 'Education & Learning', detail: 'Learning paths, lessons and private library', to: '/learning-library', icon: GraduationCap },
  { label: 'Projects & Milestones', detail: 'Connect meaningful work to your goals', to: '/goals', icon: Target },
  { label: 'Reviews & Insights', detail: 'Reflect on evidence and patterns over time', to: '/growth', icon: TrendingUp }
];
