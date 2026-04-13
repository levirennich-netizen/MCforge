"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── Constants ──
const B = 16;
const CH = 320;
const WW = 128;
const WH = 48;
const PW = 12;
const PH = 26;
const REACH = 4.5;
const GRAVITY = 0.45;
const SPEED = 2.5;
const JUMP = -7.5;

// ── Block types ──
const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5,
  COAL = 6, DIAMOND = 7, BEDROCK = 8, SAND = 9, PLANK = 10;
const CHERRY_WOOD = 18, CHERRY_LEAVES = 19, SNOW = 20, ICE = 21,
  CACTUS = 22, SANDSTONE = 23, SPRUCE_LEAVES = 24;
const PALE_WOOD = 25, PALE_LEAVES = 26, PALE_MOSS = 27;
// Nether blocks
const NETHERRACK = 28, SOUL_SAND = 29, NETHER_BRICK = 30, GLOWSTONE = 31,
  LAVA = 32, NETHER_WART_BLOCK = 33, CRIMSON_STEM = 34, BASALT = 35, NETHERITE_ORE = 36;
// End blocks
const END_STONE = 37, OBSIDIAN = 38, PURPUR = 39, CHORUS_PLANT = 40, DRAGON_EGG = 41;

const BLOCK_SET = new Set([GRASS, DIRT, STONE, WOOD, LEAVES, COAL, DIAMOND, BEDROCK, SAND, PLANK,
  CHERRY_WOOD, CHERRY_LEAVES, SNOW, ICE, CACTUS, SANDSTONE, SPRUCE_LEAVES,
  PALE_WOOD, PALE_LEAVES, PALE_MOSS,
  NETHERRACK, SOUL_SAND, NETHER_BRICK, GLOWSTONE, LAVA, NETHER_WART_BLOCK, CRIMSON_STEM, BASALT, NETHERITE_ORE,
  END_STONE, OBSIDIAN, PURPUR, CHORUS_PLANT, DRAGON_EGG]);
const isBlock = (id: number) => BLOCK_SET.has(id);

// ── Tool item IDs (11-17) ──
const WOOD_PICK = 11, STONE_PICK = 12, DIAMOND_PICK = 13,
  WOOD_SWORD = 14, STONE_SWORD = 15, DIAMOND_SWORD = 16, TORCH = 17;

const ITEM_NAMES: Record<number, string> = {
  [GRASS]: "Grass", [DIRT]: "Dirt", [STONE]: "Stone", [WOOD]: "Oak Log",
  [LEAVES]: "Leaves", [COAL]: "Coal Ore", [DIAMOND]: "Diamond Ore",
  [SAND]: "Sand", [PLANK]: "Oak Planks", [BEDROCK]: "Bedrock",
  [CHERRY_WOOD]: "Cherry Log", [CHERRY_LEAVES]: "Cherry Blossoms",
  [SNOW]: "Snow", [ICE]: "Ice", [CACTUS]: "Cactus",
  [SANDSTONE]: "Sandstone", [SPRUCE_LEAVES]: "Spruce Leaves",
  [PALE_WOOD]: "Pale Oak Log", [PALE_LEAVES]: "Pale Oak Leaves", [PALE_MOSS]: "Pale Hanging Moss",
  [NETHERRACK]: "Netherrack", [SOUL_SAND]: "Soul Sand", [NETHER_BRICK]: "Nether Brick",
  [GLOWSTONE]: "Glowstone", [LAVA]: "Lava", [NETHER_WART_BLOCK]: "Nether Wart Block",
  [CRIMSON_STEM]: "Crimson Stem", [BASALT]: "Basalt", [NETHERITE_ORE]: "Ancient Debris",
  [END_STONE]: "End Stone", [OBSIDIAN]: "Obsidian", [PURPUR]: "Purpur Block",
  [CHORUS_PLANT]: "Chorus Plant", [DRAGON_EGG]: "Dragon Egg",
  [WOOD_PICK]: "Wood Pickaxe", [STONE_PICK]: "Stone Pickaxe", [DIAMOND_PICK]: "Diamond Pickaxe",
  [WOOD_SWORD]: "Wood Sword", [STONE_SWORD]: "Stone Sword", [DIAMOND_SWORD]: "Diamond Sword",
  [TORCH]: "Torch",
};

// Mining speed (frames to break): lower = faster
const BASE_MINE_TIME = 12;
const PICK_SPEED: Record<number, number> = { [WOOD_PICK]: 8, [STONE_PICK]: 5, [DIAMOND_PICK]: 3 };

// ── Crafting recipes ──
interface Recipe { result: number; count: number; ingredients: [number, number][] }
const RECIPES: Record<string, Recipe> = {
  "planks": { result: PLANK, count: 4, ingredients: [[WOOD, 1]] },
  "wooden pickaxe": { result: WOOD_PICK, count: 1, ingredients: [[PLANK, 3], [WOOD, 2]] },
  "wood pickaxe": { result: WOOD_PICK, count: 1, ingredients: [[PLANK, 3], [WOOD, 2]] },
  "stone pickaxe": { result: STONE_PICK, count: 1, ingredients: [[STONE, 3], [WOOD, 2]] },
  "diamond pickaxe": { result: DIAMOND_PICK, count: 1, ingredients: [[DIAMOND, 3], [WOOD, 2]] },
  "wooden sword": { result: WOOD_SWORD, count: 1, ingredients: [[PLANK, 2], [WOOD, 1]] },
  "wood sword": { result: WOOD_SWORD, count: 1, ingredients: [[PLANK, 2], [WOOD, 1]] },
  "stone sword": { result: STONE_SWORD, count: 1, ingredients: [[STONE, 2], [WOOD, 1]] },
  "diamond sword": { result: DIAMOND_SWORD, count: 1, ingredients: [[DIAMOND, 2], [WOOD, 1]] },
  "torch": { result: TORCH, count: 4, ingredients: [[COAL, 1], [WOOD, 1]] },
};

// ── Deterministic hash ──
const hash = (x: number, y: number, s: number) => {
  const n = Math.sin(x * 374.761 + y * 668.265 + s * 1234.567) * 43758.5453;
  return n - Math.floor(n);
};

// ── Biomes ──
const BIOME_PLAINS = 0, BIOME_CHERRY = 1, BIOME_DESERT = 2, BIOME_SNOWY = 3, BIOME_PALE_GARDEN = 4;

function getBiome(x: number, seed: number): number {
  const v = Math.sin(x * 0.022 + seed * 0.7) + Math.sin(x * 0.009 + seed * 2.3) * 0.8;
  const w = Math.sin(x * 0.018 + seed * 1.5) + Math.sin(x * 0.035 + seed * 0.4) * 0.5;
  if (v > 0.5) return BIOME_CHERRY;
  if (v < -0.7) return BIOME_DESERT;
  if (v > -0.7 && v < -0.2 && Math.sin(x * 0.04 + seed * 1.1) > 0.2) return BIOME_SNOWY;
  if (w > 0.8) return BIOME_PALE_GARDEN;
  return BIOME_PLAINS;
}

