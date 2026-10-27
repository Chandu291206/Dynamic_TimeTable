/**
 * @file jsoncon.js
 * @description Node.js utility script that converts CSV files into a JSON array of objects.
 * 
 * Features:
 *  - Dynamic Column Handling: Automatically reads headers from the CSV and maps them as object keys.
 *  - Smart Data Type Conversion: Converts numeric strings (integers and floats) to Numbers, preserving text strings.
 *  - Handles CSV nuances: Quoted cells with commas, escaped quotes (""), CRLF/LF line breaks, UTF-8 BOM removal.
 *  - Robust Error Handling: Validates file existence and provides helpful feedback on missing files or read errors.
 * 
 * Usage via CLI:
 *   node jsoncon.js <path-to-csv> [path-to-output-json]
 *   Example: node jsoncon.js results.csv results.json
 * 
 * Usage as a Module:
 *   const { convertCsvFile, csvToJson } = require('./jsoncon');
 *   const data = convertCsvFile('path/to/file.csv');
 */

const fs = require('fs');
const path = require('path');

/**
 * Smartly converts a raw CSV cell string to its appropriate JavaScript type.
 * - Converts pure integers and floats into `Number`.
 * - Preserves numeric identifiers with leading zeros (e.g., "0123") as strings.
 * - Retains alphanumeric and text values as `String`.
 * 
 * @param {string} value - The raw string value from the CSV cell.
 * @returns {number|string} The type-cast value.
 */
function parseValue(value) {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();

  // Keep empty strings as empty
  if (trimmed === '') {
    return '';
  }

  // Preserve codes/IDs with leading zeros (e.g., "0123", "007")
  // but allow single "0" and decimals like "0.5" or "-0.5"
  if (/^-?0\d+$/.test(trimmed)) {
    return trimmed;
  }

  // Check if the string strictly represents a valid integer or floating-point number
  const isNumeric = /^-?\d+(\.\d+)?$/.test(trimmed);
  if (isNumeric) {
    const num = Number(trimmed);
    if (Number.isFinite(num)) {
      return num;
    }
  }

  // Default: retain original trimmed text value
  return trimmed;
}

/**
 * Parses raw CSV text into a 2D array of string cells.
 * Correctly accounts for:
 *  - Comma delimiters
 *  - Quoted fields containing commas or newlines
 *  - Escaped quotes within quoted fields ("")
 *  - Both Windows (\r\n) and Unix (\n) line breaks
 *  - UTF-8 Byte Order Mark (BOM)
 * 
 * @param {string} csvText - The raw content of the CSV file.
 * @returns {Array<Array<string>>} 2D array representing rows and their cell values.
 */
function parseCSV(csvText) {
  // Strip UTF-8 BOM if present
  const content = csvText.replace(/^\uFEFF/, '');
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped double quote ("") inside quotes becomes a literal quote
        currentCell += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // Cell delimiter
      currentRow.push(currentCell);
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      // Line break delimiter
      if (char === '\r' && nextChar === '\n') {
        i++; // Skip LF in CRLF pair
      }
      currentRow.push(currentCell);
      currentCell = '';

      // Only push non-empty rows
      if (currentRow.some((cell) => cell.trim() !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentCell += char;
    }
  }

  // Push remaining cell and row if file does not end with a trailing newline
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some((cell) => cell.trim() !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Converts a CSV formatted string into an array of JSON objects.
 * Dynamically infers column names from the first row and casts values appropriately.
 * 
 * @param {string} csvText - Raw CSV content.
 * @returns {Array<Object>} Array of dynamically constructed row objects.
 */
function csvToJson(csvText) {
  const rows = parseCSV(csvText);

  if (!rows || rows.length === 0) {
    return [];
  }

  // Extract and clean dynamic header names from row 0
  const headers = rows[0].map((header) => header.trim());

  const result = [];

  // Map subsequent rows into objects keyed by header names
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowObj = {};

    headers.forEach((header, index) => {
      // In case a row has fewer columns than headers, default to empty string
      const rawValue = row[index] !== undefined ? row[index] : '';
      rowObj[header] = parseValue(rawValue);
    });

    result.push(rowObj);
  }

  return result;
}

/**
 * Reads a CSV file from disk, parses it to a JSON array of objects,
 * and optionally writes the JSON result to an output file.
 * 
 * @param {string} inputFilePath - Path to the input CSV file.
 * @param {string} [outputFilePath] - Optional path to save the generated JSON file.
 * @returns {Array<Object>} Parsed JSON array.
 * @throws {Error} If the file does not exist or cannot be read.
 */
function convertCsvFile(inputFilePath, outputFilePath) {
  if (!inputFilePath) {
    throw new Error('Input file path is required.');
  }

  const resolvedInputPath = path.resolve(inputFilePath);

  // Check if file exists before attempting to read
  if (!fs.existsSync(resolvedInputPath)) {
    throw new Error(`File not found: "${resolvedInputPath}". Please verify the file path and try again.`);
  }

  let csvContent;
  try {
    csvContent = fs.readFileSync(resolvedInputPath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read file at "${resolvedInputPath}": ${err.message}`);
  }

  const jsonResult = csvToJson(csvContent);

  // If an output path is provided, write the JSON to disk
  if (outputFilePath) {
    const resolvedOutputPath = path.resolve(outputFilePath);
    try {
      // Ensure destination directory exists
      const outputDir = path.dirname(resolvedOutputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(resolvedOutputPath, JSON.stringify(jsonResult, null, 2), 'utf8');
      console.log(`[Success] Converted ${jsonResult.length} rows -> Saved to "${resolvedOutputPath}"`);
    } catch (err) {
      throw new Error(`Failed to write output JSON to "${resolvedOutputPath}": ${err.message}`);
    }
  }

  return jsonResult;
}

// ==========================================
// CLI Execution Handler
// ==========================================
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
======================================================
  CSV to JSON Converter (Node.js Built-in)
======================================================
Usage:
  node jsoncon.js <input-csv-path> [output-json-path]

Examples:
  1. Print JSON array to console:
     node src/pages/results/jsoncon.js data.csv

  2. Convert and save to a JSON file:
     node src/pages/results/jsoncon.js data.csv results.json
======================================================
`);
    process.exit(0);
  }

  const inputPath = args[0];
  const outputPath = args[1] || null;

  try {
    const result = convertCsvFile(inputPath, outputPath);

    // If no output file was specified, print the JSON directly to stdout
    if (!outputPath) {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error(`\x1b[31m[Error] ${error.message}\x1b[0m`);
    process.exit(1);
  }
}

module.exports = {
  csvToJson,
  convertCsvFile,
  parseValue,
  parseCSV,
};
