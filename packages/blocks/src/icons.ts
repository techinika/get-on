export const ICON_GROUPS = {
  General: ['star', 'heart', 'sparkles', 'smile', 'check', 'info', 'help-circle', 'clock', 'calendar', 'bookmark', 'flag', 'zap'],
  Business: ['briefcase', 'building-2', 'chart-line', 'award', 'badge-check', 'handshake', 'target', 'trending-up', 'presentation', 'calculator', 'scale', 'users'],
  'Food and drink': ['utensils', 'coffee', 'pizza', 'cake', 'wine', 'beer', 'salad', 'soup', 'ice-cream', 'cookie', 'apple', 'chef-hat'],
  'Beauty and health': ['scissors', 'sparkles', 'brush', 'flower-2', 'sun', 'droplet', 'heart-pulse', 'stethoscope', 'pill', 'activity', 'flower', 'gem'],
  'Home and repair': ['wrench', 'hammer', 'home', 'paintbrush', 'plug', 'lightbulb', 'settings', 'shield-check', 'key', 'door-open', 'sofa', 'lamp'],
  Education: ['graduation-cap', 'book-open', 'pencil', 'notebook', 'school', 'library', 'brain', 'languages', 'ruler', 'microscope', 'atom', 'pen-tool'],
  'Travel and places': ['map-pin', 'map', 'car', 'plane', 'train', 'bus', 'bike', 'compass', 'mountain', 'palm-tree', 'tent', 'ship'],
  Communication: ['phone', 'mail', 'message-circle', 'send', 'megaphone', 'bell', 'at-sign', 'inbox', 'video', 'mic', 'radio', 'share-2'],
  Nature: ['leaf', 'sprout', 'trees', 'flower', 'sun', 'cloud', 'waves', 'mountain-snow', 'bird', 'bug', 'feather', 'wind'],
} as const;

export const ICON_NAMES = Array.from(new Set(Object.values(ICON_GROUPS).flat())).sort() as readonly string[];

export type IconName = (typeof ICON_NAMES)[number];

export const ICON_KEYWORDS: Record<string, string> = {
  star: 'favourite rating quality', heart: 'love care favourite', sparkles: 'magic clean beauty',
  utensils: 'food restaurant eat', coffee: 'cafe drink', scissors: 'hair salon cut', wrench: 'repair fix',
  'graduation-cap': 'education school learning', sprout: 'farm grow plant', 'shopping-bag': 'shop buy store',
  truck: 'delivery shipping', 'map-pin': 'location address place', phone: 'call contact', mail: 'email contact',
  clock: 'time hours open', users: 'team people community', award: 'quality prize trust',
};
