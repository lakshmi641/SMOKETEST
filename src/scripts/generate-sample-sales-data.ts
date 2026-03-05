/**
 * Script to generate a sample Excel file for sales data
 * 
 * This creates a sample sales day book Excel file that can be used for testing
 * Usage: tsx src/scripts/generate-sample-sales-data.ts
 */

import { writeFile } from 'fs/promises';
import { join } from 'path';
import { read, utils, write } from 'xlsx';

// Sample sales data
const sampleData = [
  // Header row
  {
    'Date': 'Date',
    'Invoice Number': 'Invoice Number',
    'Customer Name': 'Customer Name',
    'Customer Code': 'Customer Code',
    'Product Name': 'Product Name',
    'Product Code': 'Product Code',
    'Quantity': 'Quantity',
    'Unit Price': 'Unit Price',
    'Total Amount': 'Total Amount',
    'Tax Amount': 'Tax Amount',
    'Discount Amount': 'Discount Amount',
    'Payment Method': 'Payment Method',
    'Sales Person': 'Sales Person',
    'Region': 'Region',
    'Category': 'Category',
    'Notes': 'Notes',
  },
  // Sample transactions
  {
    'Date': '2024-01-15',
    'Invoice Number': 'INV-2024-001',
    'Customer Name': 'ABC Manufacturing Ltd',
    'Customer Code': 'CUST-001',
    'Product Name': 'Industrial Gear Box',
    'Product Code': 'PROD-GB-001',
    'Quantity': 5,
    'Unit Price': 50000,
    'Total Amount': 250000,
    'Tax Amount': 45000,
    'Discount Amount': 5000,
    'Payment Method': 'Bank Transfer',
    'Sales Person': 'Rajesh Kumar',
    'Region': 'North',
    'Category': 'Machinery',
    'Notes': 'Urgent delivery required',
  },
  {
    'Date': '2024-01-16',
    'Invoice Number': 'INV-2024-002',
    'Customer Name': 'XYZ Industries',
    'Customer Code': 'CUST-002',
    'Product Name': 'Conveyor Belt System',
    'Product Code': 'PROD-CB-002',
    'Quantity': 2,
    'Unit Price': 150000,
    'Total Amount': 300000,
    'Tax Amount': 54000,
    'Discount Amount': 0,
    'Payment Method': 'Cheque',
    'Sales Person': 'Priya Sharma',
    'Region': 'South',
    'Category': 'Equipment',
    'Notes': '',
  },
  {
    'Date': '2024-01-17',
    'Invoice Number': 'INV-2024-003',
    'Customer Name': 'DEF Engineering Pvt Ltd',
    'Customer Code': 'CUST-003',
    'Product Name': 'Hydraulic Pump',
    'Product Code': 'PROD-HP-003',
    'Quantity': 10,
    'Unit Price': 25000,
    'Total Amount': 250000,
    'Tax Amount': 45000,
    'Discount Amount': 10000,
    'Payment Method': 'Cash',
    'Sales Person': 'Amit Patel',
    'Region': 'West',
    'Category': 'Components',
    'Notes': 'Bulk order discount applied',
  },
  {
    'Date': '2024-01-18',
    'Invoice Number': 'INV-2024-004',
    'Customer Name': 'ABC Manufacturing Ltd',
    'Customer Code': 'CUST-001',
    'Product Name': 'Motor Controller',
    'Product Code': 'PROD-MC-004',
    'Quantity': 8,
    'Unit Price': 15000,
    'Total Amount': 120000,
    'Tax Amount': 21600,
    'Discount Amount': 0,
    'Payment Method': 'Bank Transfer',
    'Sales Person': 'Rajesh Kumar',
    'Region': 'North',
    'Category': 'Electronics',
    'Notes': '',
  },
  {
    'Date': '2024-01-19',
    'Invoice Number': 'INV-2024-005',
    'Customer Name': 'GHI Motors',
    'Customer Code': 'CUST-004',
    'Product Name': 'Steel Frame Assembly',
    'Product Code': 'PROD-SF-005',
    'Quantity': 3,
    'Unit Price': 80000,
    'Total Amount': 240000,
    'Tax Amount': 43200,
    'Discount Amount': 12000,
    'Payment Method': 'Credit',
    'Sales Person': 'Priya Sharma',
    'Region': 'South',
    'Category': 'Fabrication',
    'Notes': '30 days credit terms',
  },
  {
    'Date': '2024-01-20',
    'Invoice Number': 'INV-2024-006',
    'Customer Name': 'JKL Auto Parts',
    'Customer Code': 'CUST-005',
    'Product Name': 'Bearing Set',
    'Product Code': 'PROD-BS-006',
    'Quantity': 50,
    'Unit Price': 2000,
    'Total Amount': 100000,
    'Tax Amount': 18000,
    'Discount Amount': 5000,
    'Payment Method': 'Bank Transfer',
    'Sales Person': 'Amit Patel',
    'Region': 'East',
    'Category': 'Components',
    'Notes': 'Standard delivery',
  },
  {
    'Date': '2024-01-21',
    'Invoice Number': 'INV-2024-007',
    'Customer Name': 'XYZ Industries',
    'Customer Code': 'CUST-002',
    'Product Name': 'Control Panel',
    'Product Code': 'PROD-CP-007',
    'Quantity': 4,
    'Unit Price': 60000,
    'Total Amount': 240000,
    'Tax Amount': 43200,
    'Discount Amount': 0,
    'Payment Method': 'Cheque',
    'Sales Person': 'Priya Sharma',
    'Region': 'South',
    'Category': 'Electronics',
    'Notes': '',
  },
  {
    'Date': '2024-01-22',
    'Invoice Number': 'INV-2024-008',
    'Customer Name': 'MNO Textiles',
    'Customer Code': 'CUST-006',
    'Product Name': 'Textile Machine Part',
    'Product Code': 'PROD-TM-008',
    'Quantity': 12,
    'Unit Price': 12000,
    'Total Amount': 144000,
    'Tax Amount': 25920,
    'Discount Amount': 7200,
    'Payment Method': 'Cash',
    'Sales Person': 'Rajesh Kumar',
    'Region': 'North',
    'Category': 'Spare Parts',
    'Notes': 'Regular customer',
  },
  {
    'Date': '2024-01-23',
    'Invoice Number': 'INV-2024-009',
    'Customer Name': 'DEF Engineering Pvt Ltd',
    'Customer Code': 'CUST-003',
    'Product Name': 'Valve Assembly',
    'Product Code': 'PROD-VA-009',
    'Quantity': 6,
    'Unit Price': 35000,
    'Total Amount': 210000,
    'Tax Amount': 37800,
    'Discount Amount': 10500,
    'Payment Method': 'Bank Transfer',
    'Sales Person': 'Amit Patel',
    'Region': 'West',
    'Category': 'Components',
    'Notes': '',
  },
  {
    'Date': '2024-01-24',
    'Invoice Number': 'INV-2024-010',
    'Customer Name': 'PQR Chemicals',
    'Customer Code': 'CUST-007',
    'Product Name': 'Chemical Pump',
    'Product Code': 'PROD-CP-010',
    'Quantity': 2,
    'Unit Price': 180000,
    'Total Amount': 360000,
    'Tax Amount': 64800,
    'Discount Amount': 18000,
    'Payment Method': 'Credit',
    'Sales Person': 'Priya Sharma',
    'Region': 'South',
    'Category': 'Equipment',
    'Notes': 'Specialized equipment',
  },
];

