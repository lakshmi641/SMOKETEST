// Font Pairs — 15 curated Google Font pairings for the WaaS website builder

export interface FontPair {
  id: string
  label: string
  heading: string
  body: string
  category: 'modern' | 'classic' | 'bold' | 'elegant' | 'playful' | 'hindi'
  googleUrl: string
  weights: string
}

export const FONT_PAIRS: FontPair[] = [
  {
    id: 'professional',
    label: 'Professional',
    heading: 'Poppins',
    body: 'Inter',
    category: 'modern',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap',
    weights: '400;500;600;700',
  },
  {
    id: 'modern-clean',
    label: 'Modern Clean',
    heading: 'Inter',
    body: 'Inter',
    category: 'modern',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    weights: '400;500;600;700',
  },
  {
    id: 'bold-impact',
    label: 'Bold Impact',
    heading: 'Montserrat',
    body: 'Source Sans 3',
    category: 'bold',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap',
    weights: '400;500;600;700',
  },
  {
    id: 'elegant-serif',
    label: 'Elegant Serif',
    heading: 'Playfair Display',
    body: 'Lato',
    category: 'elegant',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Lato:wght@400;700&display=swap',
    weights: '400;500;600;700',
  },
  {
    id: 'geometric',
    label: 'Geometric',
    heading: 'DM Sans',
    body: 'DM Sans',
    category: 'modern',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap',
    weights: '400;500;600;700',
  },
  {
    id: 'warm-friendly',
    label: 'Warm & Friendly',
    heading: 'Nunito',
    body: 'Open Sans',
    category: 'playful',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700&family=Open+Sans:wght@400;500;600;700&display=swap',
    weights: '400;500;600;700',
  },
  {
    id: 'tech-startup',
    label: 'Tech Startup',
    heading: 'Space Grotesk',
    body: 'Inter',
    category: 'modern',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap',
    weights: '400;500;600;700',
  },
  {
    id: 'classic-business',
    label: 'Classic Business',
    heading: 'Merriweather',
    body: 'Source Sans 3',
    category: 'classic',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Source+Sans+3:wght@400;500;600;700&display=swap',
    weights: '400;500;600;700',
  },
  {
    id: 'manrope-clean',
    label: 'Manrope Clean',
    heading: 'Manrope',
    body: 'Inter',
    category: 'modern',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap',
    weights: '400;500;600;700',
  },
  {
    id: 'raleway-modern',
    label: 'Raleway Modern',
    heading: 'Raleway',
    body: 'Roboto',
    category: 'modern',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap',
    weights: '400;500;600;700',
  },
  {
    id: 'outfit-clean',
    label: 'Outfit Clean',
    heading: 'Outfit',
    body: 'Outfit',
    category: 'modern',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap',
    weights: '400;500;600;700',
  },
  {
    id: 'libre-elegant',
    label: 'Libre Elegant',
    heading: 'Libre Baskerville',
    body: 'Libre Franklin',
    category: 'elegant',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Libre+Franklin:wght@400;500;600;700&display=swap',
    weights: '400;500;600;700',
  },
  {
    id: 'hindi-modern',
    label: 'Hindi Modern',
    heading: 'Poppins',
    body: 'Hind',
    category: 'hindi',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Hind:wght@400;500;600;700&display=swap',
    weights: '400;500;600;700',
  },
  {
    id: 'hindi-classic',
    label: 'Hindi Classic',
    heading: 'Noto Sans Devanagari',
    body: 'Noto Sans Devanagari',
    category: 'hindi',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap',
    weights: '400;500;600;700',
  },
  {
    id: 'hindi-friendly',
    label: 'Hindi Friendly',
    heading: 'Mukta',
    body: 'Mukta',
    category: 'hindi',
    googleUrl:
      'https://fonts.googleapis.com/css2?family=Mukta:wght@400;500;600;700&display=swap',
    weights: '400;500;600;700',
  },
]

/** Look up a font pair by id. Falls back to the first entry ('professional'). */
export function getFontPair(id: string): FontPair {
  return FONT_PAIRS.find((fp) => fp.id === id) ?? FONT_PAIRS[0]!
}
