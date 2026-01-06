import sharp from 'sharp';
import fs from 'fs/promises';

// SVG icon content
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="100" fill="#0f172a"/>
  <path d="M150 350 V 200" stroke="#3b82f6" stroke-width="50" stroke-linecap="round"/>
  <path d="M256 350 V 150" stroke="#8b5cf6" stroke-width="50" stroke-linecap="round"/>
  <path d="M362 350 V 250" stroke="#ec4899" stroke-width="50" stroke-linecap="round"/>
</svg>
`;

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  console.log('Generating PWA icons...');

  for (const size of sizes) {
    const filename = `icon-${size}x${size}.png`;

    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(filename);

    console.log(`✅ Generated ${filename}`);
  }

  console.log('\n✅ All icons generated successfully!');
}

generateIcons().catch(console.error);
