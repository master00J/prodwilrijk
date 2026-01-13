// This script can be run with: npx tsx scripts/match-stock-erp-link.js
// Or: node scripts/match-stock-erp-link.js (if node is in PATH)

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Paths to files
const stockGenkPath = 'C:\\Users\\j.ploegaerts\\Desktop\\Oilfree V2\\Stock Files\\Stock Genk.xlsx';
// Try to find ERP LINK file in common locations
const erpLinkPaths = [
  'C:\\Users\\j.ploegaerts\\Desktop\\Oilfree V2\\ERP link.xlsx', // Found in directory listing
  'C:\\Users\\j.ploegaerts\\Desktop\\Oilfree V2\\ERP LINK.xlsx',
  'C:\\Users\\j.ploegaerts\\Desktop\\Oilfree V2\\ERPLINK.xlsx',
  'C:\\Users\\j.ploegaerts\\Desktop\\Oilfree V2\\erp_link.xlsx',
  'C:\\Users\\j.ploegaerts\\Desktop\\Oilfree V2\\ERP-LINK.xlsx',
];

console.log('=== STOCK GENK vs ERP LINK MATCHING ===\n');

// Function to parse stock file (same logic as upload-multiple/route.ts)
function parseStockFile(filePath) {
  console.log(`Reading stock file: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  
  const results = [];
  let startRow = 0;
  const headerKeywords = ['erp', 'code', 'quantity', 'aantal', 'qty', 'stock', 'voorraad', 'no.', 'inventory', 'consumption'];
  
  // Detect header row
  for (let checkRow = 0; checkRow < Math.min(5, range.e.r + 1); checkRow++) {
    const rowCells = [];
    for (let c = 0; c < Math.min(5, range.e.c + 1); c++) {
      const cell = XLSX.utils.encode_cell({ r: checkRow, c });
      const cellValue = worksheet[cell];
      if (cellValue) {
        rowCells.push(String(cellValue.v || '').toLowerCase());
      }
    }
    const isHeaderRow = rowCells.some(cell => 
      headerKeywords.some(keyword => cell.includes(keyword))
    );
    if (isHeaderRow) {
      startRow = checkRow + 1;
      console.log(`Detected header row at row ${checkRow + 1}, starting data from row ${startRow + 1}`);
      break;
    }
  }
  
  // Process data rows
  for (let rowNum = startRow; rowNum <= range.e.r; rowNum++) {
    const colA = XLSX.utils.encode_cell({ r: rowNum, c: 0 });
    const colACell = worksheet[colA];
    const colAValue = colACell ? String(colACell.v || '').trim() : '';
    
    const colB = XLSX.utils.encode_cell({ r: rowNum, c: 1 });
    const colBCell = worksheet[colB];
    const colBValue = colBCell ? String(colBCell.v || '').trim() : '';
    
    let erpCode = '';
    
    if (colAValue) {
      const gpMatch = colAValue.match(/\b(GP\d+)\b/i);
      if (gpMatch) {
        erpCode = gpMatch[1].toUpperCase();
      } else if (colAValue.match(/^[A-Z]{2,}\d+/i)) {
        erpCode = colAValue.toUpperCase().trim();
      } else {
        const parts = colAValue.split(/\s+/);
        if (parts.length > 1) {
          for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i].trim();
            if (part.match(/^[A-Z]{2,}\d+/i)) {
              erpCode = part.toUpperCase();
              break;
            }
          }
        }
      }
    }
    
    if (!erpCode && colBValue) {
      const gpMatchB = colBValue.match(/\b(GP\d+)\b/i);
      if (gpMatchB) {
        erpCode = gpMatchB[1].toUpperCase();
      } else if (colBValue.match(/^[A-Z]{2,}\d+/i)) {
        erpCode = colBValue.toUpperCase();
      }
    }
    
    if (!erpCode || 
        erpCode.toLowerCase() === 'erp code' || 
        erpCode.toLowerCase() === 'erp_code' || 
        erpCode.toLowerCase() === 'no.' ||
        erpCode.toLowerCase() === 'no' ||
        erpCode.length < 3) {
      continue;
    }
    
    const colC = XLSX.utils.encode_cell({ r: rowNum, c: 2 });
    const quantityCell = worksheet[colC];
    let quantity = 0;
    
    if (quantityCell) {
      const cellValue = quantityCell.v;
      if (typeof cellValue === 'number') {
        quantity = Math.floor(Math.abs(cellValue));
      } else if (typeof cellValue === 'string') {
        let cleanStr = cellValue.replace(/\s/g, '').trim();
        if (cleanStr.endsWith(',') && !cleanStr.includes('.')) {
          cleanStr = cleanStr.replace(/,$/, '');
        }
        cleanStr = cleanStr.replace(',', '.');
        cleanStr = cleanStr.replace(/[^\d.-]/g, '');
        const parsed = parseFloat(cleanStr);
        quantity = isNaN(parsed) ? 0 : Math.floor(Math.abs(parsed));
      }
    }
    
    if (erpCode) {
      results.push({
        erp_code: erpCode,
        quantity: quantity,
        original_colA: colAValue,
        original_colB: colBValue,
      });
    }
  }
  
  return results;
}

// Function to parse ERP LINK file (same logic as upload/route.ts)
function parseERPLinkFile(filePath) {
  console.log(`Reading ERP LINK file: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  const results = [];
  
  // Skip header row (index 0), start from index 1
  for (let i = 1; i < rawData.length; i++) {
    const rowData = rawData[i];
    if (!rowData || rowData.length === 0) continue;
    
    // Kolom A (index 0) = kistnummer
    let kistnummer = rowData[0] ? String(rowData[0]).trim() : '';
    
    // Kolom B (index 1) = ERP code
    let rawErpCode = rowData[1] ? String(rowData[1]).trim() : '';
    
    // Normalize ERP code
    let erp_code = '';
    if (rawErpCode) {
      const gpMatch = rawErpCode.match(/\b(GP\d+)\b/i);
      if (gpMatch) {
        erp_code = gpMatch[1].toUpperCase();
      } else if (rawErpCode.match(/^[A-Z]{2,}\d+/i)) {
        erp_code = rawErpCode.toUpperCase().trim();
      } else {
        const parts = rawErpCode.split(/\s+/);
        for (let i = parts.length - 1; i >= 0; i--) {
          const part = parts[i].trim();
          if (part.match(/^[A-Z]{2,}\d+/i)) {
            erp_code = part.toUpperCase();
            break;
          }
        }
        if (!erp_code) {
          erp_code = rawErpCode.toUpperCase().trim();
        }
      }
    }
    
    if (kistnummer && erp_code) {
      results.push({
        kistnummer: kistnummer,
        erp_code: erp_code,
        original_erp_code: rawErpCode,
      });
    }
  }
  
  return results;
}

// Main matching logic
try {
  // Check if files exist
  if (!fs.existsSync(stockGenkPath)) {
    console.error(`❌ Stock file not found: ${stockGenkPath}`);
    process.exit(1);
  }
  
  // Try to find ERP LINK file
  let erpLinkFile = null;
  for (const path of erpLinkPaths) {
    if (fs.existsSync(path)) {
      erpLinkFile = path;
      break;
    }
  }
  
  if (!erpLinkFile) {
    console.error(`❌ ERP LINK file not found. Tried:`);
    erpLinkPaths.forEach(p => console.error(`  - ${p}`));
    console.log('\nPlease update the erpLinkPaths array in the script with the correct path.');
    process.exit(1);
  }
  
  console.log(`Using ERP LINK file: ${erpLinkFile}`);
  
  // Parse files
  const stockData = parseStockFile(stockGenkPath);
  const erpLinkData = parseERPLinkFile(erpLinkFile);
  
  console.log(`\n=== PARSING RESULTS ===`);
  console.log(`Stock Genk: ${stockData.length} items parsed`);
  console.log(`ERP LINK: ${erpLinkData.length} items parsed`);
  
  // Create sets for matching
  const stockErpCodes = new Set(stockData.map(item => item.erp_code));
  const erpLinkErpCodes = new Set(erpLinkData.map(item => item.erp_code));
  
  // Create mapping: ERP code -> kistnummer
  const erpCodeToKistnummer = new Map();
  erpLinkData.forEach(item => {
    erpCodeToKistnummer.set(item.erp_code, item.kistnummer);
  });
  
  // Find matches
  const matchingCodes = [];
  const nonMatchingCodes = [];
  
  stockErpCodes.forEach(erpCode => {
    if (erpLinkErpCodes.has(erpCode)) {
      matchingCodes.push({
        erp_code: erpCode,
        kistnummer: erpCodeToKistnummer.get(erpCode),
        stock_count: stockData.filter(item => item.erp_code === erpCode).length,
      });
    } else {
      nonMatchingCodes.push(erpCode);
    }
  });
  
  console.log(`\n=== MATCHING RESULTS ===`);
  console.log(`✅ Matching ERP codes: ${matchingCodes.length}`);
  console.log(`❌ Non-matching ERP codes: ${nonMatchingCodes.length}`);
  
  if (matchingCodes.length > 0) {
    console.log(`\n✅ MATCHING CODES (first 20):`);
    matchingCodes.slice(0, 20).forEach(match => {
      console.log(`  ${match.erp_code} -> ${match.kistnummer} (${match.stock_count} stock items)`);
    });
  }
  
  if (nonMatchingCodes.length > 0) {
    console.log(`\n❌ NON-MATCHING CODES (first 20):`);
    nonMatchingCodes.slice(0, 20).forEach(code => {
      console.log(`  ${code}`);
    });
  }
  
  // Show sample from both files
  console.log(`\n=== SAMPLE DATA ===`);
  console.log(`\nStock Genk sample (first 10):`);
  stockData.slice(0, 10).forEach(item => {
    console.log(`  ERP: ${item.erp_code}, Qty: ${item.quantity}, ColA: "${item.original_colA}", ColB: "${item.original_colB}"`);
  });
  
  console.log(`\nERP LINK sample (first 10):`);
  erpLinkData.slice(0, 10).forEach(item => {
    console.log(`  Kistnummer: ${item.kistnummer}, ERP: ${item.erp_code}, Original: "${item.original_erp_code}"`);
  });
  
  // Check for potential normalization issues
  console.log(`\n=== NORMALIZATION CHECK ===`);
  const stockSample = stockData.slice(0, 5).map(item => item.erp_code);
  const erpLinkSample = erpLinkData.slice(0, 5).map(item => item.erp_code);
  console.log(`Stock sample codes:`, stockSample);
  console.log(`ERP LINK sample codes:`, erpLinkSample);
  
  // Check if any stock codes are similar to ERP LINK codes (potential normalization issue)
  console.log(`\n=== SIMILARITY CHECK ===`);
  stockSample.forEach(stockCode => {
    erpLinkSample.forEach(erpCode => {
      if (stockCode.toLowerCase().includes(erpCode.toLowerCase()) || 
          erpCode.toLowerCase().includes(stockCode.toLowerCase())) {
        console.log(`  ⚠️ Similar codes found: "${stockCode}" (stock) vs "${erpCode}" (ERP LINK)`);
      }
    });
  });
  
  console.log(`\n=== END REPORT ===\n`);
  
} catch (error) {
  console.error('Error:', error);
  process.exit(1);
}

