// Content blocks: about, services, testimonials, faq, gallery
// Design tokens: var(--waas-*) with fallback values

export function registerContentBlocks(editor: any) {
  const bm = editor.BlockManager

  bm.add('julley-about', {
    label: 'About Section',
    category: 'Content',
    content: `<section style="padding: 3rem 2rem; max-width: 800px; margin: 0 auto;">
      <h2 style="font-size: 1.75rem; margin-bottom: 1rem; color: var(--waas-text, #1A1A2E);">About Us</h2>
      <p style="color: var(--waas-text-muted, #6B7280); line-height: 1.7;">We are a trusted business committed to providing excellent products and services. With years of experience, we have built a reputation for quality and reliability.</p>
    </section>`,
    attributes: { class: 'fa fa-info-circle' },
  })

  bm.add('julley-services', {
    label: 'Services Grid',
    category: 'Content',
    content: `<section style="padding: 3rem 2rem; background: var(--waas-surface, #F8FAFC);">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 2rem;">Our Services</h2>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; max-width: 900px; margin: 0 auto;">
        <div style="padding: 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); text-align: center; box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08));">
          <h3 style="margin-bottom: 0.5rem;">Service 1</h3>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">Description of your first service offering.</p>
        </div>
        <div style="padding: 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); text-align: center; box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08));">
          <h3 style="margin-bottom: 0.5rem;">Service 2</h3>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">Description of your second service offering.</p>
        </div>
        <div style="padding: 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); text-align: center; box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08));">
          <h3 style="margin-bottom: 0.5rem;">Service 3</h3>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">Description of your third service offering.</p>
        </div>
      </div>
    </section>`,
    attributes: { class: 'fa fa-th-large' },
  })

  bm.add('julley-testimonials', {
    label: 'Testimonials',
    category: 'Content',
    content: `<section style="padding: 3rem 2rem; text-align: center;">
      <h2 style="font-size: 1.75rem; margin-bottom: 2rem;">What Our Customers Say</h2>
      <div style="display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap;">
        <div style="max-width: 300px; padding: 1.5rem; background: var(--waas-surface, #F8FAFC); border-radius: var(--waas-radius, 0.5rem);">
          <p style="color: var(--waas-text-muted, #6B7280); font-style: italic; margin-bottom: 1rem;">"Excellent service and great quality. Highly recommended!"</p>
          <p style="font-weight: 600; font-size: 0.875rem;">— Happy Customer</p>
        </div>
      </div>
    </section>`,
    attributes: { class: 'fa fa-quote-right' },
  })

  bm.add('julley-faq', {
    label: 'FAQ Section',
    category: 'Content',
    content: `<section style="padding: 3rem 2rem; max-width: 700px; margin: 0 auto;">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 2rem;">Frequently Asked Questions</h2>
      <div style="space-y: 1rem;">
        <div style="padding: 1rem; border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); margin-bottom: 0.75rem;">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem;">What services do you offer?</h3>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">We offer a wide range of services. Contact us to learn more.</p>
        </div>
        <div style="padding: 1rem; border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem);">
          <h3 style="font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem;">How can I contact you?</h3>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">You can reach us via WhatsApp, email, or phone.</p>
        </div>
      </div>
    </section>`,
    attributes: { class: 'fa fa-question-circle' },
  })

  bm.add('julley-gallery', {
    label: 'Image Gallery',
    category: 'Media',
    content: `<section style="padding: 3rem 2rem;">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 2rem;">Gallery</h2>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; max-width: 900px; margin: 0 auto;">
        <div style="aspect-ratio: 1; background: var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #9CA3AF);">Image 1</div>
        <div style="aspect-ratio: 1; background: var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #9CA3AF);">Image 2</div>
        <div style="aspect-ratio: 1; background: var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #9CA3AF);">Image 3</div>
      </div>
    </section>`,
    attributes: { class: 'fa fa-picture-o' },
  })
}
