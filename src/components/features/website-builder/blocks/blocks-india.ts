// India-specific blocks: whatsapp, catalog, upi, gstin
// Design tokens: var(--waas-*) with fallback values
// NOTE: WhatsApp green (#25D366) and UPI green background (#F0FDF4) are
//       intentional brand colors and are NOT replaced with tokens.

export function registerIndiaBlocks(editor: any) {
  const bm = editor.BlockManager

  // WhatsApp CTA — brand green intentionally kept as-is
  bm.add('julley-whatsapp', {
    label: 'WhatsApp CTA',
    category: 'India',
    content: `<section style="padding: 2rem; text-align: center; background: #25D366; color: white;">
      <h3 style="margin-bottom: 1rem;">Chat with us on WhatsApp</h3>
      <a href="https://wa.me/919876543210" target="_blank" style="display: inline-block; padding: 0.75rem 2rem; background: var(--waas-bg, white); color: #25D366; border-radius: var(--waas-radius, 0.5rem); text-decoration: none; font-weight: 600;">Open WhatsApp</a>
    </section>`,
    attributes: { class: 'fa fa-whatsapp' },
  })

  bm.add('julley-catalog', {
    label: 'Product Catalog',
    category: 'India',
    content: `<section style="padding: 3rem 2rem; background: var(--waas-surface, #F8FAFC);">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 2rem;">Our Products</h2>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; max-width: 1000px; margin: 0 auto;">
        <div style="background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); overflow: hidden; box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08));">
          <div style="height: 160px; background: var(--waas-border, #E5E7EB); display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #9CA3AF); font-size: 0.875rem;">Product Image</div>
          <div style="padding: 1rem;">
            <h3 style="font-size: 1rem; margin-bottom: 0.25rem;">Product Name</h3>
            <p style="color: var(--waas-primary, #2563EB); font-weight: 700; margin-bottom: 0.5rem;">&#8377;999</p>
            <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.8125rem;">Brief product description here.</p>
          </div>
        </div>
        <div style="background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); overflow: hidden; box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08));">
          <div style="height: 160px; background: var(--waas-border, #E5E7EB); display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #9CA3AF); font-size: 0.875rem;">Product Image</div>
          <div style="padding: 1rem;">
            <h3 style="font-size: 1rem; margin-bottom: 0.25rem;">Product Name</h3>
            <p style="color: var(--waas-primary, #2563EB); font-weight: 700; margin-bottom: 0.5rem;">&#8377;1,499</p>
            <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.8125rem;">Brief product description here.</p>
          </div>
        </div>
        <div style="background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); overflow: hidden; box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08));">
          <div style="height: 160px; background: var(--waas-border, #E5E7EB); display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #9CA3AF); font-size: 0.875rem;">Product Image</div>
          <div style="padding: 1rem;">
            <h3 style="font-size: 1rem; margin-bottom: 0.25rem;">Product Name</h3>
            <p style="color: var(--waas-primary, #2563EB); font-weight: 700; margin-bottom: 0.5rem;">&#8377;2,199</p>
            <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.8125rem;">Brief product description here.</p>
          </div>
        </div>
      </div>
    </section>`,
    attributes: { class: 'fa fa-th' },
  })

  // UPI Payment — green background (#F0FDF4) is intentional brand color
  bm.add('julley-upi', {
    label: 'UPI Payment QR',
    category: 'India',
    content: `<section style="padding: 3rem 2rem; text-align: center; background: #F0FDF4;">
      <h3 style="font-size: 1.25rem; margin-bottom: 1rem; color: #065F46;">Pay via UPI</h3>
      <div style="width: 200px; height: 200px; background: var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; border: 2px dashed var(--waas-text-muted, #9CA3AF);">QR Code</div>
      <p style="font-weight: 600; color: #059669; margin-bottom: 0.25rem;">merchant@upi</p>
      <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">Merchant Name</p>
      <p style="color: var(--waas-text-muted, #9CA3AF); font-size: 0.75rem; margin-top: 0.5rem;">Scan to pay with any UPI app</p>
    </section>`,
    attributes: { class: 'fa fa-qrcode' },
  })

  bm.add('julley-gstin', {
    label: 'GSTIN Badge',
    category: 'India',
    content: `<div style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: #EFF6FF; border-radius: var(--waas-radius, 0.5rem); border: 1px solid #BFDBFE; margin: 1rem auto; font-size: 0.875rem;">
      <span style="font-size: 1.125rem;">&#128737;</span>
      <span style="font-weight: 600; color: #1E40AF;">GST Registered</span>
      <span style="color: #3B82F6; font-family: monospace;">29AABCS1429B1Z5</span>
      <a href="https://services.gst.gov.in/services/searchtp" target="_blank" rel="noopener noreferrer" style="color: #2563EB; text-decoration: underline; font-size: 0.75rem; margin-left: 0.25rem;">Verify</a>
    </div>`,
    attributes: { class: 'fa fa-shield' },
  })
}
