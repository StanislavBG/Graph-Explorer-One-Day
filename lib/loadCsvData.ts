import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

export function loadCsvData() {
  const csvPath = path.join(process.cwd(), 'data.csv');
  const file = fs.readFileSync(csvPath, 'utf8');
  const { data } = Papa.parse(file, { header: true, skipEmptyLines: true });
  return data;
} 