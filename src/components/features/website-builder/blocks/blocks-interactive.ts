// Interactive blocks: contact form, accordion, tabs, before/after, countdown, counter, carousel, sticky CTA
// Design tokens: var(--waas-*) with fallback values

export function registerInteractiveBlocks(editor: any) {
  const bm = editor.BlockManager

  // 1. Contact Form (existing)
  bm.add('julley-contact', {
    label: 'Contact Form',
    category: 'Interactive',
    content: `<section style="padding: 3rem 2rem; max-width: 600px; margin: 0 auto;">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 2rem;">Contact Us</h2>
      <form style="display: flex; flex-direction: column; gap: 1rem;">
        <input type="text" name="name" placeholder="Your Name" style="padding: 0.75rem; border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem);" required />
        <input type="email" name="email" placeholder="Email Address" style="padding: 0.75rem; border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem);" required />
        <textarea name="message" placeholder="Your Message" rows="4" style="padding: 0.75rem; border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem);" required></textarea>
        <button type="submit" style="padding: 0.75rem; background: var(--waas-primary, #2563EB); color: white; border: none; border-radius: var(--waas-radius, 0.5rem); font-weight: 600; cursor: pointer;">Send Message</button>
      </form>
    </section>`,
    attributes: { class: 'fa fa-envelope' },
  })

  // 2. Accordion FAQ — pure CSS with <details>/<summary>
  bm.add('julley-accordion', {
    label: 'Accordion FAQ',
    category: 'Interactive',
    content: `<section style="padding: 3rem 2rem; max-width: 700px; margin: 0 auto;">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 2rem; color: var(--waas-text, #1A1A2E);">Frequently Asked Questions</h2>
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <details style="border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); overflow: hidden;">
          <summary style="padding: 1rem 1.25rem; font-weight: 600; cursor: pointer; color: var(--waas-text, #1A1A2E); background: var(--waas-surface, #F8FAFC); list-style: none; display: flex; justify-content: space-between; align-items: center;">
            What services do you offer?
          </summary>
          <div style="padding: 0.75rem 1.25rem 1rem; color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; line-height: 1.6; border-top: 1px solid var(--waas-border, #E5E7EB);">
            We offer a comprehensive range of services including product delivery, custom manufacturing, consulting, and after-sales support. Contact us for a complete list tailored to your needs.
          </div>
        </details>
        <details style="border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); overflow: hidden;">
          <summary style="padding: 1rem 1.25rem; font-weight: 600; cursor: pointer; color: var(--waas-text, #1A1A2E); background: var(--waas-surface, #F8FAFC); list-style: none; display: flex; justify-content: space-between; align-items: center;">
            How can I place an order?
          </summary>
          <div style="padding: 0.75rem 1.25rem 1rem; color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; line-height: 1.6; border-top: 1px solid var(--waas-border, #E5E7EB);">
            You can place an order through our website, via WhatsApp, or by calling us directly. We also accept orders through email for bulk purchases.
          </div>
        </details>
        <details style="border: 1px solid var(--waas-border, #E5E7EB); border-radius: var(--waas-radius, 0.5rem); overflow: hidden;">
          <summary style="padding: 1rem 1.25rem; font-weight: 600; cursor: pointer; color: var(--waas-text, #1A1A2E); background: var(--waas-surface, #F8FAFC); list-style: none; display: flex; justify-content: space-between; align-items: center;">
            What is your return policy?
          </summary>
          <div style="padding: 0.75rem 1.25rem 1rem; color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; line-height: 1.6; border-top: 1px solid var(--waas-border, #E5E7EB);">
            We offer a 7-day return policy for unused items in their original packaging. Custom-made products are non-returnable. Please contact our support team to initiate a return.
          </div>
        </details>
      </div>
    </section>`,
    attributes: { class: 'fa fa-list' },
  })

  // 3. Tabbed Content — CSS radio-button trick, no JS
  bm.add('julley-tabs', {
    label: 'Tabbed Content',
    category: 'Interactive',
    content: `<section style="padding: 3rem 2rem; max-width: 700px; margin: 0 auto;">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 2rem; color: var(--waas-text, #1A1A2E);">Learn More</h2>
      <style>
        .waas-tabs input[type="radio"] { display: none; }
        .waas-tabs label { display: inline-block; padding: 0.75rem 1.5rem; cursor: pointer; font-weight: 500; color: var(--waas-text-muted, #6B7280); border-bottom: 2px solid transparent; transition: color 0.2s, border-color 0.2s; }
        .waas-tabs label:hover { color: var(--waas-text, #1A1A2E); }
        .waas-tabs .waas-tab-panel { display: none; padding: 1.5rem 0; color: var(--waas-text-muted, #6B7280); font-size: 0.9375rem; line-height: 1.7; }
        .waas-tabs #waas-tab1:checked ~ .waas-tab-nav label[for="waas-tab1"],
        .waas-tabs #waas-tab2:checked ~ .waas-tab-nav label[for="waas-tab2"],
        .waas-tabs #waas-tab3:checked ~ .waas-tab-nav label[for="waas-tab3"] { color: var(--waas-primary, #2563EB); border-bottom-color: var(--waas-primary, #2563EB); }
        .waas-tabs #waas-tab1:checked ~ .waas-tab-content .waas-tab-panel:nth-child(1),
        .waas-tabs #waas-tab2:checked ~ .waas-tab-content .waas-tab-panel:nth-child(2),
        .waas-tabs #waas-tab3:checked ~ .waas-tab-content .waas-tab-panel:nth-child(3) { display: block; }
      </style>
      <div class="waas-tabs">
        <input type="radio" name="waas-tab-group" id="waas-tab1" checked />
        <input type="radio" name="waas-tab-group" id="waas-tab2" />
        <input type="radio" name="waas-tab-group" id="waas-tab3" />
        <div class="waas-tab-nav" style="display: flex; border-bottom: 1px solid var(--waas-border, #E5E7EB);">
          <label for="waas-tab1">About Us</label>
          <label for="waas-tab2">Our Process</label>
          <label for="waas-tab3">Why Us</label>
        </div>
        <div class="waas-tab-content">
          <div class="waas-tab-panel">
            We are a dedicated team focused on delivering top-quality products and services to businesses across India. With over a decade of experience, we understand the unique needs of the Indian market and strive to exceed expectations every day.
          </div>
          <div class="waas-tab-panel">
            Our process is simple and transparent: 1) You share your requirements, 2) We provide a detailed quote within 24 hours, 3) Upon approval, we begin production, 4) Quality check and timely delivery to your doorstep.
          </div>
          <div class="waas-tab-panel">
            What sets us apart is our commitment to quality, competitive pricing, and exceptional after-sales support. We have served over 500 businesses and maintain a 98% customer satisfaction rate.
          </div>
        </div>
      </div>
    </section>`,
    attributes: { class: 'fa fa-folder-o' },
  })

  // 4. Before/After — side-by-side comparison with CSS resize slider
  bm.add('julley-before-after', {
    label: 'Before / After',
    category: 'Interactive',
    content: `<section style="padding: 3rem 2rem;">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 2rem; color: var(--waas-text, #1A1A2E);">Before &amp; After</h2>
      <div style="display: flex; gap: 0; max-width: 800px; margin: 0 auto; border-radius: var(--waas-radius, 0.5rem); overflow: hidden; box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); border: 1px solid var(--waas-border, #E5E7EB);">
        <div style="width: 50%; min-height: 300px; background: #FEE2E2; display: flex; align-items: center; justify-content: center; position: relative; resize: horizontal; overflow: auto;">
          <div style="position: absolute; top: 0.75rem; left: 0.75rem; padding: 0.25rem 0.75rem; background: rgba(0,0,0,0.6); color: white; border-radius: 999px; font-size: 0.75rem; font-weight: 600;">Before</div>
          <span style="color: #9CA3AF; font-size: 0.875rem;">Before Image</span>
        </div>
        <div style="flex: 1; min-height: 300px; background: #DCFCE7; display: flex; align-items: center; justify-content: center; position: relative;">
          <div style="position: absolute; top: 0.75rem; right: 0.75rem; padding: 0.25rem 0.75rem; background: rgba(0,0,0,0.6); color: white; border-radius: 999px; font-size: 0.75rem; font-weight: 600;">After</div>
          <span style="color: #9CA3AF; font-size: 0.875rem;">After Image</span>
        </div>
      </div>
      <p style="text-align: center; color: var(--waas-text-muted, #9CA3AF); font-size: 0.75rem; margin-top: 0.75rem;">Drag the right edge of the left panel to compare</p>
    </section>`,
    attributes: { class: 'fa fa-columns' },
  })

  // 5. Countdown Timer — with inline script for live updating
  bm.add('julley-countdown', {
    label: 'Countdown Timer',
    category: 'Interactive',
    content: `<section style="padding: 3rem 2rem; text-align: center;" data-countdown-target="2026-12-31T23:59:59">
      <h2 style="font-size: 1.75rem; margin-bottom: 0.5rem; color: var(--waas-text, #1A1A2E);">Offer Ends In</h2>
      <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.875rem; margin-bottom: 2rem;">Don't miss out on this limited-time deal!</p>
      <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;" id="waas-countdown-display">
        <div style="padding: 1.25rem 1.5rem; background: var(--waas-surface, #F8FAFC); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); min-width: 80px;">
          <div style="font-size: 2rem; font-weight: 700; color: var(--waas-primary, #2563EB);" data-cd="days">00</div>
          <div style="font-size: 0.75rem; color: var(--waas-text-muted, #6B7280); text-transform: uppercase; letter-spacing: 0.05em;">Days</div>
        </div>
        <div style="padding: 1.25rem 1.5rem; background: var(--waas-surface, #F8FAFC); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); min-width: 80px;">
          <div style="font-size: 2rem; font-weight: 700; color: var(--waas-primary, #2563EB);" data-cd="hours">00</div>
          <div style="font-size: 0.75rem; color: var(--waas-text-muted, #6B7280); text-transform: uppercase; letter-spacing: 0.05em;">Hours</div>
        </div>
        <div style="padding: 1.25rem 1.5rem; background: var(--waas-surface, #F8FAFC); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); min-width: 80px;">
          <div style="font-size: 2rem; font-weight: 700; color: var(--waas-primary, #2563EB);" data-cd="minutes">00</div>
          <div style="font-size: 0.75rem; color: var(--waas-text-muted, #6B7280); text-transform: uppercase; letter-spacing: 0.05em;">Minutes</div>
        </div>
        <div style="padding: 1.25rem 1.5rem; background: var(--waas-surface, #F8FAFC); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); min-width: 80px;">
          <div style="font-size: 2rem; font-weight: 700; color: var(--waas-primary, #2563EB);" data-cd="seconds">00</div>
          <div style="font-size: 0.75rem; color: var(--waas-text-muted, #6B7280); text-transform: uppercase; letter-spacing: 0.05em;">Seconds</div>
        </div>
      </div>
      <script>
        (function(){
          var sec = document.currentScript.closest('section');
          var target = new Date(sec.getAttribute('data-countdown-target')).getTime();
          function update(){
            var now = Date.now();
            var diff = Math.max(0, target - now);
            var d = Math.floor(diff / 86400000);
            var h = Math.floor((diff % 86400000) / 3600000);
            var m = Math.floor((diff % 3600000) / 60000);
            var s = Math.floor((diff % 60000) / 1000);
            var el = sec.querySelector('#waas-countdown-display');
            if(!el) return;
            var parts = el.querySelectorAll('[data-cd]');
            parts.forEach(function(p){
              var k = p.getAttribute('data-cd');
              if(k==='days') p.textContent = String(d).padStart(2,'0');
              if(k==='hours') p.textContent = String(h).padStart(2,'0');
              if(k==='minutes') p.textContent = String(m).padStart(2,'0');
              if(k==='seconds') p.textContent = String(s).padStart(2,'0');
            });
          }
          update();
          setInterval(update, 1000);
        })();
      </script>
    </section>`,
    attributes: { class: 'fa fa-hourglass-half' },
  })

  // 6. Animated Counter — cards with count-up animation via script
  bm.add('julley-counter', {
    label: 'Animated Counter',
    category: 'Interactive',
    content: `<section style="padding: 3rem 2rem; background: var(--waas-surface, #F8FAFC);">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 2.5rem; color: var(--waas-text, #1A1A2E);">Our Impact</h2>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem; max-width: 960px; margin: 0 auto;" class="waas-counter-grid">
        <div style="padding: 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); text-align: center;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--waas-primary, #2563EB); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem; color: white; font-size: 1.25rem;">&#128100;</div>
          <div style="font-size: 2rem; font-weight: 700; color: var(--waas-primary, #2563EB);" data-counter-target="500">0</div>
          <div style="color: var(--waas-text-muted, #6B7280); font-size: 0.8125rem; margin-top: 0.25rem;">Happy Clients</div>
        </div>
        <div style="padding: 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); text-align: center;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--waas-primary, #2563EB); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem; color: white; font-size: 1.25rem;">&#128640;</div>
          <div style="font-size: 2rem; font-weight: 700; color: var(--waas-primary, #2563EB);" data-counter-target="1200">0</div>
          <div style="color: var(--waas-text-muted, #6B7280); font-size: 0.8125rem; margin-top: 0.25rem;">Projects Done</div>
        </div>
        <div style="padding: 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); text-align: center;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--waas-primary, #2563EB); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem; color: white; font-size: 1.25rem;">&#9733;</div>
          <div style="font-size: 2rem; font-weight: 700; color: var(--waas-primary, #2563EB);" data-counter-target="98">0</div>
          <div style="color: var(--waas-text-muted, #6B7280); font-size: 0.8125rem; margin-top: 0.25rem;">% Satisfaction</div>
        </div>
        <div style="padding: 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); text-align: center;">
          <div style="width: 48px; height: 48px; border-radius: 50%; background: var(--waas-primary, #2563EB); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem; color: white; font-size: 1.25rem;">&#127760;</div>
          <div style="font-size: 2rem; font-weight: 700; color: var(--waas-primary, #2563EB);" data-counter-target="15">0</div>
          <div style="color: var(--waas-text-muted, #6B7280); font-size: 0.8125rem; margin-top: 0.25rem;">Cities Served</div>
        </div>
      </div>
      <script>
        (function(){
          var sec = document.currentScript.closest('section');
          var els = sec.querySelectorAll('[data-counter-target]');
          var animated = false;
          function animateCounters(){
            if(animated) return;
            animated = true;
            els.forEach(function(el){
              var target = parseInt(el.getAttribute('data-counter-target'), 10);
              var duration = 2000;
              var start = 0;
              var startTime = null;
              function step(ts){
                if(!startTime) startTime = ts;
                var progress = Math.min((ts - startTime) / duration, 1);
                var eased = 1 - Math.pow(1 - progress, 3);
                el.textContent = Math.floor(eased * target);
                if(progress < 1) requestAnimationFrame(step);
                else el.textContent = target;
              }
              requestAnimationFrame(step);
            });
          }
          if('IntersectionObserver' in window){
            var obs = new IntersectionObserver(function(entries){
              entries.forEach(function(e){
                if(e.isIntersecting){ animateCounters(); obs.disconnect(); }
              });
            }, { threshold: 0.3 });
            obs.observe(sec);
          } else {
            animateCounters();
          }
        })();
      </script>
    </section>`,
    attributes: { class: 'fa fa-sort-numeric-asc' },
  })

  // 7. Testimonial Carousel — CSS scroll-snap horizontal
  bm.add('julley-carousel', {
    label: 'Testimonial Carousel',
    category: 'Interactive',
    content: `<section style="padding: 3rem 2rem;">
      <h2 style="text-align: center; font-size: 1.75rem; margin-bottom: 2rem; color: var(--waas-text, #1A1A2E);">What People Say</h2>
      <div style="display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 1.5rem; padding: 0.5rem 0 1.5rem; max-width: 960px; margin: 0 auto; scrollbar-width: thin; scrollbar-color: var(--waas-border, #E5E7EB) transparent;">
        <!-- Card 1 -->
        <div style="min-width: 300px; max-width: 300px; flex-shrink: 0; scroll-snap-align: start; padding: 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); border: 1px solid var(--waas-border, #E5E7EB);">
          <div style="font-size: 1.5rem; color: var(--waas-primary, #2563EB); margin-bottom: 0.75rem;">&#10077;</div>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.9375rem; line-height: 1.6; margin-bottom: 1.25rem; font-style: italic;">Excellent quality and prompt delivery. The team was very professional and went above and beyond our expectations.</p>
          <div>
            <p style="font-weight: 600; color: var(--waas-text, #1A1A2E); font-size: 0.9375rem; margin-bottom: 0.125rem;">Anita Desai</p>
            <p style="color: var(--waas-text-muted, #9CA3AF); font-size: 0.8125rem;">CEO, TechVentures India</p>
          </div>
        </div>
        <!-- Card 2 -->
        <div style="min-width: 300px; max-width: 300px; flex-shrink: 0; scroll-snap-align: start; padding: 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); border: 1px solid var(--waas-border, #E5E7EB);">
          <div style="font-size: 1.5rem; color: var(--waas-primary, #2563EB); margin-bottom: 0.75rem;">&#10077;</div>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.9375rem; line-height: 1.6; margin-bottom: 1.25rem; font-style: italic;">We have been working with them for 3 years now. Consistently reliable and their pricing is very competitive in the market.</p>
          <div>
            <p style="font-weight: 600; color: var(--waas-text, #1A1A2E); font-size: 0.9375rem; margin-bottom: 0.125rem;">Vikram Singh</p>
            <p style="color: var(--waas-text-muted, #9CA3AF); font-size: 0.8125rem;">Director, BuildRight Pvt Ltd</p>
          </div>
        </div>
        <!-- Card 3 -->
        <div style="min-width: 300px; max-width: 300px; flex-shrink: 0; scroll-snap-align: start; padding: 1.5rem; background: var(--waas-bg, white); border-radius: var(--waas-radius, 0.5rem); box-shadow: var(--waas-shadow, 0 1px 3px rgba(0,0,0,0.08)); border: 1px solid var(--waas-border, #E5E7EB);">
          <div style="font-size: 1.5rem; color: var(--waas-primary, #2563EB); margin-bottom: 0.75rem;">&#10077;</div>
          <p style="color: var(--waas-text-muted, #6B7280); font-size: 0.9375rem; line-height: 1.6; margin-bottom: 1.25rem; font-style: italic;">The WhatsApp support is a game-changer. Quick responses and they always follow through on commitments. Highly recommended!</p>
          <div>
            <p style="font-weight: 600; color: var(--waas-text, #1A1A2E); font-size: 0.9375rem; margin-bottom: 0.125rem;">Meera Patel</p>
            <p style="color: var(--waas-text-muted, #9CA3AF); font-size: 0.8125rem;">Owner, Patel Enterprises</p>
          </div>
        </div>
      </div>
      <div style="display: flex; justify-content: center; gap: 0.5rem; margin-top: 0.5rem;">
        <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--waas-primary, #2563EB);"></span>
        <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--waas-border, #E5E7EB);"></span>
        <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--waas-border, #E5E7EB);"></span>
      </div>
    </section>`,
    attributes: { class: 'fa fa-comments' },
  })

  // 8. Sticky CTA — floating bottom bar, mobile-only
  bm.add('julley-sticky-cta', {
    label: 'Floating CTA',
    category: 'Interactive',
    content: `<div class="waas-sticky-cta" style="position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999; display: none;">
      <style>
        @media (max-width: 768px) {
          .waas-sticky-cta { display: flex !important; }
        }
      </style>
      <div style="display: flex; width: 100%; box-shadow: 0 -2px 10px rgba(0,0,0,0.15);">
        <a href="tel:+919876543210" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.875rem; background: var(--waas-primary, #2563EB); color: white; text-decoration: none; font-weight: 600; font-size: 0.9375rem;">
          &#128222; Call Now
        </a>
        <a href="https://wa.me/919876543210" target="_blank" rel="noopener noreferrer" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.875rem; background: #25D366; color: white; text-decoration: none; font-weight: 600; font-size: 0.9375rem;">
          &#128172; WhatsApp
        </a>
      </div>
    </div>`,
    attributes: { class: 'fa fa-mobile' },
  })
}
