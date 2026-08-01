/**
 * Returns a highly relevant Unsplash photo based on the gig's category or title keywords.
 * If no specific match is found, returns a beautiful, generic "teamwork / helping hands" photo.
 */
export function getCategoryGraphic(category: string = '', title: string = ''): string {
  const t = title.toLowerCase();
  const c = category.toLowerCase();
  
  // 1. Gardening & Yard Work
  if (
    c.includes('yard') || 
    c.includes('garden') || 
    t.includes('garden') || 
    t.includes('grass') || 
    t.includes('yard') || 
    t.includes('plant') || 
    t.includes('mow') ||
    t.includes('trim') ||
    t.includes('lawn') ||
    t.includes('shrub') ||
    t.includes('weed')
  ) {
    return 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=600&q=80';
  }
  
  // 2. Pet Care & Dog Walking
  if (
    c.includes('pet') || 
    c.includes('dog') || 
    t.includes('dog') || 
    t.includes('cat') || 
    t.includes('pet') || 
    t.includes('walk') || 
    t.includes('vet') ||
    t.includes('animal') ||
    t.includes('puppy') ||
    t.includes('feed')
  ) {
    return 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80';
  }
  
  // 3. Moving & Heavy Lifting
  if (
    c.includes('mov') || 
    c.includes('shift') || 
    t.includes('mov') || 
    t.includes('lift') || 
    t.includes('carry') || 
    t.includes('shift') || 
    t.includes('pack') || 
    t.includes('truck') ||
    t.includes('box') ||
    t.includes('unload') ||
    t.includes('load')
  ) {
    return 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=600&q=80';
  }
  
  // 4. Furniture Assembly & Handyman Repairs
  if (
    c.includes('assembl') || 
    c.includes('furnitur') || 
    t.includes('assembl') || 
    t.includes('ikea') || 
    t.includes('table') || 
    t.includes('fix') || 
    t.includes('repair') || 
    t.includes('sofa') || 
    t.includes('chair') ||
    t.includes('desk') ||
    t.includes('handyman')
  ) {
    return 'https://images.unsplash.com/photo-1581850518616-bcb8077fa213?auto=format&fit=crop&w=600&q=80';
  }
  
  // 5. Tech, Web, Writing & Design
  if (
    c.includes('design') || 
    c.includes('tech') || 
    c.includes('comput') || 
    t.includes('logo') || 
    t.includes('design') || 
    t.includes('cod') || 
    t.includes('write') || 
    t.includes('web') || 
    t.includes('develop') || 
    t.includes('program') || 
    t.includes('app') ||
    t.includes('software') ||
    t.includes('website')
  ) {
    return 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=600&q=80';
  }

  // 6. Housework & Cleaning
  if (
    c.includes('clean') || 
    c.includes('maid') || 
    c.includes('house') || 
    t.includes('clean') || 
    t.includes('wash') || 
    t.includes('vacuum') || 
    t.includes('sweep') || 
    t.includes('laundry') || 
    t.includes('dust') || 
    t.includes('maid') ||
    t.includes('mop')
  ) {
    return 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80';
  }

  // 7. Delivery & Couriers
  if (
    c.includes('deliver') || 
    c.includes('courier') || 
    c.includes('ship') || 
    t.includes('deliver') || 
    t.includes('courier') || 
    t.includes('parcel') || 
    t.includes('package') || 
    t.includes('drop') || 
    t.includes('pickup') || 
    t.includes('drive') || 
    t.includes('car')
  ) {
    return 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80';
  }

  // 8. Photography & Video
  if (
    c.includes('photo') || 
    c.includes('video') || 
    c.includes('shoot') || 
    t.includes('photo') || 
    t.includes('video') || 
    t.includes('shoot') || 
    t.includes('camera') || 
    t.includes('film') || 
    t.includes('photograph') ||
    t.includes('edit')
  ) {
    return 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80';
  }

  // 9. Teaching & Tutoring
  if (
    c.includes('teach') || 
    c.includes('tutor') || 
    c.includes('class') || 
    t.includes('teach') || 
    t.includes('tutor') || 
    t.includes('class') || 
    t.includes('lesson') || 
    t.includes('homework') || 
    t.includes('math') || 
    t.includes('science') || 
    t.includes('school') || 
    t.includes('course')
  ) {
    return 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=600&q=80';
  }

  // 10. Cooking & Culinary
  if (
    c.includes('cook') || 
    c.includes('chef') || 
    c.includes('food') || 
    t.includes('cook') || 
    t.includes('chef') || 
    t.includes('food') || 
    t.includes('bake') || 
    t.includes('meal') || 
    t.includes('kitchen') || 
    t.includes('cater')
  ) {
    return 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80';
  }

  // 11. Plumbing & Electrical Handyman
  if (
    c.includes('plumb') || 
    c.includes('electric') || 
    t.includes('plumb') || 
    t.includes('pipe') || 
    t.includes('leak') || 
    t.includes('electric') || 
    t.includes('wire') || 
    t.includes('fan') || 
    t.includes('switch') || 
    t.includes('socket') || 
    t.includes('light') || 
    t.includes('ac ') || 
    t.includes('fuse') ||
    t.includes('circuit')
  ) {
    return 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80';
  }

  // 12. Painting & Decoration
  if (
    c.includes('paint') || 
    t.includes('paint') || 
    t.includes('brush') || 
    t.includes('wall') || 
    t.includes('room') ||
    t.includes('decorat') ||
    t.includes('renovat') ||
    t.includes('wallpaper') ||
    t.includes('drywall')
  ) {
    return 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=600&q=80';
  }

  // 13. Events, Music & Parties
  if (
    c.includes('event') || 
    c.includes('party') || 
    t.includes('event') || 
    t.includes('party') || 
    t.includes('dj') || 
    t.includes('music') || 
    t.includes('bartend') || 
    t.includes('waiter') || 
    t.includes('host') || 
    t.includes('gala') ||
    t.includes('celebrat') ||
    t.includes('wedding') ||
    t.includes('concert') ||
    t.includes('festival') ||
    t.includes('birthday')
  ) {
    return 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=600&q=80';
  }

  // 14. Shopping & Running Errands
  if (
    c.includes('shop') || 
    c.includes('errand') || 
    t.includes('shop') || 
    t.includes('errand') || 
    t.includes('buy') || 
    t.includes('grocer') || 
    t.includes('market') ||
    t.includes('store') ||
    t.includes('mall') ||
    t.includes('purchase')
  ) {
    return 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80';
  }

  // 15. Car & Bike Wash
  if (
    c.includes('wash') ||
    c.includes('vehicle') ||
    t.includes('car wash') ||
    t.includes('bike wash') ||
    t.includes('vehicle') ||
    t.includes('car clean') ||
    t.includes('detailing') ||
    t.includes('polish') ||
    t.includes('washing car') ||
    t.includes('motorcycle')
  ) {
    return 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=600&q=80';
  }

  // 16. Baby & Child Care / Nanny
  if (
    c.includes('baby') ||
    c.includes('child') ||
    c.includes('kid') ||
    t.includes('baby') ||
    t.includes('child') ||
    t.includes('kid') ||
    t.includes('nanny') ||
    t.includes('babysit') ||
    t.includes('sit') ||
    t.includes('toddler')
  ) {
    return 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=600&q=80';
  }

  // 17. Fitness, Gym & Yoga
  if (
    c.includes('fit') ||
    c.includes('gym') ||
    c.includes('yoga') ||
    t.includes('trainer') ||
    t.includes('gym') ||
    t.includes('yoga') ||
    t.includes('workout') ||
    t.includes('fitness') ||
    t.includes('personal train') ||
    t.includes('exercise') ||
    t.includes('coach')
  ) {
    return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=600&q=80';
  }

  // 18. Beauty, Makeup & Salon / Spa
  if (
    c.includes('beaut') ||
    c.includes('spa') ||
    c.includes('hair') ||
    t.includes('makeup') ||
    t.includes('hair') ||
    t.includes('salon') ||
    t.includes('spa') ||
    t.includes('massage') ||
    t.includes('nail') ||
    t.includes('beauty') ||
    t.includes('cosmetic') ||
    t.includes('barber')
  ) {
    return 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80';
  }

  // 19. Absolute Neutral Fallback: Hands stacked in the center representing community support and teamwork.
  return 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=600&q=80';
}

