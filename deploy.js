const fs = require('fs');
const path = require('path');

console.log('🚀 Preparing for production deployment...');

// Check if production environment file exists
const prodEnvPath = path.join(__dirname, '.env.production');
if (!fs.existsSync(prodEnvPath)) {
    console.error('❌ .env.production file not found!');
    console.log('Please create .env.production with your production configuration');
    process.exit(1);
}

// Copy production env to .env
try {
    fs.copyFileSync(prodEnvPath, path.join(__dirname, '.env'));
    console.log('✅ Production environment variables loaded');
} catch (error) {
    console.error('❌ Failed to load production environment:', error.message);
    process.exit(1);
}

// Update HTML file to use production React
const htmlPath = path.join(__dirname, 'public', 'index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Replace development React with production version
htmlContent = htmlContent.replace(
    'react@18/umd/react.development.js',
    'react@18/umd/react.production.min.js'
);

htmlContent = htmlContent.replace(
    'react-dom@18/umd/react-dom.development.js',
    'react-dom@18/umd/react-dom.production.min.js'
);

fs.writeFileSync(htmlPath, htmlContent);
console.log('✅ HTML updated for production');

console.log('✅ Production deployment preparation complete!');
console.log('You can now run: npm start');