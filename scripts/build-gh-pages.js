const fs = require('fs');
const path = require('path');

// Copy data files to the output directory
function copyDataFiles() {
  const sourceDir = process.cwd();
  const outputDir = path.join(sourceDir, 'out');
  
  // Files to copy
  const filesToCopy = [
    'data.json',
    'data.csv'
  ];
  
  console.log('Copying data files to output directory...');
  
  filesToCopy.forEach(file => {
    const sourcePath = path.join(sourceDir, file);
    const destPath = path.join(outputDir, file);
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ Copied ${file} to output directory`);
    } else {
      console.log(`⚠️  Warning: ${file} not found in source directory`);
    }
  });
  
  console.log('Data files copy completed!');
}

// Run the copy function
copyDataFiles(); 