// ── Texture atlas ──
function buildAtlas(): HTMLCanvasElement {
  const atlas = document.createElement("canvas");
  atlas.width = B * 42;
  atlas.height = B;
  const ac = atlas.getContext("2d")!;
  const hexRgb = (h: string): [number, number, number] => {
    const v = parseInt(h.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };
  const pick = (pal: string[], x: number, y: number, seed: number) => hexRgb(pal[Math.floor(hash(x, y, seed) * pal.length)]);
  const vary = (rgb: [number, number, number], x: number, y: number, amt: number): [number, number, number] => {
    const v = (hash(x * 13, y * 7, 999) - 0.5) * amt;
    return [Math.max(0, Math.min(255, rgb[0] + v)), Math.max(0, Math.min(255, rgb[1] + v)), Math.max(0, Math.min(255, rgb[2] + v))];
  };

  function gen(type: number) {
    const img = ac.createImageData(B, B);
    const d = img.data;
    const set = (x: number, y: number, r: number, g: number, b: number) => {
      const i = (y * B + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    };
    const gTop = ["#5B9E2E", "#6EB33B", "#79BC43", "#4E8F24", "#67A835"];
    const dPal = ["#866527", "#7A5C24", "#9B7D3E", "#6F5020", "#8A6930"];
    const sPal = ["#7F7F7F", "#8A8A8A", "#727272", "#969696", "#6B6B6B"];
    const wPal = ["#6B4A2A", "#5C3D1E", "#7A5530", "#4D3318", "#755030"];
    const lPal = ["#2D8C2D", "#3A9E3A", "#1F7A1F", "#4BAD4B", "#267A26"];
    const snPal = ["#D9C479", "#CFBA6E", "#E3CE84", "#C5AF62", "#DCCB7F"];
    const pPal = ["#B48C4E", "#A07A3C", "#C49856", "#9A7035", "#BC944C"];
    const bkPal = ["#2A2A2A", "#3D3D3D", "#1A1A1A", "#4A4A4A", "#333333"];

    for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) {
      let rgb: [number, number, number];
      switch (type) {
        case GRASS:
          if (y < 3) rgb = vary(pick(gTop, x, y, 10), x, y, 15);
          else if (y === 3) rgb = hash(x, y, 20) < 0.5 ? pick(gTop, x, y, 11) : pick(dPal, x, y, 12);
          else rgb = vary(pick(dPal, x, y, 13), x, y, 12); break;
        case DIRT: rgb = vary(pick(dPal, x, y, 30), x, y, 14); break;
        case STONE: {
          const px2 = Math.floor(x / 3), py2 = Math.floor(y / 3);
          const pb = (hash(px2, py2, 40) - 0.5) * 30;
          rgb = vary(pick(sPal, px2, py2, 41), x, y, 10);
          rgb = [Math.max(0, Math.min(255, rgb[0] + pb)), Math.max(0, Math.min(255, rgb[1] + pb)), Math.max(0, Math.min(255, rgb[2] + pb))]; break;
        }
        case WOOD: {
          const base = pick(wPal, Math.floor(x / 2), 0, 50);
          const grain = Math.sin(y * 1.2 + hash(x, 0, 51) * 3) * 10;
          rgb = vary([base[0] + grain, base[1] + grain, base[2] + grain] as [number, number, number], x, y, 8);
          if (x % 4 === 0) rgb = [rgb[0] - 15, rgb[1] - 15, rgb[2] - 10] as [number, number, number];
          rgb = [Math.max(0, Math.min(255, rgb[0])), Math.max(0, Math.min(255, rgb[1])), Math.max(0, Math.min(255, rgb[2]))]; break;
        }
        case LEAVES: {
          rgb = vary(pick(lPal, x, y, 60), x, y, 18);
          if (hash(x, y, 61) < 0.12) rgb = [Math.max(0, rgb[0] - 30), Math.max(0, rgb[1] - 25), Math.max(0, rgb[2] - 30)]; break;
        }
        case COAL: {
          rgb = vary(pick(sPal, x, y, 70), x, y, 10);
          if (Math.abs(x - 4) + Math.abs(y - 4) < 2.5 || Math.abs(x - 11) + Math.abs(y - 9) < 2 || Math.abs(x - 6) + Math.abs(y - 12) < 2)
            rgb = vary([35, 30, 30], x, y, 8); break;
        }
        case DIAMOND: {
          rgb = vary(pick(sPal, x, y, 80), x, y, 10);
          if (Math.abs(x - 3) + Math.abs(y - 5) < 2.2 || Math.abs(x - 10) + Math.abs(y - 4) < 2 || Math.abs(x - 7) + Math.abs(y - 11) < 2.2) {
            rgb = hash(x, y, 81) < 0.5 ? [100, 230, 235] : [55, 190, 200];
          } break;
        }
        case BEDROCK: rgb = vary(pick(bkPal, x, y, 90), x, y, 20); break;
        case SAND: rgb = vary(pick(snPal, x, y, 100), x, y, 8); break;
        case PLANK: {
          rgb = vary(pick(pPal, x, Math.floor(y / 4), 110), x, y, 10);
          if (y % 4 === 0) rgb = [rgb[0] - 18, rgb[1] - 16, rgb[2] - 12] as [number, number, number];
          rgb = [Math.max(0, rgb[0]), Math.max(0, rgb[1]), Math.max(0, rgb[2])]; break;
        }
        // ── New biome blocks ──
        case CHERRY_WOOD: {
          const cwPal = ["#8B5A5A", "#7A4A4A", "#9C6060", "#6D3E3E", "#8E5555"];
          const base = pick(cwPal, Math.floor(x / 2), 0, 180);
          const grain = Math.sin(y * 1.2 + hash(x, 0, 181) * 3) * 8;
          rgb = vary([base[0] + grain, base[1] + grain, base[2] + grain] as [number, number, number], x, y, 8);
          if (x % 4 === 0) rgb = [rgb[0] - 12, rgb[1] - 12, rgb[2] - 8] as [number, number, number];
          rgb = [Math.max(0, Math.min(255, rgb[0])), Math.max(0, Math.min(255, rgb[1])), Math.max(0, Math.min(255, rgb[2]))]; break;
        }
        case CHERRY_LEAVES: {
          const clPal = ["#F2A0B5", "#E88CA0", "#F7B5C8", "#DC7890", "#F0A8BB"];
          rgb = vary(pick(clPal, x, y, 190), x, y, 18);
          if (hash(x, y, 191) < 0.15) rgb = [Math.min(255, rgb[0] + 25), Math.max(0, rgb[1] - 15), Math.max(0, rgb[2] - 10)];
          break;
        }
        case SNOW: {
          const snowPal = ["#F0F4F8", "#E8ECF0", "#F5F8FC", "#E0E6EC", "#EDF1F5"];
          rgb = vary(pick(snowPal, x, y, 200), x, y, 6);
          break;
        }
        case ICE: {
          const icePal = ["#A0D8EF", "#8ECFE8", "#B0E0F5", "#80C5E0", "#95D0EA"];
          rgb = vary(pick(icePal, x, y, 210), x, y, 12);
          if (hash(x, y, 211) < 0.08) rgb = [Math.min(255, rgb[0] + 30), Math.min(255, rgb[1] + 25), Math.min(255, rgb[2] + 20)];
          break;
        }
        case CACTUS: {
          const cacPal = ["#2D6B2D", "#357535", "#256125", "#408040", "#2A6A2A"];
          rgb = vary(pick(cacPal, x, y, 220), x, y, 12);
          if ((x === 0 || x === B - 1) && y % 3 === 0) rgb = [Math.min(255, rgb[0] + 30), Math.min(255, rgb[1] + 25), Math.min(255, rgb[2] + 15)];
          if (hash(x, y, 221) < 0.06) rgb = [Math.min(255, rgb[0] + 35), Math.min(255, rgb[1] + 30), rgb[2]];
          break;
        }
        case SANDSTONE: {
          const ssPal = ["#D4B878", "#C8AC6C", "#DFCA88", "#BCA060", "#D0B474"];
          const band = Math.floor(y / 4);
          rgb = vary(pick(ssPal, x, band, 230), x, y, 8);
          if (y % 4 === 0) rgb = [Math.max(0, rgb[0] - 12), Math.max(0, rgb[1] - 10), Math.max(0, rgb[2] - 8)];
          break;
        }
        case SPRUCE_LEAVES: {
          const slPal = ["#1A4A1A", "#225522", "#143E14", "#2A602A", "#1C4C1C"];
          rgb = vary(pick(slPal, x, y, 240), x, y, 14);
          if (hash(x, y, 241) < 0.1) rgb = [Math.max(0, rgb[0] - 20), Math.max(0, rgb[1] - 15), Math.max(0, rgb[2] - 20)];
          break;
        }
        case PALE_WOOD: {
          const pwPal = ["#C8BDA8", "#BAB098", "#D0C5B0", "#AEA590", "#C2B8A2"];
          const base = pick(pwPal, Math.floor(x / 2), 0, 250);
          const grain = Math.sin(y * 1.1 + hash(x, 0, 251) * 3) * 6;
          rgb = vary([base[0] + grain, base[1] + grain, base[2] + grain] as [number, number, number], x, y, 6);
          if (x % 4 === 0) rgb = [rgb[0] - 8, rgb[1] - 8, rgb[2] - 6] as [number, number, number];
          rgb = [Math.max(0, Math.min(255, rgb[0])), Math.max(0, Math.min(255, rgb[1])), Math.max(0, Math.min(255, rgb[2]))]; break;
        }
        case PALE_LEAVES: {
          const plPal = ["#8A9A7A", "#7D8E6E", "#96A686", "#728264", "#8B9B7C"];
          rgb = vary(pick(plPal, x, y, 260), x, y, 12);
          if (hash(x, y, 261) < 0.12) rgb = [Math.min(255, rgb[0] + 15), Math.min(255, rgb[1] + 12), Math.min(255, rgb[2] + 8)];
          break;
        }
        case PALE_MOSS: {
          const pmPal = ["#C8D0B8", "#BCC5A8", "#D2DAC2", "#B0BAA0", "#C4CCB4"];
          rgb = vary(pick(pmPal, x, y, 270), x, y, 8);
          // Stringy hanging look: lighter at top, darker strands
          if (y > 8) rgb = [Math.max(0, rgb[0] - 12), Math.max(0, rgb[1] - 10), Math.max(0, rgb[2] - 8)];
          if (x % 3 === 0 && hash(x, y, 271) < 0.3) rgb = [Math.max(0, rgb[0] - 20), Math.max(0, rgb[1] - 18), Math.max(0, rgb[2] - 15)];
          break;
        }
        // ── Nether blocks ──
        case NETHERRACK: {
          const nrPal = ["#6B2020", "#7A2828", "#5E1A1A", "#832E2E", "#721F1F"];
          rgb = vary(pick(nrPal, x, y, 280), x, y, 14);
          if (hash(x, y, 281) < 0.15) rgb = [Math.min(255, rgb[0] + 15), rgb[1], rgb[2]];
          break;
        }
        case SOUL_SAND: {
          const ssPal2 = ["#4A3828", "#3E2E1E", "#564030", "#332518", "#4C3A2A"];
          rgb = vary(pick(ssPal2, x, y, 290), x, y, 10);
          // Sad face patterns
          if ((Math.abs(x - 5) < 2 && Math.abs(y - 6) < 2) || (Math.abs(x - 11) < 2 && Math.abs(y - 6) < 2))
            rgb = [Math.max(0, rgb[0] - 25), Math.max(0, rgb[1] - 20), Math.max(0, rgb[2] - 15)];
          break;
        }
        case NETHER_BRICK: {
          const nbPal = ["#2C1016", "#381520", "#24090E", "#40181E", "#301218"];
          const brickX = Math.floor(x / 4), brickY = Math.floor(y / 4);
          rgb = vary(pick(nbPal, brickX + (brickY % 2) * 2, brickY, 300), x, y, 8);
          if (x % 4 === 0 || y % 4 === 0) rgb = [Math.max(0, rgb[0] - 15), Math.max(0, rgb[1] - 10), Math.max(0, rgb[2] - 10)];
          break;
        }
        case GLOWSTONE: {
          const glPal = ["#D4A840", "#E0B84C", "#C89830", "#ECC858", "#D0A038"];
          rgb = vary(pick(glPal, x, y, 310), x, y, 20);
          if (hash(x, y, 311) < 0.2) rgb = [Math.min(255, rgb[0] + 40), Math.min(255, rgb[1] + 30), rgb[2]];
          break;
        }
        case LAVA: {
          const lvPal = ["#CF4A00", "#E05500", "#B83E00", "#F06000", "#D04800"];
          rgb = vary(pick(lvPal, x, y, 320), x, y, 20);
          if (hash(x, y, 321) < 0.15) rgb = [Math.min(255, rgb[0] + 50), Math.min(255, rgb[1] + 40), Math.min(255, rgb[2] + 10)];
          if (hash(x, y, 322) < 0.08) rgb = [255, 200, 50]; // bright spot
          break;
        }
        case NETHER_WART_BLOCK: {
          const nwPal = ["#730A0A", "#8B1010", "#601010", "#9A1515", "#6D0808"];
          rgb = vary(pick(nwPal, x, y, 330), x, y, 14);
          if (hash(x, y, 331) < 0.1) rgb = [Math.min(255, rgb[0] + 25), rgb[1], rgb[2]];
          break;
        }
        case CRIMSON_STEM: {
          const csPal = ["#6B2040", "#7A2850", "#5E1838", "#832E58", "#721F48"];
          const base = pick(csPal, Math.floor(x / 2), 0, 340);
          const grain = Math.sin(y * 1.2 + hash(x, 0, 341) * 3) * 8;
          rgb = vary([base[0] + grain, base[1] + grain, base[2] + grain] as [number, number, number], x, y, 8);
          if (x % 4 === 0) rgb = [rgb[0] - 10, rgb[1] - 10, rgb[2] - 8] as [number, number, number];
          rgb = [Math.max(0, Math.min(255, rgb[0])), Math.max(0, Math.min(255, rgb[1])), Math.max(0, Math.min(255, rgb[2]))]; break;
        }
        case BASALT: {
          const baPal = ["#3A3A40", "#44444A", "#303036", "#4E4E55", "#363640"];
          const band = Math.floor(y / 3);
          rgb = vary(pick(baPal, x, band, 350), x, y, 10);
          if (y % 3 === 0) rgb = [Math.max(0, rgb[0] - 10), Math.max(0, rgb[1] - 10), Math.max(0, rgb[2] - 8)];
          break;
        }
        case NETHERITE_ORE: {
          const adPal = ["#4A3228", "#3E2820", "#564038", "#332018", "#4C3830"];
          rgb = vary(pick(adPal, x, y, 360), x, y, 10);
          if ((Math.abs(x - 4) + Math.abs(y - 5) < 3) || (Math.abs(x - 11) + Math.abs(y - 10) < 2.5) || (Math.abs(x - 7) + Math.abs(y - 3) < 2)) {
            rgb = hash(x, y, 361) < 0.5 ? [180, 140, 80] : [160, 120, 60];
          }
          if (hash(x, y, 362) < 0.06) rgb = [200, 160, 90];
          break;
        }
        // ── End blocks ──
        case END_STONE: {
          const esPal = ["#DDDBA5", "#D5D39D", "#E5E3AD", "#CDC995", "#D9D7A1"];
          rgb = vary(pick(esPal, x, y, 370), x, y, 12);
          if (hash(x, y, 371) < 0.1) rgb = [Math.max(0, rgb[0] - 15), Math.max(0, rgb[1] - 15), Math.max(0, rgb[2] - 10)];
          break;
        }
        case OBSIDIAN: {
          const obPal = ["#0E0520", "#120828", "#0A0318", "#160A30", "#100620"];
          rgb = vary(pick(obPal, x, y, 380), x, y, 8);
          if (hash(x, y, 381) < 0.08) rgb = [Math.min(255, rgb[0] + 30), Math.min(255, rgb[1] + 15), Math.min(255, rgb[2] + 50)];
          break;
        }
        case PURPUR: {
          const ppPal = ["#A878A8", "#9C6C9C", "#B484B4", "#9060A0", "#AA7CAA"];
          const brickX = Math.floor(x / 4), brickY = Math.floor(y / 4);
          rgb = vary(pick(ppPal, brickX, brickY, 390), x, y, 10);
          if (x % 4 === 0 || y % 4 === 0) rgb = [Math.max(0, rgb[0] - 18), Math.max(0, rgb[1] - 18), Math.max(0, rgb[2] - 18)];
          break;
        }
        case CHORUS_PLANT: {
          const cpPal = ["#8A508A", "#7A4580", "#9A5B95", "#6E3A70", "#8C528C"];
          rgb = vary(pick(cpPal, x, y, 400), x, y, 14);
          if (hash(x, y, 401) < 0.12) rgb = [Math.min(255, rgb[0] + 30), Math.min(255, rgb[1] + 20), Math.min(255, rgb[2] + 30)];
          // Flower tips
          if (y < 3 && hash(x, y, 402) < 0.3) rgb = [Math.min(255, rgb[0] + 50), rgb[1], Math.min(255, rgb[2] + 50)];
          break;
        }
        case DRAGON_EGG: {
          const dePal = ["#0C0C14", "#101020", "#08080E", "#14142A", "#0E0E18"];
          rgb = vary(pick(dePal, x, y, 410), x, y, 8);
          // Purple sparkle spots
          if (hash(x, y, 411) < 0.12) rgb = [140, 60, 200];
          if (hash(x, y, 412) < 0.05) rgb = [200, 100, 255];
          // Egg shape: round the corners
          const cx = x - B / 2, cy = y - B / 2;
          const dist = Math.sqrt(cx * cx * 1.2 + cy * cy * 0.8);
          if (dist > 7) rgb = [0, 0, 0]; // transparent-ish (black void)
          break;
        }
        default: rgb = [255, 0, 255];
      }
      set(x, y, rgb[0], rgb[1], rgb[2]);
    }
    ac.putImageData(img, type * B, 0);
  }
  for (let t = 1; t <= 10; t++) gen(t);
  [CHERRY_WOOD, CHERRY_LEAVES, SNOW, ICE, CACTUS, SANDSTONE, SPRUCE_LEAVES, PALE_WOOD, PALE_LEAVES, PALE_MOSS,
   NETHERRACK, SOUL_SAND, NETHER_BRICK, GLOWSTONE, LAVA, NETHER_WART_BLOCK, CRIMSON_STEM, BASALT, NETHERITE_ORE,
   END_STONE, OBSIDIAN, PURPUR, CHORUS_PLANT, DRAGON_EGG].forEach(gen);
  return atlas;
}

// ── World gen ──
const terrainH = (x: number, s: number) =>
  Math.floor(WH * 0.35 + Math.sin(x * 0.08 + s) * 4 + Math.sin(x * 0.17 + s * 1.7) * 2 + Math.sin(x * 0.03 + s * 3.1) * 5);

function genWorld(seed: number) {
  const w: number[][] = Array.from({ length: WH }, () => new Array(WW).fill(AIR));
  for (let x = 0; x < WW; x++) {
    const sy = terrainH(x, seed);
    const biome = getBiome(x, seed);

    for (let y = sy; y < WH; y++) {
      if (y >= WH - 1) { w[y][x] = BEDROCK; continue; }

      if (biome === BIOME_DESERT) {
        if (y < sy + 5) w[y][x] = SAND;
        else if (y < sy + 8) w[y][x] = SANDSTONE;
        else {
          w[y][x] = STONE;
          const h = hash(x, y, seed);
          if (y > sy + 14 && h < 0.012) w[y][x] = DIAMOND;
          else if (y > sy + 5 && h < 0.045) w[y][x] = COAL;
        }
      } else if (biome === BIOME_SNOWY) {
        if (y === sy) w[y][x] = hash(x, 0, seed + 55) < 0.15 ? ICE : SNOW;
        else if (y < sy + 4) w[y][x] = DIRT;
        else {
          w[y][x] = STONE;
          const h = hash(x, y, seed);
          if (y > sy + 14 && h < 0.012) w[y][x] = DIAMOND;
          else if (y > sy + 5 && h < 0.045) w[y][x] = COAL;
        }
      } else if (biome === BIOME_PALE_GARDEN) {
        if (y === sy) w[y][x] = GRASS;
        else if (y < sy + 4) w[y][x] = DIRT;
        else {
          w[y][x] = STONE;
          const h = hash(x, y, seed);
          if (y > sy + 14 && h < 0.012) w[y][x] = DIAMOND;
          else if (y > sy + 5 && h < 0.045) w[y][x] = COAL;
        }
      } else {
        // Plains and Cherry share same ground
        if (y === sy) w[y][x] = GRASS;
        else if (y < sy + 4) w[y][x] = DIRT;
        else {
          w[y][x] = STONE;
          const h = hash(x, y, seed);
          if (y > sy + 14 && h < 0.012) w[y][x] = DIAMOND;
          else if (y > sy + 5 && h < 0.045) w[y][x] = COAL;
        }
      }
    }

    // Trees per biome
    const treeChance = hash(x, 0, seed + 99);
    if (x > 3 && x < WW - 3) {
      if (biome === BIOME_PLAINS && treeChance < 0.1) {
        // Oak tree
        const th = 4 + Math.floor(hash(x, 1, seed) * 2);
        for (let t = 1; t <= th; t++) if (sy - t >= 0) w[sy - t][x] = WOOD;
        for (let ly = -2; ly <= 0; ly++) for (let lx = -2; lx <= 2; lx++) {
          const ty = sy - th + ly, tx = x + lx;
          if (ty >= 0 && tx >= 0 && tx < WW && w[ty][tx] === AIR && (Math.abs(lx) + Math.abs(ly) < 3 || hash(tx, ty, seed + 77) < 0.5))
            w[ty][tx] = LEAVES;
        }
      } else if (biome === BIOME_CHERRY && treeChance < 0.12) {
        // Cherry blossom tree - taller, wider round canopy
        const th = 5 + Math.floor(hash(x, 1, seed) * 2);
        for (let t = 1; t <= th; t++) if (sy - t >= 0) w[sy - t][x] = CHERRY_WOOD;
        for (let ly = -3; ly <= 1; ly++) for (let lx = -3; lx <= 3; lx++) {
          const ty = sy - th + ly, tx = x + lx;
          if (ty >= 0 && tx >= 0 && tx < WW && w[ty][tx] === AIR) {
            const dist = Math.abs(lx) + Math.abs(ly);
            if (dist < 4 || (dist === 4 && hash(tx, ty, seed + 77) < 0.3))
              w[ty][tx] = CHERRY_LEAVES;
          }
        }
      } else if (biome === BIOME_DESERT && treeChance < 0.05) {
        // Cactus
        const ch = 2 + Math.floor(hash(x, 1, seed) * 3);
        for (let t = 0; t < ch; t++) if (sy - 1 - t >= 0) w[sy - 1 - t][x] = CACTUS;
      } else if (biome === BIOME_PALE_GARDEN && treeChance < 0.14) {
        // Pale oak tree - tall with hanging moss
        const th = 5 + Math.floor(hash(x, 1, seed) * 3);
        for (let t = 1; t <= th; t++) if (sy - t >= 0) w[sy - t][x] = PALE_WOOD;
        // Wide canopy
        for (let ly = -3; ly <= 0; ly++) for (let lx = -3; lx <= 3; lx++) {
          const ty = sy - th + ly, tx = x + lx;
          if (ty >= 0 && tx >= 0 && tx < WW && w[ty][tx] === AIR) {
            const dist = Math.abs(lx) + Math.abs(ly);
            if (dist < 4 || (dist === 4 && hash(tx, ty, seed + 88) < 0.3))
              w[ty][tx] = PALE_LEAVES;
          }
        }
        // Hanging moss below leaf edges
        for (let lx = -3; lx <= 3; lx++) {
          const tx = x + lx;
          if (tx < 0 || tx >= WW) continue;
          const leafY = sy - th;
          if (leafY + 1 < WH && w[leafY][tx] === PALE_LEAVES && hash(tx, leafY, seed + 150) < 0.45) {
            const mossLen = 1 + Math.floor(hash(tx, leafY, seed + 151) * 3);
            for (let m = 1; m <= mossLen; m++) {
              const my = leafY + m;
              if (my < WH && w[my][tx] === AIR) w[my][tx] = PALE_MOSS;
              else break;
            }
          }
        }
      } else if (biome === BIOME_SNOWY && treeChance < 0.1) {
        // Spruce tree - tall, narrow pointed canopy
        const th = 5 + Math.floor(hash(x, 1, seed) * 3);
        for (let t = 1; t <= th; t++) if (sy - t >= 0) w[sy - t][x] = WOOD;
        if (sy - th - 1 >= 0) w[sy - th - 1][x] = SPRUCE_LEAVES;
        for (let dy = 0; dy < th - 1; dy++) {
          const y = sy - th + dy;
          if (y < 0) continue;
          const maxW = Math.min(2, Math.floor(dy / 2));
          for (let lx = -maxW; lx <= maxW; lx++) {
            const tx = x + lx;
            if (tx >= 0 && tx < WW && w[y][tx] === AIR)
              w[y][tx] = SPRUCE_LEAVES;
          }
        }
      }
    }
  }

  // Caves (only carve underground stone-like blocks)
  const carveable = new Set([STONE, COAL, DIAMOND, DIRT, SANDSTONE]);
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++)
    if (carveable.has(w[y][x])) {
      const c = Math.sin(x * 0.15 + seed) * Math.cos(y * 0.2 + seed * 0.5) + Math.sin(x * 0.08 - y * 0.1 + seed * 2);
      if (c > 0.82) w[y][x] = AIR;
    }
  return w;
}

