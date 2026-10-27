import React from "react";
import {
  Award,
  BookOpen,
  Calendar,
  Camera,
  Clock,
  Coffee,
  Droplet,
  Gift,
  GraduationCap,
  Hammer,
  Heart,
  Home,
  Leaf,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Paintbrush,
  PenTool,
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
  Zap,
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
  "book-open": BookOpen,
  "message-circle": MessageCircle,
  megaphone: Megaphone,
  paintbrush: Paintbrush,
  "pen-tool": PenTool,
  hammer: Hammer,
  home: Home,
  droplet: Droplet,
  zap: Zap,
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
