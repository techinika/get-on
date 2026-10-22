import React from "react";
import {
  Award,
  Calendar,
  Camera,
  Clock,
  Coffee,
  Gift,
  GraduationCap,
  Heart,
  Leaf,
  Mail,
  MapPin,
  Phone,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Smile,
  Sparkles,
  Sprout,
  Star,
  ThumbsUp,
  Truck,
  Users,
  Utensils,
  Wrench,
} from "lucide-react";
import type { IconName } from "@get-on/blocks";

const ICONS: Record<
  IconName,
  React.ComponentType<{ size?: number | string; className?: string }>
> = {
  star: Star,
  heart: Heart,
  clock: Clock,
  "map-pin": MapPin,
  phone: Phone,
  mail: Mail,
  truck: Truck,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  "thumbs-up": ThumbsUp,
  users: Users,
  award: Award,
  leaf: Leaf,
  scissors: Scissors,
  utensils: Utensils,
  camera: Camera,
  wrench: Wrench,
  "graduation-cap": GraduationCap,
  sprout: Sprout,
  "shopping-bag": ShoppingBag,
  gift: Gift,
  calendar: Calendar,
  smile: Smile,
  coffee: Coffee,
};

/** An inline icon. It is drawn as SVG so the page needs no extra files. */
export function Icon({
  name,
  size = 24,
  className,
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  const Component = ICONS[name] ?? Sparkles;
  return <Component size={size} className={className} aria-hidden="true" />;
}
