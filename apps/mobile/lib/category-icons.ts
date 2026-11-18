import { Bug, Fan, Hammer, House, Leaf, SprayCan, Warehouse, WashingMachine, Wrench, Zap, type LucideIcon } from 'lucide-react-native';

/** A Lucide icon for each of the ten FixIt service categories. */
const icons: Record<string, LucideIcon> = {
  plumbing: Wrench,
  electrical: Zap,
  hvac: Fan,
  'garage-doors': Warehouse,
  roofing: House,
  'appliance-repair': WashingMachine,
  handyman: Hammer,
  cleaning: SprayCan,
  'pest-control': Bug,
  landscaping: Leaf,
};

export function categoryIcon(slug: string): LucideIcon {
  return icons[slug] ?? Wrench;
}