// ── Nether World gen ──
function genNetherWorld(seed: number) {
  const w: number[][] = Array.from({ length: WH }, () => new Array(WW).fill(AIR));
  // Nether: cavern with ceiling, lava lakes at bottom, netherrack everywhere

  // Floor and ceiling terrain heights
  const floorH = (x: number) =>
    Math.floor(WH * 0.7 + Math.sin(x * 0.1 + seed * 1.3) * 3 + Math.sin(x * 0.04 + seed * 2.1) * 4);
  const ceilH = (x: number) =>
    Math.floor(WH * 0.08 + Math.sin(x * 0.07 + seed * 0.9) * 2 + Math.sin(x * 0.15 + seed * 1.5) * 2);

  for (let x = 0; x < WW; x++) {
    const floor = floorH(x);
    const ceil = ceilH(x);

    // Ceiling (solid netherrack at top)
    for (let y = 0; y <= ceil; y++) {
      w[y][x] = NETHERRACK;
      if (y === ceil && hash(x, y, seed + 400) < 0.1) w[y][x] = GLOWSTONE;
    }

    // Floor (netherrack + soul sand + nether brick)
    for (let y = floor; y < WH; y++) {
      if (y >= WH - 1) { w[y][x] = BEDROCK; continue; }
      const h = hash(x, y, seed + 410);
      if (y === floor) {
        w[y][x] = h < 0.25 ? SOUL_SAND : NETHERRACK;
      } else if (y < floor + 4) {
        w[y][x] = h < 0.15 ? NETHER_BRICK : NETHERRACK;
      } else {
        w[y][x] = NETHERRACK;
        if (h < 0.03) w[y][x] = GLOWSTONE;
      }
    }

    // Lava lake at the very bottom (just above bedrock)
    const lavaLevel = WH - 5;
    for (let y = lavaLevel; y < WH - 1; y++) {
      if (w[y][x] === AIR) w[y][x] = LAVA;
    }
  }

  // Carve open cavern space (already mostly AIR between ceil and floor)
  // Add netherrack pillars and formations
  for (let x = 0; x < WW; x++) {
    const ceil = ceilH(x);
    const floor = floorH(x);
    // Random stalactites (hanging from ceiling)
    if (hash(x, 0, seed + 420) < 0.12) {
      const len = 2 + Math.floor(hash(x, 1, seed + 421) * 5);
      for (let dy = 0; dy < len; dy++) {
        const y = ceil + 1 + dy;
        if (y < floor && w[y][x] === AIR) w[y][x] = NETHERRACK;
      }
    }
    // Random stalagmites (rising from floor)
    if (hash(x, 2, seed + 430) < 0.1) {
      const len = 2 + Math.floor(hash(x, 3, seed + 431) * 4);
      for (let dy = 0; dy < len; dy++) {
        const y = floor - 1 - dy;
        if (y > ceil && w[y][x] === AIR) w[y][x] = NETHERRACK;
      }
    }
  }

  // Crimson trees (nether trees with crimson stems and nether wart block canopy)
  for (let x = 4; x < WW - 4; x++) {
    const floor = floorH(x);
    if (hash(x, 0, seed + 450) < 0.06 && floor - 1 > ceilH(x) + 5) {
      const th = 4 + Math.floor(hash(x, 1, seed + 451) * 3);
      // Stem
      for (let t = 1; t <= th; t++) {
        const y = floor - t;
        if (y >= 0 && w[y][x] === AIR) w[y][x] = CRIMSON_STEM;
      }
      // Canopy (nether wart blocks)
      for (let ly = -2; ly <= 0; ly++) for (let lx = -2; lx <= 2; lx++) {
        const ty = floor - th + ly, tx = x + lx;
        if (ty >= 0 && tx >= 0 && tx < WW && w[ty][tx] === AIR) {
          const dist = Math.abs(lx) + Math.abs(ly);
          if (dist < 3 || (dist === 3 && hash(tx, ty, seed + 452) < 0.4))
            w[ty][tx] = NETHER_WART_BLOCK;
        }
      }
    }
  }

  // Glowstone clusters hanging from ceiling
  for (let x = 2; x < WW - 2; x++) {
    const ceil = ceilH(x);
    if (hash(x, 5, seed + 460) < 0.08) {
      for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy <= 2; dy++) {
        const tx = x + dx, ty = ceil + 1 + dy;
        if (tx >= 0 && tx < WW && ty < WH && w[ty][tx] === AIR && hash(tx, ty, seed + 461) < 0.7)
          w[ty][tx] = GLOWSTONE;
      }
    }
  }

  // Basalt pillars
  for (let x = 0; x < WW; x++) {
    if (hash(x, 10, seed + 470) < 0.04) {
      const ceil = ceilH(x);
      const floor = floorH(x);
      for (let y = ceil + 1; y < floor; y++) {
        if (w[y][x] === AIR) w[y][x] = BASALT;
      }
    }
  }

  // Place exactly ONE Ancient Debris (Netherite) block hidden in the floor
  const debrisX = Math.floor(WW * 0.3 + hash(0, 0, seed + 500) * WW * 0.4);
  const debrisFloor = floorH(debrisX);
  const debrisY = debrisFloor + 2; // buried 2 blocks below floor surface
  if (debrisY < WH - 1) w[debrisY][debrisX] = NETHERITE_ORE;

  return w;
}