export function getFallbackSvg(category: string = '', title: string = ''): string {
  const c = category.toLowerCase();
  const t = title.toLowerCase();
  
  let gradientStart = '#6366f1'; // indigo
  let gradientEnd = '#4f46e5';
  let emoji = '💼';

  if (c.includes('yard') || c.includes('garden') || t.includes('garden') || t.includes('grass') || t.includes('yard')) {
    gradientStart = '#10b981'; // emerald
    gradientEnd = '#059669';
    emoji = '🌱';
  } else if (c.includes('pet') || c.includes('dog') || t.includes('dog') || t.includes('cat')) {
    gradientStart = '#f59e0b'; // amber
    gradientEnd = '#d97706';
    emoji = '🐶';
  } else if (c.includes('mov') || t.includes('mov') || t.includes('lift') || t.includes('heavy')) {
    gradientStart = '#3b82f6'; // blue
    gradientEnd = '#2563eb';
    emoji = '📦';
  } else if (c.includes('assembl') || t.includes('assembl') || t.includes('repair') || t.includes('fix')) {
    gradientStart = '#6b7280'; // gray
    gradientEnd = '#4b5563';
    emoji = '🔧';
  } else if (c.includes('design') || t.includes('design') || t.includes('web') || t.includes('tech')) {
    gradientStart = '#ec4899'; // pink
    gradientEnd = '#db2777';
    emoji = '💻';
  } else if (c.includes('clean') || t.includes('clean') || t.includes('wash')) {
    gradientStart = '#06b6d4'; // cyan
    gradientEnd = '#0891b2';
    emoji = '🧹';
  } else if (c.includes('deliver') || t.includes('deliver') || t.includes('drive')) {
    gradientStart = '#84cc16'; // lime
    gradientEnd = '#65a30d';
    emoji = '🚗';
  } else if (c.includes('teach') || t.includes('teach') || t.includes('class') || t.includes('tutor')) {
    gradientStart = '#8b5cf6'; // violet
    gradientEnd = '#7c3aed';
    emoji = '📚';
  } else if (c.includes('cook') || t.includes('cook') || t.includes('food') || t.includes('chef')) {
    gradientStart = '#ef4444'; // red
    gradientEnd = '#dc2626';
    emoji = '🍳';
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${gradientStart};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${gradientEnd};stop-opacity:1" />
        </linearGradient>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
      <rect width="100%" height="100%" fill="url(#grid)" />
      <circle cx="200" cy="150" r="70" fill="rgba(255,255,255,0.15)" />
      <circle cx="200" cy="150" r="50" fill="rgba(255,255,255,0.2)" />
      <text x="200" y="170" font-family="system-ui, sans-serif" font-size="60" text-anchor="middle">${emoji}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}
