import {
  BarChart3,
  CircleHelp,
  Clock3,
  GalleryHorizontal,
  Image,
  List,
  Megaphone,
  PlaySquare,
  ShieldCheck,
  ShoppingBag,
  Star,
  Type,
} from "lucide-react";

const elementIcons = {
  announcement: Megaphone,
  banner: Image,
  testimonial: Star,
  timer: Clock3,
  video: PlaySquare,
  gallery: GalleryHorizontal,
  text: Type,
  reviews: Star,
  guarantee: ShieldCheck,
  faq: CircleHelp,
  list: List,
  progress: BarChart3,
  sales: ShoppingBag,
  seal: ShieldCheck,
};

export const checkoutElementIconTypes = Object.freeze(
  Object.keys(elementIcons),
);

export default function CheckoutElementIcon({ type, size = 20 }) {
  const Icon = elementIcons[type] || ShieldCheck;
  return <Icon size={size} aria-hidden="true" />;
}