// ── End World gen ──
function genEndWorld(seed: number) {
  const w: number[][] = Array.from({ length: WH }, () => new Array(WW).fill(AIR));

  // The End: floating main island + smaller islands, void below
  // Main central island
  const centerX = Math.floor(WW / 2);
  const islandY = Math.floor(WH * 0.55); // floating platform level
  const islandRadius = 18;

  // Generate main island (elliptical end stone platform)
  for (let x = centerX - islandRadius; x <= centerX + islandRadius; x++) {
    if (x < 0 || x >= WW) continue;
    const dx = (x - centerX) / islandRadius;
    const thickness = Math.floor((1 - dx * dx) * 6) + 2;
    const topY = islandY - Math.floor((1 - dx * dx) * 2); // slight dome
    for (let dy = 0; dy < thickness; dy++) {
      const y = topY + dy;
      if (y >= 0 && y < WH) w[y][x] = END_STONE;
    }
  }

  // Obsidian pillars (end crystals)
  const pillarPositions = [centerX - 10, centerX - 4, centerX + 5, centerX + 12];
  for (const px of pillarPositions) {
    if (px < 0 || px >= WW) continue;
    const pillarH = 8 + Math.floor(hash(px, 0, seed + 600) * 10);
    const pillarTop = islandY - pillarH;
    for (let y = pillarTop; y <= islandY; y++) {
      if (y >= 0 && y < WH) {
        w[y][px] = OBSIDIAN;
        if (px + 1 < WW) w[y][px + 1] = OBSIDIAN;
      }
    }
    // "End crystal" glow on top
    if (pillarTop - 1 >= 0) w[pillarTop - 1][px] = GLOWSTONE;
  }

  // Smaller floating islands
  const smallIslands = [
    { x: centerX - 30, y: islandY + 3, r: 6 },
    { x: centerX + 28, y: islandY - 2, r: 7 },
    { x: centerX - 45, y: islandY + 5, r: 5 },
    { x: centerX + 42, y: islandY + 4, r: 4 },
  ];
  for (const isle of smallIslands) {
    for (let x = isle.x - isle.r; x <= isle.x + isle.r; x++) {
      if (x < 0 || x >= WW) continue;
      const dx = (x - isle.x) / isle.r;
      const thickness = Math.floor((1 - dx * dx) * 3) + 1;
      for (let dy = 0; dy < thickness; dy++) {
        const y = isle.y + dy;
        if (y >= 0 && y < WH) w[y][x] = END_STONE;
      }
    }
  }

  // Chorus plants on the islands
  for (let x = 2; x < WW - 2; x++) {
    if (hash(x, 0, seed + 620) > 0.08) continue;
    // Find end stone surface at this x
    for (let y = 0; y < WH - 1; y++) {
      if (w[y][x] === END_STONE && (y === 0 || w[y - 1][x] === AIR)) {
        const ch = 3 + Math.floor(hash(x, 1, seed + 621) * 4);
        for (let t = 1; t <= ch; t++) {
          if (y - t >= 0 && w[y - t][x] === AIR) w[y - t][x] = CHORUS_PLANT;
        }
        // Branch
        if (hash(x, 2, seed + 622) < 0.5 && x + 1 < WW && y - 2 >= 0 && w[y - 2][x + 1] === AIR) {
          w[y - 2][x + 1] = CHORUS_PLANT;
          if (y - 3 >= 0 && w[y - 3][x + 1] === AIR) w[y - 3][x + 1] = CHORUS_PLANT;
        }
        break;
      }
    }
  }

  // Purpur structures
  const purpurX = centerX + 15;
  if (purpurX + 3 < WW) {
    const baseY = islandY;
    for (let dy = -5; dy <= 0; dy++) for (let dx = 0; dx < 4; dx++) {
      const y = baseY + dy, x = purpurX + dx;
      if (y >= 0 && y < WH && x < WW && w[y][x] === AIR) w[y][x] = PURPUR;
    }
  }

  // Place the Dragon Egg on top of the tallest obsidian pillar
  const tallestPillar = pillarPositions.reduce((best, px) => {
    const h = 8 + Math.floor(hash(px, 0, seed + 600) * 10);
    return h > best.h ? { px, h } : best;
  }, { px: pillarPositions[0], h: 0 });
  const eggY = islandY - tallestPillar.h - 2;
  if (eggY >= 0 && tallestPillar.px < WW) {
    w[eggY][tallestPillar.px] = DRAGON_EGG;
  }

  return w;
}

interface Cloud { x: number; y: number; w: number; h: number; speed: number }
function genClouds(seed: number): Cloud[] {
  const clouds: Cloud[] = [];
  for (let i = 0; i < 8; i++) clouds.push({
    x: hash(i, 0, seed + 300) * WW * B, y: 8 + hash(i, 1, seed + 300) * 35,
    w: 50 + hash(i, 2, seed + 300) * 70, h: 12 + hash(i, 4, seed + 300) * 10,
    speed: 0.12 + hash(i, 3, seed + 300) * 0.25,
  });
  return clouds;
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }
interface ChatMsg { text: string; color: string; time: number }

const BLOCK_COLOR: Record<number, string> = {
  [GRASS]: "#5da33a", [DIRT]: "#866527", [STONE]: "#808080", [WOOD]: "#6B4A2A",
  [LEAVES]: "#2D8C2D", [COAL]: "#555", [DIAMOND]: "#4DD5E5", [SAND]: "#D9C479", [PLANK]: "#B48C4E",
  [CHERRY_WOOD]: "#8B5A5A", [CHERRY_LEAVES]: "#F2A0B5", [SNOW]: "#F0F4F8",
  [ICE]: "#A0D8EF", [CACTUS]: "#2D6B2D", [SANDSTONE]: "#D4B878", [SPRUCE_LEAVES]: "#1A4A1A",
  [PALE_WOOD]: "#C8BDA8", [PALE_LEAVES]: "#8A9A7A", [PALE_MOSS]: "#C8D0B8",
  [NETHERRACK]: "#6B2020", [SOUL_SAND]: "#4A3828", [NETHER_BRICK]: "#2C1016",
  [GLOWSTONE]: "#D4A840", [LAVA]: "#CF4A00", [NETHER_WART_BLOCK]: "#730A0A",
  [CRIMSON_STEM]: "#6B2040", [BASALT]: "#3A3A40", [NETHERITE_ORE]: "#4A3228",
  [END_STONE]: "#DDDBA5", [OBSIDIAN]: "#0E0520", [PURPUR]: "#A878A8",
  [CHORUS_PLANT]: "#8A508A", [DRAGON_EGG]: "#0C0C14",
};

