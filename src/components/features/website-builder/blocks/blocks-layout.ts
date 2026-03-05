// Layout blocks: header, hero, footer
// Design tokens: var(--waas-*) with fallback values

export function registerLayoutBlocks(editor: any) {
  const bm = editor.BlockManager

  bm.add('julley-header', {
    label: 'Header',
    category: 'Layout',
    content: `<header style="padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--waas-border, #E5E7EB);">
      <div style="font-weight: bold; font-size: 1.25rem; color: var(--waas-primary, #2563EB);">{{company_name}}</div>
      <nav style="display: flex; gap: 1.5rem;">
        <a href="/" style="color: var(--waas-text, #333); text-decoration: none;">Home</a>
        <a href="/about" style="color: var(--waas-text, #333); text-decoration: none;">About</a>
        <a href="/services" style="color: var(--waas-text, #333); text-decoration: none;">Services</a>
        <a href="/contact" style="color: var(--waas-text, #333); text-decoration: none;">Contact</a>
      </nav>
    </header>`,
    attributes: { class: 'fa fa-header' },
  })

  bm.add('julley-hero', {
    label: 'Hero Section',
    category: 'Layout',
    content: `<section style="padding: 4rem 2rem; text-align: center; background: linear-gradient(135deg, var(--waas-primary, #2563EB), var(--waas-secondary, #1E40AF)); color: white;">
      <h1 style="font-size: 2.5rem; margin-bottom: 1rem;">Welcome to {{company_name}}</h1>
      <p style="font-size: 1.125rem; opacity: 0.9; max-width: 600px; margin: 0 auto 2rem;">Your trusted partner for quality products and services.</p>
      <a href="/contact" style="display: inline-block; padding: 0.75rem 2rem; background: var(--waas-bg, white); color: var(--waas-primary, #2563EB); border-radius: var(--waas-radius, 0.5rem); text-decoration: none; font-weight: 600;">Get in Touch</a>
    </section>`,
    attributes: { class: 'fa fa-image' },
  })

  bm.add('julley-hero-gradient', {
    label: 'Gradient Mesh Hero',
    category: 'Layout',
    content: `<section style="padding: 5rem 2rem; text-align: center; background: linear-gradient(135deg, var(--waas-primary, #2563EB) 0%, var(--waas-accent, #F59E0B) 50%, var(--waas-secondary, #1E40AF) 100%); background-size: 200% 200%; animation: waas-gradient-shift 8s ease infinite; color: white; position: relative; overflow: hidden;">
      <style>@keyframes waas-gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }</style>
      <h1 style="font-size: 3rem; margin-bottom: 1rem; font-weight: 800;">Welcome to {{company_name}}</h1>
      <p style="font-size: 1.25rem; opacity: 0.95; max-width: 650px; margin: 0 auto 2.5rem;">Transform your business with our innovative solutions and expert team.</p>
      <a href="/contact" style="display: inline-block; padding: 1rem 2.5rem; background: var(--waas-bg, white); color: var(--waas-primary, #2563EB); border-radius: var(--waas-radius, 0.5rem); text-decoration: none; font-weight: 700; font-size: 1.125rem;">Get Started</a>
    </section>`,
    attributes: { class: 'fa fa-image' },
  })

  bm.add('julley-hero-parallax', {
    label: 'Parallax Hero',
    category: 'Layout',
    content: `<section style="padding: 6rem 2rem; text-align: center; background-image: url('https://images.unsplash.com/photo-1497366216548-37526070297c?w=1600&q=80'); background-attachment: fixed; background-size: cover; background-position: center; position: relative; color: white;">
      <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.7));"></div>
      <div style="position: relative; z-index: 1;">
        <h1 style="font-size: 3rem; margin-bottom: 1rem; font-weight: 800;">Welcome to {{company_name}}</h1>
        <p style="font-size: 1.25rem; opacity: 0.9; max-width: 650px; margin: 0 auto 2.5rem;">Building excellence with passion and commitment since day one.</p>
        <a href="/contact" style="display: inline-block; padding: 1rem 2.5rem; background: var(--waas-primary, #2563EB); color: white; border-radius: var(--waas-radius, 0.5rem); text-decoration: none; font-weight: 700; font-size: 1.125rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">Contact Us</a>
      </div>
    </section>`,
    attributes: { class: 'fa fa-image' },
  })

  // Footer: intentionally keeps #1a1a2e dark background (brand-dark)
  bm.add('julley-footer', {
    label: 'Footer',
    category: 'Layout',
    content: `<footer style="padding: 2rem; background: #1a1a2e; color: #ccc; text-align: center;">
      <p style="margin: 0;">&copy; 2026 {{company_name}}. All rights reserved.</p>
      <p style="margin: 0.5rem 0 0; font-size: 0.875rem;">{{contact_email}} | {{contact_phone}}</p>
    </footer>`,
    attributes: { class: 'fa fa-bars' },
  })
}
