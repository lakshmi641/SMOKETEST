'use client';

import React, { useEffect, useRef, useState } from 'react';
// import BpmnModeler from 'bpmn-js/lib/Modeler'; // Removed static import

// ... imports ...
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import '@bpmn-io/properties-panel/assets/properties-panel.css';

interface BPMNModelerProps {
    xml?: string;
    onChange?: (xml: string) => void;
}

const EMPTY_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js (https://demo.bpmn.io)" exporterVersion="17.0.2">
  <bpmn:process id="Process_1" isExecutable="false" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export const BPMNModeler: React.FC<BPMNModelerProps> = ({ xml, onChange }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const propertiesPanelRef = useRef<HTMLDivElement>(null);
    const modelerRef = useRef<any | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        let modeler: any;

        const initModeler = async () => {
            const { default: BpmnModeler } = await import('bpmn-js/lib/Modeler');
            const {
                BpmnPropertiesPanelModule,
                BpmnPropertiesProviderModule,
            } = await import('bpmn-js-properties-panel');
            const { default: CamundaBpmnModdle } = await import('camunda-bpmn-moddle/resources/camunda.json');

            modeler = new BpmnModeler({
                container: containerRef.current,
                propertiesPanel: {
                    parent: propertiesPanelRef.current
                },
                additionalModules: [
                    BpmnPropertiesPanelModule,
                    BpmnPropertiesProviderModule
                ],
                moddleExtensions: {
                    camunda: CamundaBpmnModdle
                }
            });

            modelerRef.current = modeler;

            // Hook into changes
            modeler.on('commandStack.changed', async () => {
                try {
                    const { xml } = await modeler.saveXML({ format: true });
                    if (onChange && xml) {
                        onChange(xml);
                    }
                } catch (err) {
                    console.error('Error saving XML:', err);
                }
            });

            const handleResize = () => {
                const canvas = modeler.get('canvas') as any;
                canvas.resized();
            };
            window.addEventListener('resize', handleResize);

            // Import XML
            try {
                const xmlContent = xml || EMPTY_BPMN_XML;
                console.log('Importing XML:', xmlContent);
                await modeler.importXML(xmlContent);
                const canvas = modeler.get('canvas') as any;
                canvas.zoom('fit-viewport');
            } catch (err) {
                console.error('BPMN Import Error:', err);
            }
        };

        initModeler();

        return () => {
            if (modeler) {
                modeler.destroy();
            }
        };
    }, []); // Run once on mount

    return (
        <div className="flex h-[800px] border rounded bg-white relative">
            <style jsx global>{`
                .bjs-powered-by {
                    display: none !important;
                }
            `}</style>
            <div ref={containerRef} className="flex-1 h-full" />
            <div ref={propertiesPanelRef} className="w-[300px] border-l bg-gray-50 overflow-y-auto" />
        </div>
    );
};
