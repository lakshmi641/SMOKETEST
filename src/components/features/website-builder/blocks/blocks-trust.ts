// India Trust blocks: MSME badge, Startup India, Google Reviews, Razorpay, hours, festive, payment methods
// Design tokens: var(--waas-*) with fallback values
// NOTE: Some brand-specific colors (Razorpay blue, UPI green, star gold) are kept as-is.

export function registerTrustBlocks(editor: any) {
  const bm = editor.BlockManager

  // 1. MSME Badge — Udyam registration badge
  bm.add('julley-msme-badge', {
    label: 'MSME Badge',
    category: 'Trust',
    content: `<div style="display: inline-flex; align-items: center; gap: 0.625rem; padding: 0.625rem 1.25rem; background: #EFF6FF; border-radius: var(--waas-radius, 0.5rem); border: 1px solid #BFDBFE; margin: 1rem auto; font-size: 0.875rem;">
      <span style="font-size: 1.25rem;">&#128737;</span>
      <span style="font-weight: 600; color: #1E40AF;">MSME/Udyam Registered</span>
      <span style="color: #3B82F6; font-family: monospace; font-size: 0.8125rem;">UDYAM-XX-00-0000000</span>
      <a href="https://udyamregistration.gov.in/udyam_verify.aspx" target="_blank" rel="noopener noreferrer" style="color: #2563EB; text-decoration: underline; font-size: 0.75rem; margin-left: 0.25rem;">Verify</a>
    </div>`,
    attributes: { class: 'fa fa-shield' },
  })

  // 2. Startup India Badge — DIPP recognized
  bm.add('julley-startup-india', {
    label: 'Startup India Badge',
    category: 'Trust',
    content: `<div style="display: inline-flex; flex-direction: column; align-items: center; padding: 1rem 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); border: 1px solid var(--waas-border, #E5E7EB); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); margin: 1rem auto; text-align: center;">
      <div style="width: 100%; height: 4px; border-radius: 2px; background: linear-gradient(90deg, #FF9933 33%, #FFFFFF 33%, #FFFFFF 66%, #138808 66%); margin-bottom: 0.75rem;"></div>
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 1.5rem;">&#127470;&#127475;</span>
        <div>
          <div style="font-weight: 700; color: #1E40AF; font-size: 0.9375rem;">Startup India</div>
          <div style="color: var(--waas-text-muted, #6B7280); font-size: 0.75rem;">DIPP Recognized Startup</div>
        </div>
      </div>
      <div style="margin-top: 0.5rem; font-family: monospace; color: #3B82F6; font-size: 0.8125rem;">DIPP12345</div>
      <a href="https://www.startupindia.gov.in/" target="_blank" rel="noopener noreferrer" style="color: #2563EB; text-decoration: underline; font-size: 0.75rem; margin-top: 0.375rem;">Learn More</a>
    </div>`,
    attributes: { class: 'fa fa-flag' },
  })

  // 3. Google Reviews — star rating display
  bm.add('julley-reviews', {
    label: 'Google Reviews',
    category: 'Trust',
    content: `<section style="padding: 2rem; text-align: center;">
      <div style="display: inline-flex; flex-direction: column; align-items: center; padding: 1.5rem 2rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); border: 1px solid var(--waas-border, #E5E7EB);">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
          <span style="font-size: 2rem; font-weight: 700; color: var(--waas-text, #1A1A2E);">4.8</span>
          <div style="display: flex; gap: 0.125rem;">
            <span style="font-size: 1.25rem; color: #F59E0B;">&#9733;</span>
            <span style="font-size: 1.25rem; color: #F59E0B;">&#9733;</span>
            <span style="font-size: 1.25rem; color: #F59E0B;">&#9733;</span>
            <span style="font-size: 1.25rem; color: #F59E0B;">&#9733;</span>
            <span style="font-size: 1.25rem; color: #F59E0B;">&#9733;</span>
          </div>
        </div>
        <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; margin-bottom: 0.75rem;">Based on 200+ Google Reviews</p>
        <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.375rem; color: #2563EB; font-size: 0.8125rem; text-decoration: none; font-weight: 500;">
          <span style="font-size: 1rem;">G</span> View on Google Maps &rarr;
        </a>
      </div>
    </section>`,
    attributes: { class: 'fa fa-star' },
  })

  // 4. Razorpay CTA — placeholder payment button (Razorpay blue brand intentional)
  bm.add('julley-razorpay', {
    label: 'Razorpay CTA',
    category: 'Trust',
    content: `<section style="padding: 2.5rem 2rem; background: #2563EB; text-align: center;">
      <div style="max-width: 500px; margin: 0 auto;">
        <div style="font-size: 1.5rem; margin-bottom: 0.25rem;">&#128274;</div>
        <h3 style="color: white; font-size: 1.25rem; margin-bottom: 0.5rem;">Secure Online Payment</h3>
        <p style="color: rgba(255,255,255,0.85); font-size: 0.875rem; margin-bottom: 1.5rem;">Pay securely using credit card, debit card, UPI, or net banking via Razorpay.</p>
        <a href="#" style="display: inline-block; padding: 0.875rem 2.5rem; background: white; color: #2563EB; border-radius: var(--waas-radius, 0.5rem); text-decoration: none; font-weight: 700; font-size: 1rem;">Pay Now</a>
        <p style="color: rgba(255,255,255,0.6); font-size: 0.6875rem; margin-top: 0.75rem;">Powered by Razorpay &middot; PCI DSS Compliant</p>
      </div>
    </section>`,
    attributes: { class: 'fa fa-credit-card' },
  })

  // 5. Business Hours — table layout with IST
  bm.add('julley-hours', {
    label: 'Business Hours',
    category: 'Trust',
    content: `<section style="padding: 3rem 2rem;">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 2rem; color: var(--waas-text, #1A1A2E);">Business Hours</h2>
      <div style="max-width: 420px; margin: 0 auto; background: var(--waas-surface, #F8FAFC); border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse;">
          <tbody>
            <tr style="border-bottom: 1px solid var(--waas-border, #E5E7EB);">
              <td style="padding: 0.75rem 1rem; font-weight: 500; color: var(--waas-text, #1A1A2E);">Monday</td>
              <td style="padding: 0.75rem 1rem; text-align: right; color: var(--waas-text-muted, #6B7280);">9:00 AM - 8:00 PM</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--waas-border, #E5E7EB);">
              <td style="padding: 0.75rem 1rem; font-weight: 500; color: var(--waas-text, #1A1A2E);">Tuesday</td>
              <td style="padding: 0.75rem 1rem; text-align: right; color: var(--waas-text-muted, #6B7280);">9:00 AM - 8:00 PM</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--waas-border, #E5E7EB);">
              <td style="padding: 0.75rem 1rem; font-weight: 500; color: var(--waas-text, #1A1A2E);">Wednesday</td>
              <td style="padding: 0.75rem 1rem; text-align: right; color: var(--waas-text-muted, #6B7280);">9:00 AM - 8:00 PM</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--waas-border, #E5E7EB);">
              <td style="padding: 0.75rem 1rem; font-weight: 500; color: var(--waas-text, #1A1A2E);">Thursday</td>
              <td style="padding: 0.75rem 1rem; text-align: right; color: var(--waas-text-muted, #6B7280);">9:00 AM - 8:00 PM</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--waas-border, #E5E7EB);">
              <td style="padding: 0.75rem 1rem; font-weight: 500; color: var(--waas-text, #1A1A2E);">Friday</td>
              <td style="padding: 0.75rem 1rem; text-align: right; color: var(--waas-text-muted, #6B7280);">9:00 AM - 8:00 PM</td>
            </tr>
            <tr style="border-bottom: 1px solid var(--waas-border, #E5E7EB);">
              <td style="padding: 0.75rem 1rem; font-weight: 500; color: var(--waas-text, #1A1A2E);">Saturday</td>
              <td style="padding: 0.75rem 1rem; text-align: right; color: var(--waas-text-muted, #6B7280);">10:00 AM - 6:00 PM</td>
            </tr>
            <tr>
              <td style="padding: 0.75rem 1rem; font-weight: 500; color: var(--waas-text, #1A1A2E);">Sunday</td>
              <td style="padding: 0.75rem 1rem; text-align: right; color: #EF4444; font-weight: 500;">Closed</td>
            </tr>
          </tbody>
        </table>
        <div style="padding: 0.5rem 1rem; text-align: center; font-size: 0.75rem; color: var(--waas-text-muted, #9CA3AF); border-top: 1px solid var(--waas-border, #E5E7EB);">All times are in IST (Indian Standard Time)</div>
      </div>
    </section>`,
    attributes: { class: 'fa fa-clock-o' },
  })

  // 6. Festive Banner — warm gradient with golden accents
  bm.add('julley-festive', {
    label: 'Festive Banner',
    category: 'Trust',
    content: `<section style="padding: 3rem 2rem; background: linear-gradient(135deg, #F97316, #DC2626); text-align: center; position: relative; overflow: hidden; border-top: 4px solid #F59E0B; border-bottom: 4px solid #F59E0B;">
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: radial-gradient(circle at 20% 50%, rgba(245,158,11,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(245,158,11,0.15) 0%, transparent 50%); pointer-events: none;"></div>
      <div style="position: relative; z-index: 1; max-width: 600px; margin: 0 auto;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">&#127878; &#10024; &#127878;</div>
        <h2 style="color: white; font-size: 1.75rem; margin-bottom: 0.5rem; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">Special Festive Offer!</h2>
        <p style="color: rgba(255,255,255,0.95); font-size: 1.125rem; margin-bottom: 1.5rem;">Celebrate the season with exclusive discounts up to 30% off on all products.</p>
        <a href="#" style="display: inline-block; padding: 0.875rem 2rem; background: #F59E0B; color: #1A1A2E; border-radius: var(--waas-radius, 0.5rem); text-decoration: none; font-weight: 700; font-size: 1rem; box-shadow: 0 2px 8px rgba(245,158,11,0.4);">Shop Now</a>
        <p style="color: rgba(255,255,255,0.7); font-size: 0.75rem; margin-top: 0.75rem;">*Offer valid till stocks last. T&amp;C apply.</p>
      </div>
    </section>`,
    attributes: { class: 'fa fa-gift' },
  })

  // 7. Payment Methods — badge row showing popular Indian payment methods
  bm.add('julley-payment-badges', {
    label: 'Payment Methods',
    category: 'Trust',
    content: `<section style="padding: 2rem;">
      <p style="text-align: center; color: var(--waas-text-muted, #6B7280); font-size: 0.8125rem; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em;">Accepted Payment Methods</p>
      <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; max-width: 600px; margin: 0 auto;">
        <div style="padding: 0.5rem 1rem; background: var(--waas-surface, #F8FAFC); border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); font-size: 0.8125rem; font-weight: 600; color: #5B21B6;">UPI</div>
        <div style="padding: 0.5rem 1rem; background: var(--waas-surface, #F8FAFC); border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); font-size: 0.8125rem; font-weight: 600; color: #5B21B6;">PhonePe</div>
        <div style="padding: 0.5rem 1rem; background: var(--waas-surface, #F8FAFC); border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); font-size: 0.8125rem; font-weight: 600; color: #4285F4;">Google Pay</div>
        <div style="padding: 0.5rem 1rem; background: var(--waas-surface, #F8FAFC); border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); font-size: 0.8125rem; font-weight: 600; color: #00BAF2;">Paytm</div>
        <div style="padding: 0.5rem 1rem; background: var(--waas-surface, #F8FAFC); border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); font-size: 0.8125rem; font-weight: 600; color: #1A1F71;">Visa</div>
        <div style="padding: 0.5rem 1rem; background: var(--waas-surface, #F8FAFC); border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); font-size: 0.8125rem; font-weight: 600; color: #EB001B;">Mastercard</div>
      </div>
    </section>`,
    attributes: { class: 'fa fa-credit-card-alt' },
  })
}