async function generateSampleFile() {
  try {
    // Create workbook
    const workbook = utils.book_new();
    
    // Convert data to worksheet
    const worksheet = utils.json_to_sheet(sampleData, { skipHeader: false });
    
    // Set column widths for better readability
    const colWidths = [
      { wch: 12 }, // Date
      { wch: 15 }, // Invoice Number
      { wch: 25 }, // Customer Name
      { wch: 15 }, // Customer Code
      { wch: 25 }, // Product Name
      { wch: 15 }, // Product Code
      { wch: 10 }, // Quantity
      { wch: 12 }, // Unit Price
      { wch: 15 }, // Total Amount
      { wch: 12 }, // Tax Amount
      { wch: 15 }, // Discount Amount
      { wch: 15 }, // Payment Method
      { wch: 15 }, // Sales Person
      { wch: 10 }, // Region
      { wch: 15 }, // Category
      { wch: 30 }, // Notes
    ];
    worksheet['!cols'] = colWidths;
    
    // Add worksheet to workbook
    utils.book_append_sheet(workbook, worksheet, 'Sales Data');
    
    // Write to file
    const outputPath = join(process.cwd(), 'sample-sales-data.xlsx');
    await writeFile(outputPath, write(workbook, { type: 'buffer', bookType: 'xlsx' }));
    
    console.log('✅ Sample sales data file created successfully!');
    console.log(`📁 File location: ${outputPath}`);
    console.log(`\n📊 File contains ${sampleData.length - 1} sample transactions`);
    console.log('\n📋 Columns included:');
    console.log('  - Date (required)');
    console.log('  - Invoice Number');
    console.log('  - Customer Name, Customer Code');
    console.log('  - Product Name, Product Code');
    console.log('  - Quantity, Unit Price');
    console.log('  - Total Amount (required)');
    console.log('  - Tax Amount, Discount Amount');
    console.log('  - Payment Method');
    console.log('  - Sales Person');
    console.log('  - Region, Category');
    console.log('  - Notes');
    console.log('\n💡 You can now upload this file through the Data Management page!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating sample file:', error);
    process.exit(1);
  }
}

generateSampleFile();

