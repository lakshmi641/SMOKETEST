// Business Essential blocks: pricing, team, stats, logos, cta-banner, video, map, features, timeline
// Design tokens: var(--waas-*) with fallback values

export function registerBusinessBlocks(editor: any) {
  const bm = editor.BlockManager

  // 1. Pricing Table — 3-column, middle plan featured
  bm.add('julley-pricing', {
    label: 'Pricing Table',
    category: 'Business',
    content: `<section style="padding: 3rem 2rem; background: var(--waas-surface, #F8FAFC);">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 0.5rem; color: var(--waas-text, #1A1A2E);">Choose Your Plan</h2>
      <p style="text-align: center; color: var(--waas-text-muted, #6B7280); margin-bottom: 2.5rem;">Simple, transparent pricing for every business</p>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; max-width: 960px; margin: 0 auto; align-items: stretch;">
        <!-- Basic Plan -->
        <div style="padding: 2rem 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); border: 1px solid var(--waas-border, #E5E7EB); text-align: center; display: flex; flex-direction: column;">
          <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem; color: var(--waas-text, #1A1A2E);">Basic</h3>
          <div style="margin-bottom: 1.5rem;">
            <span style="font-size: 2.5rem; font-weight: 700; color: var(--waas-text, #1A1A2E);">&#8377;999</span>
            <span style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">/mo</span>
          </div>
          <ul style="list-style: none; padding: 0; margin: 0 0 2rem; text-align: left; flex: 1;">
            <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--waas-border, #E5E7EB); color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">&#10003; 5 Pages</li>
            <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--waas-border, #E5E7EB); color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">&#10003; Custom Domain</li>
            <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--waas-border, #E5E7EB); color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">&#10003; SSL Certificate</li>
            <li style="padding: 0.5rem 0; color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">&#10003; Email Support</li>
          </ul>
          <a href="#" style="display: block; padding: 0.75rem; border: 2px solid var(--waas-primary, #2563EB); color: var(--waas-primary, #2563EB); border-radius: var(--waas-radius, 0.5rem); text-decoration: none; font-weight: 600; text-align: center;">Get Started</a>
        </div>
        <!-- Pro Plan (Featured) -->
        <div style="padding: 2rem 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); box-shadow: 0 4px 20px rgba(0,0,0,0.12); border: 2px solid var(--waas-primary, #2563EB); text-align: center; display: flex; flex-direction: column; position: relative; transform: scale(1.05);">
          <div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: var(--waas-primary, #2563EB); color: white; padding: 0.25rem 1rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600;">POPULAR</div>
          <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem; color: var(--waas-text, #1A1A2E);">Professional</h3>
          <div style="margin-bottom: 1.5rem;">
            <span style="font-size: 2.5rem; font-weight: 700; color: var(--waas-primary, #2563EB);">&#8377;2,499</span>
            <span style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">/mo</span>
          </div>
          <ul style="list-style: none; padding: 0; margin: 0 0 2rem; text-align: left; flex: 1;">
            <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--waas-border, #E5E7EB); color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">&#10003; Unlimited Pages</li>
            <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--waas-border, #E5E7EB); color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">&#10003; Custom Domain</li>
            <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--waas-border, #E5E7EB); color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">&#10003; SSL + Analytics</li>
            <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--waas-border, #E5E7EB); color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">&#10003; Priority Support</li>
            <li style="padding: 0.5rem 0; color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">&#10003; SEO Optimization</li>
          </ul>
          <a href="#" style="display: block; padding: 0.75rem; background: var(--waas-primary, #2563EB); color: white; border: none; border-radius: var(--waas-radius, 0.5rem); text-decoration: none; font-weight: 600; text-align: center;">Get Started</a>
        </div>
        <!-- Enterprise Plan -->
        <div style="padding: 2rem 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); border: 1px solid var(--waas-border, #E5E7EB); text-align: center; display: flex; flex-direction: column;">
          <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem; color: var(--waas-text, #1A1A2E);">Enterprise</h3>
          <div style="margin-bottom: 1.5rem;">
            <span style="font-size: 2.5rem; font-weight: 700; color: var(--waas-text, #1A1A2E);">&#8377;4,999</span>
            <span style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">/mo</span>
          </div>
          <ul style="list-style: none; padding: 0; margin: 0 0 2rem; text-align: left; flex: 1;">
            <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--waas-border, #E5E7EB); color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">&#10003; Everything in Pro</li>
            <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--waas-border, #E5E7EB); color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">&#10003; Multi-language</li>
            <li style="padding: 0.5rem 0; border-bottom: 1px solid var(--waas-border, #E5E7EB); color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">&#10003; Custom Integrations</li>
            <li style="padding: 0.5rem 0; color: var(--waas-text-muted, #6B7280); font-size: 0.875rem;">&#10003; Dedicated Manager</li>
          </ul>
          <a href="#" style="display: block; padding: 0.75rem; border: 2px solid var(--waas-primary, #2563EB); color: var(--waas-primary, #2563EB); border-radius: var(--waas-radius, 0.5rem); text-decoration: none; font-weight: 600; text-align: center;">Contact Us</a>
        </div>
      </div>
    </section>`,
    attributes: { class: 'fa fa-usd' },
  })

  // 2. Team Grid — 3-column team member cards
  bm.add('julley-team', {
    label: 'Team Grid',
    category: 'Business',
    content: `<section style="padding: 3rem 2rem;">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 0.5rem; color: var(--waas-text, #1A1A2E);">Meet Our Team</h2>
      <p style="text-align: center; color: var(--waas-text-muted, #6B7280); margin-bottom: 2.5rem;">The people behind our success</p>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; max-width: 960px; margin: 0 auto;">
        <div style="padding: 2rem 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); text-align: center;">
          <div style="width: 120px; height: 120px; border-radius: 50%; background: #E5E7EB; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #9CA3AF); font-size: 0.75rem;">Photo</div>
          <h3 style="font-size: 1.125rem; margin-bottom: 0.25rem; color: var(--waas-text, #1A1A2E);">Rajesh Kumar</h3>
          <p style="color: var(--waas-primary, #2563EB); font-size: 0.875rem; font-weight: 500; margin-bottom: 0.75rem;">Founder &amp; CEO</p>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.8125rem; line-height: 1.5;">Passionate about building businesses that make a difference in the community.</p>
        </div>
        <div style="padding: 2rem 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); text-align: center;">
          <div style="width: 120px; height: 120px; border-radius: 50%; background: #E5E7EB; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #9CA3AF); font-size: 0.75rem;">Photo</div>
          <h3 style="font-size: 1.125rem; margin-bottom: 0.25rem; color: var(--waas-text, #1A1A2E);">Priya Sharma</h3>
          <p style="color: var(--waas-primary, #2563EB); font-size: 0.875rem; font-weight: 500; margin-bottom: 0.75rem;">Operations Head</p>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.8125rem; line-height: 1.5;">Ensuring smooth operations and delivering excellence in every project.</p>
        </div>
        <div style="padding: 2rem 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); text-align: center;">
          <div style="width: 120px; height: 120px; border-radius: 50%; background: #E5E7EB; margin: 0 auto 1rem; display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #9CA3AF); font-size: 0.75rem;">Photo</div>
          <h3 style="font-size: 1.125rem; margin-bottom: 0.25rem; color: var(--waas-text, #1A1A2E);">Amit Patel</h3>
          <p style="color: var(--waas-primary, #2563EB); font-size: 0.875rem; font-weight: 500; margin-bottom: 0.75rem;">Technical Lead</p>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.8125rem; line-height: 1.5;">Driving innovation and technology to create better solutions for our clients.</p>
        </div>
      </div>
    </section>`,
    attributes: { class: 'fa fa-users' },
  })

  // 3. Stats Counter — 4-column large numbers
  bm.add('julley-stats', {
    label: 'Stats Counter',
    category: 'Business',
    content: `<section style="padding: 3rem 2rem; background: var(--waas-surface, #F8FAFC);">
      <div style="display: flex; justify-content: center; gap: 3rem; flex-wrap: wrap; max-width: 900px; margin: 0 auto; text-align: center;">
        <div style="min-width: 140px;">
          <div style="font-size: 2.5rem; font-weight: 700; color: var(--waas-primary, #2563EB); line-height: 1.2;">500+</div>
          <div style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; margin-top: 0.5rem;">Happy Clients</div>
        </div>
        <div style="min-width: 140px;">
          <div style="font-size: 2.5rem; font-weight: 700; color: var(--waas-primary, #2563EB); line-height: 1.2;">98%</div>
          <div style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; margin-top: 0.5rem;">Satisfaction Rate</div>
        </div>
        <div style="min-width: 140px;">
          <div style="font-size: 2.5rem; font-weight: 700; color: var(--waas-primary, #2563EB); line-height: 1.2;">24/7</div>
          <div style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; margin-top: 0.5rem;">Customer Support</div>
        </div>
        <div style="min-width: 140px;">
          <div style="font-size: 2.5rem; font-weight: 700; color: var(--waas-primary, #2563EB); line-height: 1.2;">10K+</div>
          <div style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; margin-top: 0.5rem;">Products Delivered</div>
        </div>
      </div>
    </section>`,
    attributes: { class: 'fa fa-bar-chart' },
  })

  // 4. Client Logos — horizontal scroll with snap
  bm.add('julley-logos', {
    label: 'Client Logos',
    category: 'Business',
    content: `<section style="padding: 3rem 2rem;">
      <p style="text-align: center; color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: 0.05em;">Trusted by leading companies</p>
      <div style="display: flex; gap: 1.5rem; overflow-x: auto; scroll-snap-type: x mandatory; padding: 0.5rem 0; max-width: 900px; margin: 0 auto; justify-content: center; flex-wrap: wrap;">
        <div style="min-width: 120px; height: 60px; border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #9CA3AF); font-size: 0.75rem; scroll-snap-align: start; background: var(--waas-bg, white);">Logo 1</div>
        <div style="min-width: 120px; height: 60px; border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #9CA3AF); font-size: 0.75rem; scroll-snap-align: start; background: var(--waas-bg, white);">Logo 2</div>
        <div style="min-width: 120px; height: 60px; border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #9CA3AF); font-size: 0.75rem; scroll-snap-align: start; background: var(--waas-bg, white);">Logo 3</div>
        <div style="min-width: 120px; height: 60px; border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #9CA3AF); font-size: 0.75rem; scroll-snap-align: start; background: var(--waas-bg, white);">Logo 4</div>
        <div style="min-width: 120px; height: 60px; border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #9CA3AF); font-size: 0.75rem; scroll-snap-align: start; background: var(--waas-bg, white);">Logo 5</div>
        <div style="min-width: 120px; height: 60px; border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); display: flex; align-items: center; justify-content: center; color: var(--waas-text-muted, #9CA3AF); font-size: 0.75rem; scroll-snap-align: start; background: var(--waas-bg, white);">Logo 6</div>
      </div>
    </section>`,
    attributes: { class: 'fa fa-building' },
  })

  // 5. CTA Banner — full-width gradient
  bm.add('julley-cta-banner', {
    label: 'CTA Banner',
    category: 'Business',
    content: `<section style="padding: 4rem 2rem; background: linear-gradient(135deg, var(--waas-primary, #2563EB), var(--waas-secondary, #1E40AF)); text-align: center;">
      <h2 style="font-size: 2rem; color: white; margin-bottom: 0.75rem;">Ready to Grow Your Business?</h2>
      <p style="color: rgba(255,255,255,0.9); font-size: 1.125rem; max-width: 560px; margin: 0 auto 2rem;">Join hundreds of businesses already using our platform to reach more customers.</p>
      <a href="#" style="display: inline-block; padding: 0.875rem 2.5rem; background: var(--waas-bg, white); color: var(--waas-primary, #2563EB); border-radius: var(--waas-radius, 0.5rem); text-decoration: none; font-weight: 700; font-size: 1rem;">Get Started Today</a>
    </section>`,
    attributes: { class: 'fa fa-bullhorn' },
  })

  // 6. Video Embed — responsive 16:9 iframe
  bm.add('julley-video', {
    label: 'Video Embed',
    category: 'Business',
    content: `<section style="padding: 3rem 2rem;">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 2rem; color: var(--waas-text, #1A1A2E);">Watch Our Story</h2>
      <div style="position: relative; width: 100%; max-width: 800px; margin: 0 auto; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08));">
        <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe>
      </div>
    </section>`,
    attributes: { class: 'fa fa-play-circle' },
  })

  // 7. Map Embed — responsive Google Maps iframe
  bm.add('julley-map', {
    label: 'Map Embed',
    category: 'Business',
    content: `<section style="padding: 3rem 2rem;">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 2rem; color: var(--waas-text, #1A1A2E);">Find Us</h2>
      <div style="width: 100%; max-width: 960px; margin: 0 auto; border-radius: var(--waas-radius, 0.5rem); overflow: hidden; box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08));">
        <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3153.019551665984!2d-122.41941548468147!3d37.77492977975903!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzfCsDQ2JzI5LjciTiAxMjLCsDI1JzAyLjAiVw!5e0!3m2!1sen!2sus!4v1234567890" width="100%" height="400" style="border: 0; display: block;" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Location Map"></iframe>
      </div>
    </section>`,
    attributes: { class: 'fa fa-map-marker' },
  })

  // 8. Feature Grid — 3-column bento grid with icon placeholders
  bm.add('julley-features', {
    label: 'Feature Grid',
    category: 'Business',
    content: `<section style="padding: 3rem 2rem;">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 0.5rem; color: var(--waas-text, #1A1A2E);">Why Choose Us</h2>
      <p style="text-align: center; color: var(--waas-text-muted, #6B7280); margin-bottom: 2.5rem;">Features that set us apart</p>
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; max-width: 960px; margin: 0 auto;">
        <div style="padding: 2rem 1.5rem; background: var(--waas-surface, #F8FAFC); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08));">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--waas-primary, #2563EB); display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; color: white; font-size: 1.25rem;">&#9733;</div>
          <h3 style="font-size: 1.125rem; margin-bottom: 0.5rem; color: var(--waas-text, #1A1A2E);">Quality First</h3>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; line-height: 1.6;">We prioritize quality in every product and service we deliver to our customers.</p>
        </div>
        <div style="padding: 2rem 1.5rem; background: var(--waas-surface, #F8FAFC); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08));">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--waas-primary, #2563EB); display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; color: white; font-size: 1.25rem;">&#9889;</div>
          <h3 style="font-size: 1.125rem; margin-bottom: 0.5rem; color: var(--waas-text, #1A1A2E);">Fast Delivery</h3>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; line-height: 1.6;">Quick turnaround times with reliable delivery across all locations.</p>
        </div>
        <div style="padding: 2rem 1.5rem; background: var(--waas-surface, #F8FAFC); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08));">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--waas-primary, #2563EB); display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; color: white; font-size: 1.25rem;">&#128274;</div>
          <h3 style="font-size: 1.125rem; margin-bottom: 0.5rem; color: var(--waas-text, #1A1A2E);">Secure &amp; Trusted</h3>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; line-height: 1.6;">Your data and transactions are protected with industry-standard security.</p>
        </div>
      </div>
    </section>`,
    attributes: { class: 'fa fa-th-large' },
  })

  // 9. Timeline — vertical timeline with center line
  bm.add('julley-timeline', {
    label: 'Timeline',
    category: 'Business',
    content: `<section style="padding: 3rem 2rem;">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 2.5rem; color: var(--waas-text, #1A1A2E);">Our Journey</h2>
      <div style="position: relative; max-width: 600px; margin: 0 auto; padding-left: 2rem; border-left: 2px solid var(--waas-border, #E5E7EB);">
        <!-- Entry 1 -->
        <div style="position: relative; padding-bottom: 2rem; padding-left: 1.5rem;">
          <div style="position: absolute; left: -2.45rem; top: 0.25rem; width: 12px; height: 12px; border-radius: 50%; background: var(--waas-primary, #2563EB);"></div>
          <span style="font-size: 0.75rem; color: var(--waas-primary, #2563EB); font-weight: 600; text-transform: uppercase;">2020</span>
          <h3 style="font-size: 1.125rem; margin: 0.25rem 0 0.5rem; color: var(--waas-text, #1A1A2E);">Company Founded</h3>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; line-height: 1.6;">Started with a small team and a big vision to transform the industry.</p>
        </div>
        <!-- Entry 2 -->
        <div style="position: relative; padding-bottom: 2rem; padding-left: 1.5rem;">
          <div style="position: absolute; left: -2.45rem; top: 0.25rem; width: 12px; height: 12px; border-radius: 50%; background: var(--waas-primary, #2563EB);"></div>
          <span style="font-size: 0.75rem; color: var(--waas-primary, #2563EB); font-weight: 600; text-transform: uppercase;">2022</span>
          <h3 style="font-size: 1.125rem; margin: 0.25rem 0 0.5rem; color: var(--waas-text, #1A1A2E);">Nationwide Expansion</h3>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; line-height: 1.6;">Expanded operations across 10 major cities in India.</p>
        </div>
        <!-- Entry 3 -->
        <div style="position: relative; padding-bottom: 2rem; padding-left: 1.5rem;">
          <div style="position: absolute; left: -2.45rem; top: 0.25rem; width: 12px; height: 12px; border-radius: 50%; background: var(--waas-primary, #2563EB);"></div>
          <span style="font-size: 0.75rem; color: var(--waas-primary, #2563EB); font-weight: 600; text-transform: uppercase;">2024</span>
          <h3 style="font-size: 1.125rem; margin: 0.25rem 0 0.5rem; color: var(--waas-text, #1A1A2E);">500+ Clients Milestone</h3>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; line-height: 1.6;">Reached 500+ happy clients with a 98% satisfaction rate.</p>
        </div>
        <!-- Entry 4 -->
        <div style="position: relative; padding-left: 1.5rem;">
          <div style="position: absolute; left: -2.45rem; top: 0.25rem; width: 12px; height: 12px; border-radius: 50%; background: var(--waas-primary, #2563EB);"></div>
          <span style="font-size: 0.75rem; color: var(--waas-primary, #2563EB); font-weight: 600; text-transform: uppercase;">2026</span>
          <h3 style="font-size: 1.125rem; margin: 0.25rem 0 0.5rem; color: var(--waas-text, #1A1A2E);">Digital Transformation</h3>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; line-height: 1.6;">Launched our digital platform to serve businesses across India and beyond.</p>
        </div>
      </div>
    </section>`,
    attributes: { class: 'fa fa-clock-o' },
  })
}
