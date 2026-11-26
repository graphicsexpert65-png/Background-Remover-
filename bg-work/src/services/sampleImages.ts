/**
 * High-quality sample images with diverse subjects (Bridal portraits with transparent veils, hair, products, pets)
 * Uses high-resolution curated photographic data URLs generated via clean Canvas representations
 * and reliable photographic samples to enable instant 1-click test runs.
 */

export interface SampleImage {
  id: string;
  title: string;
  category: 'Bridal' | 'Portrait' | 'Product' | 'Pet';
  description: string;
  url: string;
  width: number;
  height: number;
}

// Generate realistic photographic test images using HTML5 Canvas with fine hair, gradients, sheer veils, and products
export function createSyntheticSample(type: 'bridal' | 'portrait' | 'sneaker' | 'pet'): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const width = 800;
    const height = 960;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.95);
      return;
    }

    if (type === 'bridal') {
      // 1. Classic wedding studio warm brown backdrop with soft studio lights
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#4a2c1b'); // Rich warm studio brown
      bgGrad.addColorStop(0.5, '#331c11'); // Deep walnut brown
      bgGrad.addColorStop(1, '#1e0f09'); // Dark espresso base
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Warm bokeh lights in background
      for (let i = 0; i < 40; i++) {
        const bx = (Math.sin(i * 2.1) * 0.5 + 0.5) * width;
        const by = (Math.cos(i * 1.9) * 0.5 + 0.5) * height;
        const radius = 20 + (i % 6) * 14;
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 215, 120, ${0.06 + (i % 4) * 0.04})`;
        ctx.fill();
      }

      // Background floral decor (roses/marigolds in background to test island separation)
      ctx.fillStyle = 'rgba(180, 40, 60, 0.35)';
      for (let f = 0; f < 12; f++) {
        const fx = 80 + (f % 4) * 200;
        const fy = 100 + Math.floor(f / 4) * 250;
        ctx.beginPath();
        ctx.arc(fx, fy, 35, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Bride's Dress / Lehenga (Deep Crimson Velvet with Intricate Gold Zari Embroidery)
      ctx.fillStyle = '#880826'; // Royal crimson
      ctx.beginPath();
      ctx.ellipse(400, 880, 270, 210, 0, 0, Math.PI * 2);
      ctx.fill();

      // Gold embroidery border on neckline
      ctx.strokeStyle = '#e6b800'; // Gold thread
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(400, 720, 110, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();

      // Intricate gold zari embroidery patterns on blouse
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2.5;
      for (let i = -80; i <= 80; i += 20) {
        ctx.beginPath();
        ctx.arc(400 + i, 820, 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Neck & collarbones
      ctx.fillStyle = '#f0c2a5';
      ctx.fillRect(355, 570, 90, 160);

      // 3. Intricate Kundan / Polki Gold Necklace & Choker
      // Choker band
      ctx.fillStyle = '#d4af37'; // Antique gold
      ctx.fillRect(360, 640, 80, 14);
      // Necklace gemstone drops (emeralds & pearls)
      for (let n = -35; n <= 35; n += 10) {
        ctx.fillStyle = '#059669'; // Emerald
        ctx.beginPath();
        ctx.arc(400 + n, 665, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fffbeb'; // Pearl drop
        ctx.beginPath();
        ctx.arc(400 + n, 676, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 4. Face & Features
      ctx.beginPath();
      ctx.ellipse(400, 480, 135, 170, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f7ceb5';
      ctx.fill();

      // Soft blushing cheeks
      ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
      ctx.beginPath();
      ctx.arc(340, 505, 35, 0, Math.PI * 2);
      ctx.arc(460, 505, 35, 0, Math.PI * 2);
      ctx.fill();

      // Eyes with bridal kohl & winged eyeliner
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.ellipse(350, 470, 14, 7, -0.05, 0, Math.PI * 2);
      ctx.ellipse(450, 470, 14, 7, 0.05, 0, Math.PI * 2);
      ctx.fill();
      // Eye highlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(352, 468, 3, 0, Math.PI * 2);
      ctx.arc(452, 468, 3, 0, Math.PI * 2);
      ctx.fill();

      // Bridal bindi
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.arc(400, 435, 4, 0, Math.PI * 2);
      ctx.fill();

      // Lips with bridal crimson tint
      ctx.fillStyle = '#be123c';
      ctx.beginPath();
      ctx.ellipse(400, 545, 24, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // Maang Tikka (Head jewellery)
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(400, 340);
      ctx.lineTo(400, 410);
      ctx.stroke();
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(400, 415, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#dc2626'; // ruby center
      ctx.beginPath();
      ctx.arc(400, 415, 4, 0, Math.PI * 2);
      ctx.fill();

      // Bridal Jhumka Earrings
      ctx.fillStyle = '#ffd700';
      // Left earring
      ctx.beginPath();
      ctx.arc(260, 495, 8, 0, Math.PI * 2);
      ctx.arc(260, 515, 12, 0, Math.PI);
      ctx.fill();
      // Right earring
      ctx.beginPath();
      ctx.arc(540, 495, 8, 0, Math.PI * 2);
      ctx.arc(540, 515, 12, 0, Math.PI);
      ctx.fill();

      // Hair
      ctx.fillStyle = '#1e130f';
      ctx.beginPath();
      ctx.ellipse(400, 395, 155, 130, 0, Math.PI, 0);
      ctx.fill();

      // 5. TRANSLUCENT BRIDAL DUPATTA / VEIL (The key feature to test!)
      // Semi-transparent sheer red mesh draped over head, shoulders, and background
      ctx.save();
      ctx.fillStyle = 'rgba(225, 29, 72, 0.42)'; // Sheer red net
      ctx.beginPath();
      // Dupatta arching over the head and framing the bride
      ctx.moveTo(210, 850);
      ctx.quadraticCurveTo(180, 450, 240, 320);
      ctx.quadraticCurveTo(400, 240, 560, 320);
      ctx.quadraticCurveTo(620, 450, 590, 850);
      ctx.lineTo(510, 850);
      ctx.quadraticCurveTo(530, 470, 490, 360);
      ctx.quadraticCurveTo(400, 320, 310, 360);
      ctx.quadraticCurveTo(270, 470, 290, 850);
      ctx.closePath();
      ctx.fill();

      // Fine gold net lattice pattern (sheer weave) inside the veil
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.28)';
      ctx.lineWidth = 1;
      for (let x = 180; x <= 620; x += 18) {
        ctx.beginPath();
        ctx.moveTo(x, 260);
        ctx.lineTo(x + 40, 850);
        ctx.stroke();
      }
      for (let y = 260; y <= 850; y += 18) {
        ctx.beginPath();
        ctx.moveTo(180, y);
        ctx.lineTo(620, y + 30);
        ctx.stroke();
      }

      // Gold embroidered border (Kiran / Zari lace) along the veil perimeter
      ctx.strokeStyle = '#ffd700'; // Opaque metallic gold lace
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(210, 850);
      ctx.quadraticCurveTo(180, 450, 240, 320);
      ctx.quadraticCurveTo(400, 240, 560, 320);
      ctx.quadraticCurveTo(620, 450, 590, 850);
      ctx.stroke();

      // Delicate scallop lace dots along outer border
      ctx.fillStyle = '#fffbeb';
      for (let a = 0; a <= Math.PI; a += 0.08) {
        const lx = 400 + Math.cos(a + Math.PI) * 195;
        const ly = 370 + Math.sin(a + Math.PI) * 125;
        ctx.beginPath();
        ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

    } else if (type === 'portrait') {
      // Natural colorful outdoor background (garden/bokeh)
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#537895');
      bgGrad.addColorStop(0.5, '#09203f');
      bgGrad.addColorStop(1, '#1b3b2b');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Bokeh light circles in background
      for (let i = 0; i < 35; i++) {
        const bx = (Math.sin(i * 1.7) * 0.5 + 0.5) * width;
        const by = (Math.cos(i * 2.3) * 0.5 + 0.5) * height;
        const radius = 25 + (i % 5) * 16;
        ctx.beginPath();
        ctx.arc(bx, by, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 235, 180, ${0.08 + (i % 3) * 0.05})`;
        ctx.fill();
      }

      // Person shoulders & neck
      ctx.fillStyle = '#2d3748'; // dark blue jacket
      ctx.beginPath();
      ctx.ellipse(400, 880, 260, 200, 0, 0, Math.PI * 2);
      ctx.fill();

      // Shirt collar
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(340, 720);
      ctx.lineTo(400, 800);
      ctx.lineTo(460, 720);
      ctx.closePath();
      ctx.fill();

      // Neck
      ctx.fillStyle = '#e8b89d';
      ctx.fillRect(360, 560, 80, 180);

      // Head / Face
      ctx.beginPath();
      ctx.ellipse(400, 480, 140, 175, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f5c6aa';
      ctx.fill();

      // Soft facial features
      // Eyes
      ctx.fillStyle = '#2d3748';
      ctx.beginPath();
      ctx.ellipse(350, 470, 12, 7, 0, 0, Math.PI * 2);
      ctx.ellipse(450, 470, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyebrows
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#3e2723';
      ctx.beginPath();
      ctx.arc(350, 452, 22, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(450, 452, 22, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();

      // Nose
      ctx.strokeStyle = '#d79b7d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(400, 470);
      ctx.lineTo(395, 520);
      ctx.lineTo(410, 520);
      ctx.stroke();

      // Smile
      ctx.strokeStyle = '#c55353';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(400, 545, 26, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();

      // Detailed hair strands and curls
      ctx.strokeStyle = '#2b1b17';
      ctx.fillStyle = '#341f17';
      ctx.beginPath();
      ctx.ellipse(400, 400, 160, 140, 0, Math.PI, 0);
      ctx.fill();

      for (let angle = 0; angle < Math.PI; angle += 0.05) {
        const x = 400 + Math.cos(angle + Math.PI) * 160;
        const y = 430 + Math.sin(angle + Math.PI) * 130;
        ctx.beginPath();
        ctx.moveTo(x, y);
        const strandLen = 40 + Math.random() * 60;
        ctx.quadraticCurveTo(
          x + (Math.random() - 0.5) * 30,
          y + strandLen * 0.5,
          x + (Math.random() - 0.5) * 40,
          y + strandLen
        );
        ctx.lineWidth = 1.5 + Math.random() * 2;
        ctx.strokeStyle = Math.random() > 0.3 ? '#21130d' : '#45261d';
        ctx.stroke();
      }
    } else if (type === 'sneaker') {
      // Studio textured backdrop
      const bgGrad = ctx.createRadialGradient(400, 450, 50, 400, 450, 550);
      bgGrad.addColorStop(0, '#f1f5f9');
      bgGrad.addColorStop(1, '#94a3b8');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Floor shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
      ctx.beginPath();
      ctx.ellipse(400, 680, 280, 35, -0.1, 0, Math.PI * 2);
      ctx.fill();

      // Sneaker body
      ctx.save();
      ctx.translate(400, 500);
      ctx.rotate(-0.1);

      // Sole
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(-240, 90, 480, 50, 20);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();

      // Upper body
      const shoeGrad = ctx.createLinearGradient(-200, -80, 200, 100);
      shoeGrad.addColorStop(0, '#7c3aed'); // Purple accent
      shoeGrad.addColorStop(0.5, '#ec4899'); // Pink
      shoeGrad.addColorStop(1, '#f97316'); // Orange
      ctx.fillStyle = shoeGrad;
      ctx.beginPath();
      ctx.moveTo(-220, 90);
      ctx.lineTo(-210, 10);
      ctx.quadraticCurveTo(-150, -40, -50, -30);
      ctx.quadraticCurveTo(50, -140, 140, -100);
      ctx.quadraticCurveTo(220, -20, 230, 90);
      ctx.closePath();
      ctx.fill();

      // Shoe collar & tongue
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.ellipse(80, -90, 45, 30, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Swoosh emblem
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(-120, 20);
      ctx.quadraticCurveTo(-20, 60, 100, -20);
      ctx.stroke();

      ctx.restore();
    } else {
      // Pet (Labrador Dog against Complex Outdoor Garden with Trees, Grass, & Flowers)
      // 1. Sky & Garden Trees Background
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.45);
      skyGrad.addColorStop(0, '#70a4d4'); // Summer sky
      skyGrad.addColorStop(1, '#c0dbee');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height * 0.45);

      // Distant garden trees & dense leafy foliage in upper background
      ctx.fillStyle = '#204020';
      ctx.beginPath();
      ctx.arc(120, 160, 130, 0, Math.PI * 2);
      ctx.arc(280, 140, 110, 0, Math.PI * 2);
      ctx.arc(680, 150, 140, 0, Math.PI * 2);
      ctx.arc(520, 120, 100, 0, Math.PI * 2);
      ctx.fill();

      // Tree trunks
      ctx.fillStyle = '#3a2010';
      ctx.fillRect(90, 220, 45, 180);
      ctx.fillRect(660, 210, 50, 190);

      // Lighter foliage clumps
      ctx.fillStyle = '#38662e';
      ctx.beginPath();
      ctx.arc(160, 200, 90, 0, Math.PI * 2);
      ctx.arc(640, 220, 100, 0, Math.PI * 2);
      ctx.fill();

      // Garden wooden picket fence
      ctx.fillStyle = '#dcd5c5';
      ctx.strokeStyle = '#9e9282';
      ctx.lineWidth = 2;
      for (let px = 20; px < width; px += 55) {
        ctx.fillRect(px, 280, 35, 140);
        ctx.strokeRect(px, 280, 35, 140);
        ctx.beginPath();
        ctx.moveTo(px, 280);
        ctx.lineTo(px + 17.5, 255);
        ctx.lineTo(px + 35, 280);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // 2. Lush Outdoor Garden Lawn & Grass
      const lawnGrad = ctx.createLinearGradient(0, 360, 0, height);
      lawnGrad.addColorStop(0, '#43782b');
      lawnGrad.addColorStop(0.6, '#2e5a1c');
      lawnGrad.addColorStop(1, '#1b3b0e');
      ctx.fillStyle = lawnGrad;
      ctx.fillRect(0, 380, width, height - 380);

      // Garden flowerbed with colorful blooming flowers (roses, marigolds, daisies)
      for (let f = 0; f < 30; f++) {
        const fx = 30 + (f * 26) % (width - 60);
        const fy = 400 + ((f * 43) % 200);
        // Avoid center where dog is seated
        if (fx > 220 && fx < 580 && fy > 450) continue;

        ctx.fillStyle = f % 3 === 0 ? '#dc2626' : f % 3 === 1 ? '#f59e0b' : '#f8fafc';
        ctx.beginPath();
        ctx.arc(fx, fy, 8 + (f % 5) * 2, 0, Math.PI * 2);
        ctx.fill();
        // Flower center
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(fx, fy, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. LABRADOR RETRIEVER (Central Primary Subject)
      // Golden/honey coat colors
      const coatHoney = '#dfa856';
      const coatGold = '#eab568';
      const coatShade = '#b88135';
      const coatLight = '#f5cb88';

      // Dog tail wagging on right side
      ctx.strokeStyle = coatHoney;
      ctx.lineWidth = 32;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(560, 780);
      ctx.quadraticCurveTo(680, 750, 720, 640);
      ctx.stroke();

      // Dog body / torso seated on lawn
      ctx.fillStyle = coatHoney;
      ctx.beginPath();
      ctx.ellipse(400, 720, 195, 175, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dog chest highlights
      ctx.fillStyle = coatLight;
      ctx.beginPath();
      ctx.ellipse(400, 680, 110, 130, 0, 0, Math.PI * 2);
      ctx.fill();

      // Front Legs and Paws resting on the grass
      ctx.fillStyle = coatHoney;
      // Left leg
      ctx.beginPath();
      ctx.roundRect(310, 650, 60, 210, 25);
      ctx.fill();
      // Right leg
      ctx.beginPath();
      ctx.roundRect(430, 650, 60, 210, 25);
      ctx.fill();

      // Front Paws with toe contours
      ctx.fillStyle = coatLight;
      ctx.beginPath();
      ctx.ellipse(335, 865, 38, 22, 0, 0, Math.PI * 2);
      ctx.ellipse(465, 865, 38, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Paw claws & pads
      ctx.fillStyle = '#292524';
      for (let t = -16; t <= 16; t += 11) {
        ctx.beginPath();
        ctx.arc(335 + t, 876, 2.5, 0, Math.PI * 2);
        ctx.arc(465 + t, 876, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Dog Head (Classic Labrador shape: broad skull, gentle stop)
      ctx.fillStyle = coatGold;
      ctx.beginPath();
      ctx.ellipse(400, 470, 130, 140, 0, 0, Math.PI * 2);
      ctx.fill();

      // Floppy Labrador Ears draped along sides
      ctx.fillStyle = coatShade;
      // Left ear
      ctx.beginPath();
      ctx.ellipse(280, 470, 48, 105, 0.25, 0, Math.PI * 2);
      ctx.fill();
      // Right ear
      ctx.beginPath();
      ctx.ellipse(520, 470, 48, 105, -0.25, 0, Math.PI * 2);
      ctx.fill();

      // Muzzle & Snout
      ctx.fillStyle = coatLight;
      ctx.beginPath();
      ctx.ellipse(400, 525, 62, 52, 0, 0, Math.PI * 2);
      ctx.fill();

      // Labrador Wet Black Nose
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.roundRect(375, 495, 50, 32, [10, 10, 16, 16]);
      ctx.fill();
      // Nostrils
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath();
      ctx.ellipse(388, 514, 6, 4, 0.2, 0, Math.PI * 2);
      ctx.ellipse(412, 514, 6, 4, -0.2, 0, Math.PI * 2);
      ctx.fill();
      // Nose highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.beginPath();
      ctx.ellipse(395, 503, 10, 4, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Gentle soulful Labrador Eyes (dark hazel/brown)
      ctx.fillStyle = '#3b1a08';
      ctx.beginPath();
      ctx.ellipse(345, 445, 14, 11, -0.1, 0, Math.PI * 2);
      ctx.ellipse(455, 445, 14, 11, 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Eye pupils
      ctx.fillStyle = '#0f0a06';
      ctx.beginPath();
      ctx.arc(345, 445, 8, 0, Math.PI * 2);
      ctx.arc(455, 445, 8, 0, Math.PI * 2);
      ctx.fill();
      // Eye highlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(342, 441, 3.5, 0, Math.PI * 2);
      ctx.arc(452, 441, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Whiskers and muzzle dots
      ctx.fillStyle = '#78350f';
      for (let w = -20; w <= 20; w += 8) {
        ctx.beginPath();
        ctx.arc(385 + w * 0.4, 535 + (w % 6), 1.8, 0, Math.PI * 2);
        ctx.arc(415 + w * 0.4, 535 + (w % 6), 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fine Fur Contours along dog silhouette (ears, chest, and tail)
      ctx.strokeStyle = coatLight;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 70; i++) {
        const rad = (i / 70) * Math.PI * 2;
        const fx = 400 + Math.cos(rad) * 135;
        const fy = 470 + Math.sin(rad) * 145;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + Math.cos(rad) * 16, fy + Math.sin(rad) * 16);
        ctx.stroke();
      }
    }

    canvas.toBlob((blob) => {
      resolve(blob || new Blob([]));
    }, 'image/png');
  });
}
