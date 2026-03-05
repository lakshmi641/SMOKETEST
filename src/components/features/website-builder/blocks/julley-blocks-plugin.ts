// GrapesJS custom blocks plugin for Julley WaaS
// Orchestrator: registers animation traits then delegates to category modules

import { registerLayoutBlocks } from './blocks-layout'
import { registerContentBlocks } from './blocks-content'
import { registerIndiaBlocks } from './blocks-india'
import { registerInteractiveBlocks } from './blocks-interactive'
import { registerBusinessBlocks } from './blocks-business'
import { registerTrustBlocks } from './blocks-trust'
import {
  ANIMATION_PRESETS,
  ANIMATION_SPEEDS,
  ANIMATION_DELAYS,
} from '../config/animation-presets'

export default function julleyBlocksPlugin(editor: any) {
  // Register animation traits for all <section> elements
  const animTraits = [
    {
      type: 'select',
      name: 'data-waas-anim',
      label: 'Scroll Animation',
      default: 'none',
      options: ANIMATION_PRESETS.map((p) => ({ id: p.value, label: p.label })),
    },
    {
      type: 'select',
      name: 'data-waas-speed',
      label: 'Animation Speed',
      default: 'normal',
      options: ANIMATION_SPEEDS.map((s) => ({ id: s.value, label: s.label })),
    },
    {
      type: 'select',
      name: 'data-waas-delay',
      label: 'Animation Delay',
      default: 'none',
      options: ANIMATION_DELAYS.map((d) => ({ id: d.value, label: d.label })),
    },
  ]

  editor.DomComponents.addType('waas-section', {
    isComponent: (el: HTMLElement) => el.tagName === 'SECTION',
    model: {
      defaults: {
        traits: animTraits,
      },
    },
  })

  // Register all block categories
  registerLayoutBlocks(editor)
  registerContentBlocks(editor)
  registerIndiaBlocks(editor)
  registerInteractiveBlocks(editor)
  registerBusinessBlocks(editor)
  registerTrustBlocks(editor)
}
