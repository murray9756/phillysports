const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

// PhillySports brand colors
const DARK_RED = '#8B0000';
const WHITE = '#FFFFFF';
const GOLD = '#FFD700';

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

async function createAppIcon() {
  // Create a 1024x1024 app icon with "PS" text on dark red background
  const size = 1024;
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#A00000"/>
          <stop offset="100%" style="stop-color:#600000"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)" rx="180"/>
      <text x="512" y="580" font-family="Arial Black, sans-serif" font-size="420" font-weight="900" fill="${WHITE}" text-anchor="middle">PS</text>
      <text x="512" y="780" font-family="Arial, sans-serif" font-size="100" font-weight="700" fill="${GOLD}" text-anchor="middle">PHILLY</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(assetsDir, 'icon.png'));

  console.log('✓ Created icon.png (1024x1024)');
}

async function createAdaptiveIcon() {
  // Android adaptive icon - foreground layer (transparent background)
  const size = 1024;
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <text x="512" y="560" font-family="Arial Black, sans-serif" font-size="380" font-weight="900" fill="${WHITE}" text-anchor="middle">PS</text>
      <text x="512" y="750" font-family="Arial, sans-serif" font-size="90" font-weight="700" fill="${GOLD}" text-anchor="middle">PHILLY</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(assetsDir, 'adaptive-icon.png'));

  console.log('✓ Created adaptive-icon.png (1024x1024)');
}

async function createSplashScreen() {
  // Splash screen - centered logo on dark red background
  const width = 1284;
  const height = 2778;
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="splashBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#A00000"/>
          <stop offset="50%" style="stop-color:#8B0000"/>
          <stop offset="100%" style="stop-color:#600000"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#splashBg)"/>

      <!-- Logo Circle Background -->
      <circle cx="${width/2}" cy="${height/2 - 100}" r="280" fill="rgba(0,0,0,0.2)"/>

      <!-- PS Text -->
      <text x="${width/2}" y="${height/2 - 20}" font-family="Arial Black, sans-serif" font-size="300" font-weight="900" fill="${WHITE}" text-anchor="middle">PS</text>

      <!-- PHILLY SPORTS Text -->
      <text x="${width/2}" y="${height/2 + 180}" font-family="Arial, sans-serif" font-size="72" font-weight="700" fill="${WHITE}" text-anchor="middle">PHILLY</text>
      <text x="${width/2}" y="${height/2 + 270}" font-family="Arial, sans-serif" font-size="72" font-weight="700" fill="${GOLD}" text-anchor="middle">SPORTS</text>

      <!-- Tagline -->
      <text x="${width/2}" y="${height/2 + 400}" font-family="Arial, sans-serif" font-size="36" fill="rgba(255,255,255,0.7)" text-anchor="middle">Your Home for Philly Sports</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(assetsDir, 'splash.png'));

  console.log('✓ Created splash.png (1284x2778)');
}

async function createFavicon() {
  // Create a small favicon for web
  const size = 196;
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${DARK_RED}" rx="24"/>
      <text x="${size/2}" y="${size/2 + 25}" font-family="Arial Black, sans-serif" font-size="90" font-weight="900" fill="${WHITE}" text-anchor="middle">PS</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(assetsDir, 'favicon.png'));

  console.log('✓ Created favicon.png (196x196)');
}

async function main() {
  console.log('Generating PhillySports app assets...\n');

  try {
    await createAppIcon();
    await createAdaptiveIcon();
    await createSplashScreen();
    await createFavicon();

    console.log('\n✅ All assets generated successfully!');
    console.log(`\nAssets saved to: ${assetsDir}`);
  } catch (error) {
    console.error('Error generating assets:', error);
    process.exit(1);
  }
}

main();
