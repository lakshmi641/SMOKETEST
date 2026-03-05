// Company configuration for PMS
export interface CompanyConfig {
  name: string;
  industry: string;
  description: string;
  logo?: string;
  primaryColor: string;
  secondaryColor: string;
  features: string[];
  equipmentTypes?: string[];
  manufacturingPhases?: string[];
  qualityStandards?: string[];
  complianceRequirements?: string[];
}

// Default Autocracy configuration
export const DEFAULT_COMPANY_CONFIG: CompanyConfig = {
  name: "Autocracy",
  industry: "Manufacturing & Technology",
  description: "Leading manufacturer of advanced industrial equipment and automation solutions",
  logo: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=150&h=150&fit=crop&crop=face",
  primaryColor: "#1e40af", // Blue
  secondaryColor: "#3b82f6", // Light Blue
  features: [
    "Advanced Manufacturing Solutions",
    "Automation & Robotics Integration", 
    "Quality Control & Compliance",
    "Smart Factory Management",
    "Supply Chain Optimization"
  ],
  equipmentTypes: [
    "Industrial Robots",
    "Automation Systems", 
    "Manufacturing Equipment",
    "Quality Control Systems",
    "Smart Sensors"
  ],
  manufacturingPhases: [
    "Design & Engineering",
    "Prototyping", 
    "Production Planning",
    "Manufacturing",
    "Quality Testing",
    "Packaging & Delivery"
  ],
  qualityStandards: [
    "ISO 9001",
    "ISO 14001", 
    "IATF 16949",
    "AS9100",
    "Six Sigma"
  ],
  complianceRequirements: [
    "OSHA",
    "FDA",
    "CE Marking",
    "RoHS Compliance",
    "REACH"
  ]
};

// Configuration context for easy access
export const COMPANY_CONFIG = DEFAULT_COMPANY_CONFIG;
