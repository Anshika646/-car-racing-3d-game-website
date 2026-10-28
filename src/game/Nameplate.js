/**
 * Nameplate.js
 *
 * High-DPI procedural 3D floating gamer-tag / driver nameplate sprites
 * rendered above both the player's car (editable live) and rival traffic cars.
 * Reuses a single CanvasTexture per sprite for zero WebGL memory churn.
 */

import * as THREE from 'three';

export const DEFAULT_DRIVER_NAME = 'T56';

export const RANDOM_RIVAL_NAMES = [
  'Aarav_GT',
  'Kabir_X',
  'Riya_Drift',
  'Rohan_99',
  'Zoya_RS',
  'Vikram_V8',
  'Ishaan_Z',
  'Meera_Turbo',
  'Dev_Apex',
  'Neha_Nitro',
  'Aryan_07',
  'Tanya_GT',
  'Karan_Evo',
  'Pooja_RX',
  'Yash_Blaze',
  'Simran_S',
  'Aditya_F1',
  'Nisha_Vortex',
  'Rahul_Mach',
  'Sneha_Drift',
  'Siddharth_R',
  'Ananya_GTR',
  'Kunal_Apex',
  'Kriti_Speed',
  'Varun_911',
  'Diya_Aero',
  'Harsh_V10',
  'Shreya_RS',
  'Pranav_Z',
  'Kavya_Boost',
  'Shadow_X',
  'NightRider',
  'NitroKing',
  'ApexHunter',
  'TurboViper',
  'Phantom_9',
];

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function sanitizeDriverName(raw, fallback = DEFAULT_DRIVER_NAME) {
  const cleaned = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);
  return cleaned || fallback;
}

export function pickRandomRivalName(excludeSet = null) {
  if (!excludeSet || excludeSet.size >= RANDOM_RIVAL_NAMES.length - 2) {
    return RANDOM_RIVAL_NAMES[Math.floor(Math.random() * RANDOM_RIVAL_NAMES.length)];
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = RANDOM_RIVAL_NAMES[Math.floor(Math.random() * RANDOM_RIVAL_NAMES.length)];
    if (!excludeSet.has(candidate)) return candidate;
  }
  return RANDOM_RIVAL_NAMES[0];
}

export function createNameplateSprite({
  name = DEFAULT_DRIVER_NAME,
  badge = 'YOU',
  accentColor = '#22d3ee',
  isPlayer = false,
} = {}) {
  const mat = new THREE.SpriteMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(isPlayer ? 2.55 : 2.35, isPlayer ? 0.64 : 0.58, 1);
  sprite.renderOrder = isPlayer ? 12 : 8;
  sprite.userData = {
    driverName: sanitizeDriverName(name, isPlayer ? DEFAULT_DRIVER_NAME : 'Racer'),
    badge,
    accentColor,
    isPlayer,
    canvas: null,
    ctx: null,
    texture: null,
  };

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      sprite.userData.canvas = canvas;
      sprite.userData.ctx = ctx;
      sprite.userData.texture = texture;
      mat.map = texture;
    }
  }

  updateNameplateSprite(sprite, { name, badge, accentColor, isPlayer });
  return sprite;
}

export function updateNameplateSprite(
  sprite,
  { name, badge, accentColor, isPlayer } = {},
) {
  if (!sprite || !sprite.userData) return;

  const playerFlag = isPlayer !== undefined ? isPlayer : sprite.userData.isPlayer;
  const cleanName = sanitizeDriverName(
    name !== undefined ? name : sprite.userData.driverName,
    playerFlag ? DEFAULT_DRIVER_NAME : 'Racer',
  );
  const tagBadge = badge !== undefined ? badge : sprite.userData.badge;
  const accent = accentColor || sprite.userData.accentColor || '#22d3ee';

  sprite.userData.driverName = cleanName;
  sprite.userData.badge = tagBadge;
  sprite.userData.accentColor = accent;
  sprite.userData.isPlayer = playerFlag;

  const { canvas, ctx, texture } = sprite.userData;
  if (!canvas || !ctx || !texture) return;

  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.font = '700 32px "Chakra Petch", "Plus Jakarta Sans", sans-serif';
  const nameWidth = ctx.measureText(cleanName).width;

  ctx.font = '700 20px "JetBrains Mono", monospace';
  const badgeText = tagBadge ? String(tagBadge).toUpperCase() : '';
  const badgeWidth = badgeText ? ctx.measureText(badgeText).width + 24 : 0;

  const pillWidth = Math.min(488, Math.max(200, nameWidth + badgeWidth + 58));
  const pillHeight = 68;
  const pillX = (W - pillWidth) / 2;
  const pillY = 16;

  // Dark racing HUD plate background
  ctx.save();
  drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, 16);
  ctx.fillStyle = playerFlag ? 'rgba(7, 13, 24, 0.90)' : 'rgba(9, 14, 25, 0.80)';
  ctx.fill();

  // Crisp glowing rim for player, sleek subtle border for rivals
  ctx.lineWidth = playerFlag ? 3.5 : 2.2;
  ctx.strokeStyle = accent;
  ctx.stroke();
  ctx.restore();

  // Downward pointer chevron centered below plate
  ctx.beginPath();
  ctx.moveTo(W / 2 - 11, pillY + pillHeight);
  ctx.lineTo(W / 2 + 11, pillY + pillHeight);
  ctx.lineTo(W / 2, pillY + pillHeight + 14);
  ctx.closePath();
  ctx.fillStyle = accent;
  ctx.fill();

  let cursorX = pillX + 20;

  // Left role/rank badge chip
  if (badgeText) {
    const chipH = 36;
    const chipY = pillY + (pillHeight - chipH) / 2;
    drawRoundedRect(ctx, cursorX, chipY, badgeWidth, chipH, 9);
    ctx.fillStyle = accent;
    ctx.fill();

    ctx.fillStyle = '#041019';
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(badgeText, cursorX + badgeWidth / 2, chipY + chipH / 2 + 1);
    cursorX += badgeWidth + 14;
  }

  // Driver Name text
  ctx.fillStyle = playerFlag ? '#ffffff' : '#e2e8f0';
  ctx.font = '700 32px "Chakra Petch", "Plus Jakarta Sans", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = badgeText ? 'left' : 'center';
  const textX = badgeText ? cursorX : W / 2;
  ctx.fillText(cleanName, textX, pillY + pillHeight / 2 + 1);

  texture.needsUpdate = true;
}