// Tool colors for icon drawing
const TOOL_COLORS: Record<number, { head: string; stick: string }> = {
  [WOOD_PICK]: { head: "#B48C4E", stick: "#6B4A2A" },
  [STONE_PICK]: { head: "#808080", stick: "#6B4A2A" },
  [DIAMOND_PICK]: { head: "#4DD5E5", stick: "#6B4A2A" },
  [WOOD_SWORD]: { head: "#B48C4E", stick: "#6B4A2A" },
  [STONE_SWORD]: { head: "#808080", stick: "#6B4A2A" },
  [DIAMOND_SWORD]: { head: "#4DD5E5", stick: "#6B4A2A" },
  [TORCH]: { head: "#FFD700", stick: "#6B4A2A" },
};

export function MineRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<ChatMsg[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stateRef = useRef<any>(null);
  const [inputVal, setInputVal] = useState("");

  const addChat = useCallback((text: string, color = "#fff") => {
    chatRef.current.push({ text, color, time: Date.now() });
    if (chatRef.current.length > 50) chatRef.current.shift();
  }, []);

  const handleCommand = useCallback((input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (trimmed.startsWith("/")) {
      const cmd = trimmed.slice(1).toLowerCase().trim();

      if (cmd === "help") {
        addChat("Commands:", "#ffd700");
        addChat("  /craft <item> - Craft an item", "#aaa");
        addChat("  /recipes - Show all recipes", "#aaa");
        addChat("  /inventory - Show your items", "#aaa");
        return;
      }

      if (cmd === "recipes") {
        addChat("── Recipes ──", "#ffd700");
        const seen = new Set<number>();
        for (const [name, r] of Object.entries(RECIPES)) {
          if (seen.has(r.result)) continue;
          seen.add(r.result);
          const ingr = r.ingredients.map(([id, n]) => `${n}x ${ITEM_NAMES[id]}`).join(" + ");
          addChat(`  /${name} → ${r.count}x ${ITEM_NAMES[r.result]}`, "#8f8");
          addChat(`    Needs: ${ingr}`, "#aaa");
        }
        return;
      }

      if (cmd === "inventory" || cmd === "inv") {
        const s = stateRef.current;
        if (!s) return;
        addChat("── Inventory ──", "#ffd700");
        let hasItems = false;
        s.inventory.forEach((count: number, id: number) => {
          if (count > 0) { addChat(`  ${ITEM_NAMES[id] || "???"}: ${count}`, "#ccc"); hasItems = true; }
        });
        if (!hasItems) addChat("  (empty)", "#888");
        return;
      }

      // Try crafting - support both "/craft diamond pickaxe" and "/diamond pickaxe"
      let craftName = cmd;
      if (craftName.startsWith("craft ")) craftName = craftName.slice(6).trim();

      const recipe = RECIPES[craftName];
      if (!recipe) {
        addChat(`Unknown: "${craftName}". Type /recipes`, "#f66");
        return;
      }

      const s = stateRef.current;
      if (!s) return;

      // Check ingredients
      const missing: string[] = [];
      for (const [itemId, needed] of recipe.ingredients) {
        const have = s.inventory.get(itemId) || 0;
        if (have < needed) missing.push(`${needed - have} more ${ITEM_NAMES[itemId]}`);
      }

      if (missing.length > 0) {
        addChat(`Need: ${missing.join(", ")}`, "#f66");
        return;
      }

      // Consume ingredients
      for (const [itemId, needed] of recipe.ingredients) {
        s.inventory.set(itemId, (s.inventory.get(itemId) || 0) - needed);
        if ((s.inventory.get(itemId) || 0) <= 0) s.inventory.delete(itemId);
      }

      // Give result
      s.inventory.set(recipe.result, (s.inventory.get(recipe.result) || 0) + recipe.count);

      // Add to hotbar if not there
      if (!s.hotbar.includes(recipe.result)) {
        const empty = s.hotbar.indexOf(0);
        if (empty >= 0) s.hotbar[empty] = recipe.result;
      }

      addChat(`Crafted ${recipe.count}x ${ITEM_NAMES[recipe.result]}!`, "#5f5");

      // Diamond pickaxe crafted → trigger Nether teleport
      if (recipe.result === DIAMOND_PICK) {
        addChat(`[DEBUG] dim=${s.dimension} fn=${!!s.teleportToNether}`, "#ff0");
        if (s.dimension === "overworld") {
          if (s.teleportToNether) {
            addChat("Teleporting to Nether...", "#f44");
            s.teleportToNether();
          } else {
            addChat("Setting pendingTeleport flag...", "#f44");
            s.pendingTeleport = true;
          }
        }
      }
    } else {
      addChat(`<You> ${trimmed}`, "#ddd");
    }
  }, [addChat]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    const atlas = buildAtlas();
    const seed = Math.random() * 10000;
    let world = genWorld(seed);

    const spawnX = Math.floor(WW / 2);
    let spawnY = 0;
    for (let y = 0; y < WH; y++) { if (world[y][spawnX] !== AIR) { spawnY = y - 2; break; } }

    const s = {
      world, px: spawnX * B + 2, py: spawnY * B,
      vx: 0, vy: 0, onGround: false, camX: 0, camY: 0,
      keys: new Set<string>(), mouseX: -1, mouseY: -1,
      inventory: new Map<number, number>([[DIRT, 10], [WOOD, 5]]),
      hotbar: [DIRT, STONE, WOOD, PLANK, LEAVES, SAND, 0, 0, 0] as number[],
      selected: 0, facing: 1, walkFrame: 0,
      clouds: genClouds(seed), particles: [] as Particle[],
      miningBlock: null as { bx: number; by: number; t: number } | null,
      mouseDown: false,
      dimension: "overworld" as "overworld" | "nether" | "end",
      portalAnim: 0, // > 0 means portal animation is playing
      victory: false,
      pendingTeleport: false,
      pendingDimension: "" as string,
      teleportToNether: null as (() => void) | null,
      teleportToEnd: null as (() => void) | null,
    };
    stateRef.current = s;

    // Teleport to Nether function
    const teleportToNether = () => {
      s.portalAnim = 60; // 60 frames of portal animation
      s.dimension = "nether";
      world = genNetherWorld(seed + 777);
      s.world = world;
      // Find spawn: center of world, on the floor
      const nSpawnX = Math.floor(WW / 2);
      let nSpawnY = 0;
      for (let y = 0; y < WH; y++) { if (world[y][nSpawnX] !== AIR) { nSpawnY = y - 2; break; } }
      s.px = nSpawnX * B + 2;
      s.py = nSpawnY * B;
      s.vx = 0; s.vy = 0;
      s.camX = s.px - canvas.width / 2;
      s.camY = s.py - canvas.height / 2;
      addChat("You entered the Nether!", "#f44");
      addChat("Find and mine the Ancient Debris!", "#ffd700");
      addChat("(Only a Diamond Pickaxe can break it)", "#aaa");
    };

    // Teleport to The End function
    const teleportToEnd = () => {
      s.portalAnim = 60;
      s.dimension = "end";
      world = genEndWorld(seed + 1337);
      s.world = world;
      const eSpawnX = Math.floor(WW / 2);
      let eSpawnY = 0;
      for (let y = 0; y < WH; y++) { if (world[y][eSpawnX] !== AIR) { eSpawnY = y - 2; break; } }
      s.px = eSpawnX * B + 2;
      s.py = eSpawnY * B;
      s.vx = 0; s.vy = 0;
      s.camX = s.px - canvas.width / 2;
      s.camY = s.py - canvas.height / 2;
      addChat("You entered The End!", "#c070ff");
      addChat("Find the Dragon Egg atop the tallest pillar!", "#ffd700");
    };

    // Store teleport functions on state so handleCommand can call them
    s.teleportToNether = teleportToNether;
    s.teleportToEnd = teleportToEnd;

    addChat("Welcome to MineRunner!", "#5f5");
    addChat("Explore biomes: Plains, Cherry, Desert, Snowy, Pale Garden", "#aaa");
    addChat("Type /help for commands, /recipes to craft", "#aaa");
    addChat("Goal: Craft a Diamond Pickaxe to enter the Nether!", "#ffd700");

    const solid = (gx: number, gy: number) => {
      if (gx < 0 || gx >= WW || gy >= WH) return true;
      if (gy < 0) return false;
      const blk = s.world[gy][gx];
      return blk !== AIR && blk !== LAVA;
    };
    const getHovered = () => {
      if (s.mouseX < 0) return null;
      const bx = Math.floor((s.mouseX + s.camX) / B), by = Math.floor((s.mouseY + s.camY) / B);
      const dist = Math.hypot((bx + 0.5) * B - (s.px + PW / 2), (by + 0.5) * B - (s.py + PH / 2));
      if (dist <= REACH * B && bx >= 0 && bx < WW && by >= 0 && by < WH) return { bx, by };
      return null;
    };

    // Get mining time based on held tool
    const getMineTime = () => {
      const held = s.hotbar[s.selected];
      return PICK_SPEED[held] || BASE_MINE_TIME;
    };

    // ── Update ──
    const update = () => {
      // Handle portal animation
      if (s.portalAnim > 0) {
        s.portalAnim--;
        return; // Freeze gameplay during portal animation
      }

      // Handle pending teleport
      if (s.pendingTeleport) {
        s.pendingTeleport = false;
        if (s.pendingDimension === "end") teleportToEnd();
        else teleportToNether();
        return;
      }

      // Lava damage: if player touches lava, respawn
      const plx1 = Math.floor(s.px / B), plx2 = Math.floor((s.px + PW - 1) / B);
      const ply1 = Math.floor(s.py / B), ply2 = Math.floor((s.py + PH - 1) / B);
      for (let gy = ply1; gy <= ply2; gy++) for (let gx = plx1; gx <= plx2; gx++) {
        if (gx >= 0 && gx < WW && gy >= 0 && gy < WH && s.world[gy][gx] === LAVA) {
          addChat("You fell in lava!", "#f44");
          // Respawn at center
          const rspX = Math.floor(WW / 2);
          let rspY = 0;
          for (let y = 0; y < WH; y++) { if (s.world[y][rspX] !== AIR) { rspY = y - 2; break; } }
          s.px = rspX * B + 2; s.py = rspY * B;
          s.vx = 0; s.vy = 0;
          return;
        }
      }

      let mx = 0;
      if (s.keys.has("a") || s.keys.has("arrowleft")) { mx = -SPEED; s.facing = -1; }
      if (s.keys.has("d") || s.keys.has("arrowright")) { mx = SPEED; s.facing = 1; }
      s.vx = mx;
      if (mx !== 0) s.walkFrame++;
      if ((s.keys.has(" ") || s.keys.has("w") || s.keys.has("arrowup")) && s.onGround) s.vy = JUMP;
      s.vy += GRAVITY; if (s.vy > 12) s.vy = 12;

      s.px += s.vx;
      let l = Math.floor(s.px / B), r = Math.floor((s.px + PW - 1) / B);
      let t = Math.floor(s.py / B), b = Math.floor((s.py + PH - 1) / B);
      xloop: for (let gy = t; gy <= b; gy++) for (let gx = l; gx <= r; gx++)
        if (solid(gx, gy)) { s.px = s.vx > 0 ? gx * B - PW : (gx + 1) * B; s.vx = 0; break xloop; }

      s.py += s.vy;
      l = Math.floor(s.px / B); r = Math.floor((s.px + PW - 1) / B);
      t = Math.floor(s.py / B); b = Math.floor((s.py + PH - 1) / B);
      s.onGround = false;
      yloop: for (let gy = t; gy <= b; gy++) for (let gx = l; gx <= r; gx++)
        if (solid(gx, gy)) {
          if (s.vy > 0) { s.py = gy * B - PH; s.onGround = true; } else s.py = (gy + 1) * B;
          s.vy = 0; break yloop;
        }

      if (s.px < 0) s.px = 0;
      if (s.px > (WW - 1) * B) s.px = (WW - 1) * B;
      if (s.py > (WH - 1) * B) { s.py = (WH - 1) * B; s.vy = 0; s.onGround = true; }

      s.camX += ((s.px + PW / 2 - canvas.width / 2) - s.camX) * 0.12;
      s.camY += ((s.py + PH / 2 - canvas.height / 2) - s.camY) * 0.12;
      s.camX = Math.max(0, Math.min(WW * B - canvas.width, s.camX));
      s.camY = Math.max(0, Math.min(WH * B - canvas.height, s.camY));

      for (const c of s.clouds) { c.x += c.speed; if (c.x > WW * B + 100) c.x = -c.w - 50; }

      // Mining
      const mineTime = getMineTime();
      if (s.mouseDown) {
        const hov = getHovered();
        if (hov && s.world[hov.by][hov.bx] !== AIR && s.world[hov.by][hov.bx] !== BEDROCK && s.world[hov.by][hov.bx] !== LAVA) {
          const blockType = s.world[hov.by][hov.bx];
          // Netherite ore + Dragon Egg: only diamond pickaxe can mine
          if ((blockType === NETHERITE_ORE || blockType === DRAGON_EGG) && s.hotbar[s.selected] !== DIAMOND_PICK) {
            s.miningBlock = null;
          } else if (s.miningBlock && s.miningBlock.bx === hov.bx && s.miningBlock.by === hov.by) {
            s.miningBlock.t += 1;
            const specialTime = (blockType === NETHERITE_ORE || blockType === DRAGON_EGG) ? 20 : mineTime;
            if (s.miningBlock.t >= specialTime) {
              const type = s.world[hov.by][hov.bx];
              s.world[hov.by][hov.bx] = AIR;
              s.inventory.set(type, (s.inventory.get(type) || 0) + 1);
              if (!s.hotbar.includes(type)) { const e = s.hotbar.indexOf(0); if (e >= 0) s.hotbar[e] = type; }
              const col = BLOCK_COLOR[type] || "#888";
              for (let i = 0; i < 8; i++) {
                const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.5;
                s.particles.push({ x: hov.bx * B + B / 2, y: hov.by * B + B / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, life: 1, color: col });
              }
              s.miningBlock = null;
              // Netherite ore → teleport to The End
              if (type === NETHERITE_ORE) {
                addChat("*** ANCIENT DEBRIS MINED! ***", "#ffd700");
                addChat("A portal to The End opens...", "#c070ff");
                teleportToEnd();
              }
              // Dragon Egg → Victory!
              if (type === DRAGON_EGG) {
                s.victory = true;
                addChat("*** DRAGON EGG CLAIMED! ***", "#ffd700");
                addChat("You beat MineRunner! GG!", "#5f5");
              }
            }
          } else s.miningBlock = { bx: hov.bx, by: hov.by, t: 0 };
        } else s.miningBlock = null;
      } else s.miningBlock = null;

      for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= 0.035; }
      s.particles = s.particles.filter(p => p.life > 0);
    };

    // ── Draw tool icon ──
    const drawToolIcon = (ctx: CanvasRenderingContext2D, itemId: number, x: number, y: number, size: number) => {
      const tc = TOOL_COLORS[itemId];
      if (!tc) return;
      const s2 = size;
      const isSword = itemId >= WOOD_SWORD && itemId <= DIAMOND_SWORD;
      const isTorch = itemId === TORCH;

      if (isTorch) {
        ctx.fillStyle = tc.stick;
        ctx.fillRect(x + s2 * 0.4, y + s2 * 0.3, s2 * 0.2, s2 * 0.6);
        ctx.fillStyle = "#ff6600";
        ctx.fillRect(x + s2 * 0.3, y + s2 * 0.1, s2 * 0.4, s2 * 0.25);
        ctx.fillStyle = tc.head;
        ctx.fillRect(x + s2 * 0.35, y + s2 * 0.05, s2 * 0.3, s2 * 0.15);
      } else if (isSword) {
        ctx.fillStyle = tc.stick;
        ctx.fillRect(x + s2 * 0.4, y + s2 * 0.6, s2 * 0.2, s2 * 0.35);
        ctx.fillStyle = "#888";
        ctx.fillRect(x + s2 * 0.25, y + s2 * 0.55, s2 * 0.5, s2 * 0.1);
        ctx.fillStyle = tc.head;
        ctx.fillRect(x + s2 * 0.35, y + s2 * 0.05, s2 * 0.3, s2 * 0.5);
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(x + s2 * 0.35, y + s2 * 0.05, s2 * 0.1, s2 * 0.45);
      } else {
        ctx.fillStyle = tc.stick;
        ctx.fillRect(x + s2 * 0.4, y + s2 * 0.4, s2 * 0.2, s2 * 0.55);
        ctx.fillStyle = tc.head;
        ctx.fillRect(x + s2 * 0.1, y + s2 * 0.1, s2 * 0.8, s2 * 0.25);
        ctx.fillRect(x + s2 * 0.1, y + s2 * 0.1, s2 * 0.15, s2 * 0.35);
        ctx.fillRect(x + s2 * 0.75, y + s2 * 0.1, s2 * 0.15, s2 * 0.35);
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillRect(x + s2 * 0.1, y + s2 * 0.1, s2 * 0.8, s2 * 0.08);
      }
    };

    // ── Render ──
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;

      const isNether = s.dimension === "nether";
      const isEnd = s.dimension === "end";

      // Portal animation overlay
      if (s.portalAnim > 0) {
        const prog = s.portalAnim / 60;
        const goingToEnd = s.dimension === "end";
        ctx.fillStyle = goingToEnd ? `rgba(0, 0, 0, ${prog})` : `rgba(80, 0, 120, ${prog})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Swirling particles
        ctx.fillStyle = goingToEnd ? "#40e0d0" : "#c070ff";
        for (let i = 0; i < 20; i++) {
          const angle = (Date.now() * 0.003 + i * 0.5) % (Math.PI * 2);
          const radius = (1 - prog) * 150;
          const px = canvas.width / 2 + Math.cos(angle) * radius;
          const py = canvas.height / 2 + Math.sin(angle) * radius;
          ctx.fillRect(px, py, 4, 4);
        }
        // Stars for End portal
        if (goingToEnd) {
          ctx.fillStyle = "#fff";
          for (let i = 0; i < 30; i++) {
            const sx = hash(i, 0, 950) * canvas.width;
            const sy = hash(i, 1, 951) * canvas.height;
            const twinkle = Math.sin(Date.now() * 0.005 + i) * 0.5 + 0.5;
            ctx.globalAlpha = twinkle * prog;
            ctx.fillRect(sx, sy, 2, 2);
          }
          ctx.globalAlpha = 1;
        }
        ctx.font = "bold 18px monospace"; ctx.textAlign = "center";
        ctx.fillStyle = goingToEnd ? "#40e0d0" : "#e0a0ff";
        ctx.fillText(goingToEnd ? "Entering The End..." : "Entering the Nether...", canvas.width / 2, canvas.height / 2);
        return;
      }

      // Determine biome at camera center for sky tinting
      const camCenterX = Math.floor((s.camX + canvas.width / 2) / B);
      const currentBiome = (isNether || isEnd) ? -1 : getBiome(Math.max(0, Math.min(WW - 1, camCenterX)), seed);

      // Sky with biome tint
      const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
      if (isEnd) {
        sky.addColorStop(0, "#030008"); sky.addColorStop(0.3, "#060010");
        sky.addColorStop(0.6, "#0a0018"); sky.addColorStop(1, "#0e0020");
      } else if (isNether) {
        sky.addColorStop(0, "#1a0000"); sky.addColorStop(0.3, "#2a0505");
        sky.addColorStop(0.6, "#3a0a0a"); sky.addColorStop(1, "#4a1010");
      } else if (currentBiome === BIOME_CHERRY) {
        sky.addColorStop(0, "#c490d9"); sky.addColorStop(0.35, "#d4a8e8");
        sky.addColorStop(0.7, "#e8c4f0"); sky.addColorStop(1, "#f0d8f7");
      } else if (currentBiome === BIOME_DESERT) {
        sky.addColorStop(0, "#7ab0d0"); sky.addColorStop(0.35, "#a0c8d8");
        sky.addColorStop(0.7, "#d0dcc0"); sky.addColorStop(1, "#e8ddb0");
      } else if (currentBiome === BIOME_SNOWY) {
        sky.addColorStop(0, "#8098b0"); sky.addColorStop(0.35, "#99aec4");
        sky.addColorStop(0.7, "#b4c6d8"); sky.addColorStop(1, "#c8d8e4");
      } else if (currentBiome === BIOME_PALE_GARDEN) {
        sky.addColorStop(0, "#6b7a6b"); sky.addColorStop(0.35, "#8a9888");
        sky.addColorStop(0.7, "#a4b0a0"); sky.addColorStop(1, "#b8c4b4");
      } else {
        sky.addColorStop(0, "#4a90d9"); sky.addColorStop(0.35, "#72b4e8");
        sky.addColorStop(0.7, "#9ed0f5"); sky.addColorStop(1, "#b8dff7");
      }
      ctx.fillStyle = sky; ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!isNether && !isEnd) {
        // Sun
        const sunX = canvas.width * 0.8 - s.camX * 0.01;
        ctx.fillStyle = "#fff7b0"; ctx.beginPath(); ctx.arc(sunX, 40, 20, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,247,176,0.12)"; ctx.beginPath(); ctx.arc(sunX, 40, 35, 0, Math.PI * 2); ctx.fill();

        // Mountains
        ctx.fillStyle = currentBiome === BIOME_SNOWY ? "rgba(200,210,230,0.3)" : "rgba(100,140,180,0.25)";
        for (let mx = -50; mx < canvas.width + 100; mx += 3) {
          const mh = 30 + Math.sin((mx + s.camX * 0.05) * 0.012) * 25 + Math.sin((mx + s.camX * 0.05) * 0.025) * 15;
          ctx.fillRect(mx, canvas.height * 0.3 - mh / 2, 3, mh);
        }

        // Clouds
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        for (const c of s.clouds) {
          const cx = Math.floor(c.x - s.camX * 0.3);
          if (cx > -c.w - 20 && cx < canvas.width + 20) {
            ctx.fillRect(cx, c.y, c.w, c.h);
            ctx.fillRect(cx + c.w * 0.1, c.y - c.h * 0.6, c.w * 0.3, c.h * 0.7);
            ctx.fillRect(cx + c.w * 0.45, c.y - c.h * 0.8, c.w * 0.25, c.h * 0.9);
            ctx.fillStyle = "rgba(200,215,230,0.6)"; ctx.fillRect(cx, c.y + c.h * 0.6, c.w, c.h * 0.4);
            ctx.fillStyle = "rgba(255,255,255,0.85)";
          }
        }
      } else if (isNether) {
        // Nether: lava glow particles in the air
        ctx.fillStyle = "rgba(255,100,0,0.15)";
        for (let i = 0; i < 12; i++) {
          const px = (hash(i, Math.floor(Date.now() * 0.0005), 900) * canvas.width);
          const py = (hash(i, Math.floor(Date.now() * 0.0003), 901) * canvas.height * 0.5);
          ctx.fillRect(px, py, 2 + hash(i, 0, 902) * 3, 2 + hash(i, 1, 903) * 3);
        }
      } else {
        // The End: stars
        ctx.fillStyle = "#fff";
        for (let i = 0; i < 40; i++) {
          const sx = hash(i, 0, 960) * canvas.width;
          const sy = hash(i, 1, 961) * canvas.height * 0.6;
          const twinkle = Math.sin(Date.now() * 0.002 + i * 1.5) * 0.4 + 0.6;
          ctx.globalAlpha = twinkle;
          ctx.fillRect(sx, sy, hash(i, 2, 962) < 0.3 ? 2 : 1, hash(i, 2, 962) < 0.3 ? 2 : 1);
        }
        ctx.globalAlpha = 1;
        // Ender dragon silhouette hint (subtle wing shapes far away)
        const dragonX = canvas.width * 0.5 + Math.sin(Date.now() * 0.0008) * 80;
        const dragonY = 50 + Math.sin(Date.now() * 0.001) * 15;
        ctx.fillStyle = "rgba(30,0,50,0.4)";
        // Body
        ctx.fillRect(dragonX - 8, dragonY, 16, 5);
        // Wings
        const wingFlap = Math.sin(Date.now() * 0.006) * 4;
        ctx.fillRect(dragonX - 25, dragonY - wingFlap, 18, 3);
        ctx.fillRect(dragonX + 8, dragonY + wingFlap, 18, 3);
        // Head
        ctx.fillRect(dragonX + 12, dragonY - 2, 6, 4);
      }

      // Blocks
      const bsx = Math.max(0, Math.floor(s.camX / B)), bex = Math.min(WW, Math.ceil((s.camX + canvas.width) / B) + 1);
      const bsy = Math.max(0, Math.floor(s.camY / B)), bey = Math.min(WH, Math.ceil((s.camY + canvas.height) / B) + 1);
      for (let gy = bsy; gy < bey; gy++) for (let gx = bsx; gx < bex; gx++) {
        const type = s.world[gy][gx]; if (type === AIR) continue;
        const bx = Math.floor(gx * B - s.camX), by = Math.floor(gy * B - s.camY);
        ctx.drawImage(atlas, type * B, 0, B, B, bx, by, B, B);
        // Lava glow effect
        if (type === LAVA) {
          ctx.fillStyle = "rgba(255,100,0,0.2)";
          ctx.fillRect(bx - 2, by - 2, B + 4, B + 4);
        }
        // Netherite ore shimmer
        if (type === NETHERITE_ORE) {
          const shimmer = Math.sin(Date.now() * 0.005) * 0.15 + 0.15;
          ctx.fillStyle = `rgba(255,200,80,${shimmer})`;
          ctx.fillRect(bx, by, B, B);
        }
        // Dragon egg glow
        if (type === DRAGON_EGG) {
          const glow = Math.sin(Date.now() * 0.004) * 0.2 + 0.25;
          ctx.fillStyle = `rgba(160,60,255,${glow})`;
          ctx.fillRect(bx - 2, by - 2, B + 4, B + 4);
        }
        const above = gy > 0 && s.world[gy - 1][gx] !== AIR, left = gx > 0 && s.world[gy][gx - 1] !== AIR;
        const below = gy < WH - 1 && s.world[gy + 1][gx] !== AIR, right = gx < WW - 1 && s.world[gy][gx + 1] !== AIR;
        if (above) { ctx.fillStyle = "rgba(0,0,0,0.06)"; ctx.fillRect(bx, by, B, 2); }
        if (left) { ctx.fillStyle = "rgba(0,0,0,0.04)"; ctx.fillRect(bx, by, 2, B); }
        if (!above && type !== LEAVES && type !== CHERRY_LEAVES && type !== SPRUCE_LEAVES && type !== PALE_LEAVES && type !== PALE_MOSS) { ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(bx, by, B, 1); }
        if (!below) { ctx.fillStyle = "rgba(0,0,0,0.08)"; ctx.fillRect(bx, by + B - 1, B, 1); }
        if (!right) { ctx.fillStyle = "rgba(0,0,0,0.06)"; ctx.fillRect(bx + B - 1, by, 1, B); }
      }

      // Biome-specific decorations (overworld only)
      if (!isNether && !isEnd) for (let gx = bsx; gx < bex; gx++) {
        const biome = getBiome(gx, seed);
        for (let gy = bsy; gy < bey; gy++) {
          const blockType = s.world[gy][gx];
          const hasAirAbove = gy === 0 || s.world[gy - 1][gx] === AIR;
          if (!hasAirAbove) continue;

          const bx = Math.floor(gx * B - s.camX), by = Math.floor(gy * B - s.camY);
          const r = hash(gx, gy, seed + 200);

          if (blockType === GRASS && (biome === BIOME_PLAINS || biome === BIOME_CHERRY)) {
            if (biome === BIOME_PLAINS) {
              // Tall grass and flowers
              if (r < 0.3) {
                ctx.fillStyle = r < 0.1 ? "#6dba46" : "#5aaa35";
                ctx.fillRect(bx + 5, by - 6, 1, 6); ctx.fillRect(bx + 7, by - 8, 1, 8); ctx.fillRect(bx + 9, by - 5, 1, 5);
              } else if (r < 0.38) {
                ctx.fillStyle = "#5aaa35"; ctx.fillRect(bx + 7, by - 6, 1, 6);
                ctx.fillStyle = r < 0.34 ? "#e84040" : "#e8d040"; ctx.fillRect(bx + 6, by - 8, 3, 2);
              }
            } else {
              // Cherry biome: pink petals on ground + pink flowers
              if (r < 0.35) {
                ctx.fillStyle = "#5aaa35"; ctx.fillRect(bx + 6, by - 5, 1, 5);
                ctx.fillStyle = "#F2A0B5"; ctx.fillRect(bx + 5, by - 7, 3, 2);
              } else if (r < 0.5) {
                // Fallen petals
                ctx.fillStyle = "rgba(242,160,181,0.6)";
                ctx.fillRect(bx + 3, by - 1, 2, 1);
                ctx.fillRect(bx + 9, by - 2, 2, 1);
                ctx.fillRect(bx + 13, by - 1, 2, 1);
              }
            }
          } else if (blockType === SNOW && biome === BIOME_SNOWY) {
            // Snowflakes / snow particles above
            if (r < 0.15) {
              ctx.fillStyle = "rgba(255,255,255,0.6)";
              ctx.fillRect(bx + 4, by - 3, 1, 1);
              ctx.fillRect(bx + 10, by - 5, 1, 1);
            }
          } else if (blockType === GRASS && biome === BIOME_PALE_GARDEN) {
            // Pale garden: gray flowers, pale mushrooms
            if (r < 0.2) {
              ctx.fillStyle = "#8a9a7a"; ctx.fillRect(bx + 6, by - 5, 1, 5);
              ctx.fillStyle = "#c0c8b8"; ctx.fillRect(bx + 5, by - 7, 3, 2);
            } else if (r < 0.3) {
              // Pale mushroom
              ctx.fillStyle = "#b8b0a0"; ctx.fillRect(bx + 7, by - 4, 1, 4);
              ctx.fillStyle = "#d0c8bc"; ctx.fillRect(bx + 5, by - 6, 5, 2);
            }
          } else if (blockType === SAND && biome === BIOME_DESERT) {
            // Dead bushes
            if (r < 0.06) {
              ctx.fillStyle = "#8B7355";
              ctx.fillRect(bx + 7, by - 5, 1, 5);
              ctx.fillRect(bx + 5, by - 7, 1, 3);
              ctx.fillRect(bx + 9, by - 6, 1, 3);
            }
          }
        }
      }

      // Particles
      for (const p of s.particles) {
        ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color;
        const sz = 2 + p.life * 2; ctx.fillRect(p.x - s.camX - sz / 2, p.y - s.camY - sz / 2, sz, sz);
      }
      ctx.globalAlpha = 1;

      // Player
      const px = Math.floor(s.px - s.camX), py = Math.floor(s.py - s.camY);
      const f = s.facing, walking = s.onGround && Math.abs(s.vx) > 0.1;
      const legAnim = walking ? Math.sin(s.walkFrame * 0.3) * 4 : 0, armAnim = walking ? Math.sin(s.walkFrame * 0.3) * 3 : 0;
      ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.fillRect(px - 2, py + PH, PW + 4, 2);
      ctx.fillStyle = "#26327a"; ctx.fillRect(px, py + 18 + (legAnim > 0 ? 1 : 0), 5, 7); ctx.fillRect(px + 6, py + 18 + (legAnim < 0 ? 1 : 0), 5, 7);
      ctx.fillStyle = "#1e2966"; ctx.fillRect(px + 4, py + 18, 1, 7); ctx.fillRect(px + 6, py + 18, 1, 7);
      ctx.fillStyle = "#4a4a4a"; ctx.fillRect(px - 1 + (legAnim > 0 ? 1 : 0), py + 24, 6, 2); ctx.fillRect(px + 6 + (legAnim < 0 ? -1 : 0), py + 24, 6, 2);
      ctx.fillStyle = "#3bbaa8"; ctx.fillRect(px, py + 10, PW, 8);
      ctx.fillStyle = "#2f9e8e"; ctx.fillRect(px, py + 16, PW, 2);
      ctx.fillStyle = "#333"; ctx.fillRect(px, py + 17, PW, 1);
      ctx.fillStyle = "#c49555"; ctx.fillRect(px - 3, py + 10 + armAnim, 3, 9); ctx.fillRect(px + PW, py + 10 - armAnim, 3, 9);
      ctx.fillStyle = "#a87e45"; ctx.fillRect(px - 3, py + 17 + armAnim, 3, 2); ctx.fillRect(px + PW, py + 17 - armAnim, 3, 2);
      ctx.fillStyle = "#c49555"; ctx.fillRect(px - 1, py - 1, PW + 2, 11);
      ctx.fillStyle = "#4a2c0a"; ctx.fillRect(px - 1, py - 2, PW + 2, 4);
      if (f > 0) ctx.fillRect(px + PW - 1, py - 2, 2, 8); else ctx.fillRect(px - 1, py - 2, 2, 8);
      ctx.fillStyle = "#5c3810"; ctx.fillRect(px + 2, py - 2, PW - 3, 1);
      ctx.fillStyle = "#fff"; const eyeX = f > 0 ? px + 2 : px + 1;
      ctx.fillRect(eyeX, py + 4, 3, 3); ctx.fillRect(eyeX + 5, py + 4, 3, 3);
      ctx.fillStyle = "#2b1a0a"; ctx.fillRect(eyeX + (f > 0 ? 1 : 0), py + 5, 2, 2); ctx.fillRect(eyeX + 5 + (f > 0 ? 1 : 0), py + 5, 2, 2);
      ctx.fillStyle = "#b5814a"; ctx.fillRect(eyeX + 3, py + 6, 1, 2);
      ctx.fillStyle = "#8b5e3c"; ctx.fillRect(eyeX + 2, py + 8, 3, 1);

      // Block highlight
      const hov = getHovered();
      if (hov) {
        const hx = Math.floor(hov.bx * B - s.camX), hy = Math.floor(hov.by * B - s.camY);
        if (s.miningBlock && s.miningBlock.bx === hov.bx && s.miningBlock.by === hov.by) {
          const prog = s.miningBlock.t / getMineTime();
          ctx.fillStyle = `rgba(0,0,0,${prog * 0.5})`; ctx.fillRect(hx, hy, B, B);
          ctx.strokeStyle = `rgba(30,0,0,${0.3 + prog * 0.7})`; ctx.lineWidth = 1;
          for (let i = 0; i < Math.ceil(prog * 6); i++) {
            ctx.beginPath();
            ctx.moveTo(hx + B / 2 + (hash(hov.bx + i, hov.by, 1) - 0.5) * 6, hy + hash(hov.bx, hov.by + i, 2) * B);
            ctx.lineTo(hx + hash(hov.bx + i, hov.by, 3) * B, hy + hash(hov.bx, hov.by + i, 4) * B);
            ctx.stroke();
          }
        }
        ctx.strokeStyle = "rgba(0,0,0,0.5)"; ctx.lineWidth = 2; ctx.strokeRect(hx - 0.5, hy - 0.5, B + 1, B + 1);
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1; ctx.strokeRect(hx + 0.5, hy + 0.5, B - 1, B - 1);
      }

      // ── Chat messages (on canvas, MC-style) ──
      const now = Date.now();
      const msgs = chatRef.current.filter(m => now - m.time < 6000);
      const chatY = canvas.height - 58;
      for (let i = 0; i < msgs.length; i++) {
        const m = msgs[msgs.length - 1 - i];
        const age = (now - m.time) / 1000;
        const alpha = age > 4.5 ? Math.max(0, 1 - (age - 4.5) / 1.5) : 1;
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(4, chatY - i * 14 - 12, ctx.measureText(m.text).width + 8, 14);
        ctx.globalAlpha = alpha;
        ctx.font = "bold 10px monospace"; ctx.textAlign = "left";
        ctx.fillStyle = m.color;
        ctx.fillText(m.text, 8, chatY - i * 14 - 2);
      }
      ctx.globalAlpha = 1;

      // ── Hotbar ──
      const slotSize = 28, gap = 2;
      const hotW = 9 * slotSize + 8 * gap, hotX = Math.floor((canvas.width - hotW) / 2), hotY = canvas.height - 36;
      ctx.fillStyle = "rgba(30,30,30,0.85)"; ctx.fillRect(hotX - 4, hotY - 4, hotW + 8, slotSize + 8);
      ctx.strokeStyle = "rgba(80,80,80,0.6)"; ctx.strokeRect(hotX - 4, hotY - 4, hotW + 8, slotSize + 8);

      for (let i = 0; i < 9; i++) {
        const slx = hotX + i * (slotSize + gap);
        ctx.fillStyle = i === s.selected ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.3)";
        ctx.fillRect(slx, hotY, slotSize, slotSize);
        ctx.strokeStyle = i === s.selected ? "rgba(255,255,255,0.7)" : "rgba(90,90,90,0.5)";
        ctx.lineWidth = i === s.selected ? 2 : 1; ctx.strokeRect(slx, hotY, slotSize, slotSize); ctx.lineWidth = 1;

        const bt = s.hotbar[i];
        if (bt) {
          if (isBlock(bt)) {
            ctx.drawImage(atlas, bt * B, 0, B, B, slx + 6, hotY + 6, 16, 16);
          } else {
            drawToolIcon(ctx, bt, slx + 4, hotY + 3, 20);
          }
          const count = s.inventory.get(bt) || 0;
          if (count > 0) {
            ctx.font = "bold 10px monospace"; ctx.textAlign = "right";
            ctx.fillStyle = "#000"; ctx.fillText(String(count), slx + 26, hotY + 25);
            ctx.fillStyle = "#fff"; ctx.fillText(String(count), slx + 25, hotY + 24);
          }
        }
        ctx.fillStyle = "rgba(255,255,255,0.25)"; ctx.font = "8px monospace"; ctx.textAlign = "left";
        ctx.fillText(String(i + 1), slx + 2, hotY + 9);
      }

      // Selected name
      const selBlock = s.hotbar[s.selected];
      if (selBlock && ITEM_NAMES[selBlock]) {
        ctx.font = "bold 11px monospace"; ctx.textAlign = "center";
        ctx.fillStyle = "#000"; ctx.fillText(ITEM_NAMES[selBlock], canvas.width / 2 + 1, hotY - 7);
        ctx.fillStyle = "#fff"; ctx.fillText(ITEM_NAMES[selBlock], canvas.width / 2, hotY - 8);
      }

      // Biome / dimension indicator
      ctx.font = "bold 9px monospace"; ctx.textAlign = "right";
      if (isEnd) {
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillText("The End", canvas.width - 5, 13);
        ctx.fillStyle = "#c070ff"; ctx.fillText("The End", canvas.width - 6, 12);
      } else if (isNether) {
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillText("The Nether", canvas.width - 5, 13);
        ctx.fillStyle = "#ff4444"; ctx.fillText("The Nether", canvas.width - 6, 12);
      } else {
        const biomeNames = ["Plains", "Cherry Blossom", "Desert", "Snowy Tundra", "Pale Garden"];
        const biomeColors = ["#5da33a", "#F2A0B5", "#D9C479", "#A0D8EF", "#b8c4b4"];
        ctx.fillStyle = "rgba(0,0,0,0.3)"; ctx.fillText(biomeNames[currentBiome], canvas.width - 5, 13);
        ctx.fillStyle = biomeColors[currentBiome]; ctx.fillText(biomeNames[currentBiome], canvas.width - 6, 12);
      }

      // Controls hint
      ctx.font = "9px monospace"; ctx.textAlign = "left";
      ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.fillText("WASD: Move | Click: Mine | Right-click: Place | 1-9/Scroll: Select", 7, 13);
      ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.fillText("WASD: Move | Click: Mine | Right-click: Place | 1-9/Scroll: Select", 6, 12);

      // Victory overlay
      if (s.victory) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Purple + gold shimmer border
        const shimmer = Math.sin(Date.now() * 0.003) * 0.3 + 0.7;
        ctx.strokeStyle = `rgba(200,100,255,${shimmer})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(20, canvas.height / 2 - 55, canvas.width - 40, 110);
        ctx.strokeStyle = `rgba(255,200,50,${shimmer * 0.7})`;
        ctx.lineWidth = 2;
        ctx.strokeRect(24, canvas.height / 2 - 51, canvas.width - 48, 102);
        ctx.font = "bold 22px monospace"; ctx.textAlign = "center";
        ctx.fillStyle = "#c070ff";
        ctx.fillText("DRAGON EGG CLAIMED!", canvas.width / 2, canvas.height / 2 - 15);
        ctx.font = "bold 14px monospace";
        ctx.fillStyle = "#ffd700";
        ctx.fillText("You beat MineRunner!", canvas.width / 2, canvas.height / 2 + 10);
        ctx.font = "bold 12px monospace";
        ctx.fillStyle = "#5f5";
        ctx.fillText("Overworld -> Nether -> The End -> Victory!", canvas.width / 2, canvas.height / 2 + 30);
        ctx.font = "10px monospace";
        ctx.fillStyle = "#aaa";
        ctx.fillText("You can keep exploring or start a new world", canvas.width / 2, canvas.height / 2 + 48);
      }
    };

    let anim: number;
    const loop = () => { update(); render(); anim = requestAnimationFrame(loop); };
    const resize = () => { canvas.width = canvas.parentElement?.clientWidth || 600; canvas.height = CH; };
    resize(); window.addEventListener("resize", resize);
    anim = requestAnimationFrame(loop);

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const k = e.key.toLowerCase(); s.keys.add(k);
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      const num = parseInt(k); if (num >= 1 && num <= 9) s.selected = num - 1;
      // T to focus chat
      if (k === "t" || k === "enter") { setTimeout(() => inputRef.current?.focus(), 10); e.preventDefault(); }
    };
    const onKeyUp = (e: KeyboardEvent) => s.keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown); window.addEventListener("keyup", onKeyUp);

    const coords = (e: MouseEvent) => { const r = canvas.getBoundingClientRect(); s.mouseX = (e.clientX - r.left) * (canvas.width / r.width); s.mouseY = (e.clientY - r.top) * (canvas.height / r.height); };
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault(); coords(e);
      if (e.button === 0) s.mouseDown = true;
      else if (e.button === 2) {
        const hov = getHovered(); if (!hov) return;
        const bt = s.hotbar[s.selected];
        if (!isBlock(bt)) return; // can't place tools
        const count = s.inventory.get(bt) || 0;
        if (bt && count > 0 && s.world[hov.by][hov.bx] === AIR) {
          const pbx1 = Math.floor(s.px / B), pbx2 = Math.floor((s.px + PW - 1) / B);
          const pby1 = Math.floor(s.py / B), pby2 = Math.floor((s.py + PH - 1) / B);
          if (hov.bx >= pbx1 && hov.bx <= pbx2 && hov.by >= pby1 && hov.by <= pby2) return;
          s.world[hov.by][hov.bx] = bt; s.inventory.set(bt, count - 1);
          if (count - 1 <= 0) s.inventory.delete(bt);
        }
      }
    };
    const onMouseUp = () => { s.mouseDown = false; s.miningBlock = null; };
    const onMouseLeave = () => { s.mouseX = -1; s.mouseDown = false; s.miningBlock = null; };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); s.selected = e.deltaY > 0 ? (s.selected + 1) % 9 : (s.selected + 8) % 9; };

    canvas.addEventListener("mousemove", (e: MouseEvent) => coords(e));
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    return () => {
      cancelAnimationFrame(anim);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize);
    };
  }, [addChat]);

  const onChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputVal.trim()) {
      handleCommand(inputVal);
      setInputVal("");
      // Return focus to game
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setInputVal("");
      inputRef.current?.blur();
    }
    // Stop game controls while typing
    e.stopPropagation();
  };

  return (
    <div className="rounded-xl border border-emerald-500/20 overflow-hidden" style={{ boxShadow: "0 0 20px rgba(16,185,129,0.1)" }}>
      <canvas ref={canvasRef} height={CH} className="w-full cursor-crosshair" onContextMenu={(e) => e.preventDefault()} />
      <div className="flex items-center bg-black/80 px-2 py-1.5 gap-2">
        <span className="text-emerald-400 text-xs font-mono">&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={onChatKeyDown}
          placeholder="Type /help or /recipes... (T to focus)"
          className="flex-1 bg-transparent text-white text-xs font-mono outline-none placeholder:text-white/30"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
