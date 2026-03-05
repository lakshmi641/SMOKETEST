/**
 * Data Object Definitions
 * 
 * This file contains only the data object definitions without any ClickHouse dependencies.
 * This allows it to be safely imported in client components.
 */

export interface DataObject {
  id: string;
  name: string;
  displayName: string;
  description: string;
  tableName: string;
  icon?: string;
}

/**
 * Available data objects
 */
export const DATA_OBJECTS: DataObject[] = [
  {
    id: 'fact_sales',
    name: 'Sales Transactions',
    displayName: 'Sales Transactions',
    description: 'Sales transaction data from day books (star schema)',
    tableName: 'analytics.fact_sales',
  },
  // Add more data objects here as needed
];

/**
 * Get all available data objects
 */
export function getDataObjects(): DataObject[] {
  return DATA_OBJECTS;
}

/**
 * Get a data object by ID
 */
export function getDataObjectById(id: string): DataObject | undefined {
  return DATA_OBJECTS.find(obj => obj.id === id);
}

