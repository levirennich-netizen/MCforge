"use client";

import { useEffect, useRef, useCallback, useState } from "react";

const CANVAS_HEIGHT = 200;
const GROUND_Y = 160;
const GRAVITY = 0.6;
const JUMP_FORCE = -11;
const GAME_SPEED_INIT = 4;
const GAME_SPEED_INC = 0.001;
const OBSTACLE_GAP_MIN = 80;
const OBSTACLE_GAP_MAX = 200;

// Pixel size for drawing sprites
const PX = 2;

interface Obstacle {
  x: number;
  width: number;
  height: number;
  type: "tnt" | "cactus" | "creeper";
}

// ── Minecraft pixel sprites (each row is a string, chars map to colors) ──

// Steve head+body (12x16 px → 24x32 on canvas at PX=2)
const STEVE_SPRITE = [
  // Hair (row 0-1)
  "..4444444...",
  "..4444444...",
  // Head (row 2-7)
  ".44S4SS44S.",
  ".4SSSSSSS4.",
  ".4SWSSSWSS.",
  ".4SSSNSSSS.",
  ".4SSMMMSS4.",
  "..4SSSSS4..",
  // Neck/body (row 8)
  "...00000...",
  // Shirt (row 9-12)
  "..00088000.",
  ".0000880000",
  ".0000880000",
  "..00000000.",
  // Arms+body
  "..0SSSS0...",
  // Legs (row 14-15)
  "...11.11...",
  "...11.11...",
];

const STEVE_COLORS: Record<string, string> = {
  "4": "#3b2213",  // hair brown
  "S": "#c8a07e",  // skin
  "W": "#ffffff",  // eye white
  "N": "#5c4033",  // nose
  "M": "#8b6053",  // mouth
  "0": "#3ab3da",  // shirt cyan
  "8": "#2d8bba",  // shirt dark
  "1": "#2b2b8b",  // pants indigo
};

// Grass block top colors
const GRASS_TOP = "#5d9b3a";
const GRASS_TOP_LIGHT = "#6db344";
const DIRT = "#8b6941";
const DIRT_DARK = "#7a5a35";
const DIRT_SPEC = "#9e7a52";

export function MineRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef({
    playerY: GROUND_Y - 32,
    velocityY: 0,
    isJumping: false,
    obstacles: [] as Obstacle[],
    score: 0,
    gameSpeed: GAME_SPEED_INIT,
    frameCount: 0,
    nextObstacleIn: 120,
    gameOver: false,
    started: false,
    stars: [] as { x: number; y: number; size: number; twinkle: number }[],
    clouds: [] as { x: number; y: number; w: number }[],
    groundOffset: 0,
    walkFrame: 0,
  });
  const animRef = useRef<number>(0);
  const [highScore, setHighScore] = useState(0);

  const jump = useCallback(() => {
    const g = gameRef.current;
    if (g.gameOver) {
      g.playerY = GROUND_Y - 32;
      g.velocityY = 0;
      g.isJumping = false;
      g.obstacles = [];
      g.score = 0;
      g.gameSpeed = GAME_SPEED_INIT;
      g.frameCount = 0;
      g.nextObstacleIn = 120;
      g.gameOver = false;
      g.started = true;
      return;
    }
    if (!g.started) {
      g.started = true;
    }
    if (!g.isJumping) {
      g.velocityY = JUMP_FORCE;
      g.isJumping = true;
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const g = gameRef.current;

    // Init stars
    if (g.stars.length === 0) {
      for (let i = 0; i < 50; i++) {
        g.stars.push({
          x: Math.random() * 800,
          y: Math.random() * (GROUND_Y - 30),
          size: Math.random() > 0.7 ? 2 : 1,
          twinkle: Math.random() * Math.PI * 2,
        });
      }
    }

    // Init clouds
    if (g.clouds.length === 0) {
      for (let i = 0; i < 4; i++) {
        g.clouds.push({
          x: Math.random() * 800,
          y: 20 + Math.random() * 50,
          w: 40 + Math.random() * 60,
        });
      }
    }

    const PLAYER_W = 24;
    const PLAYER_H = 32;
    const PLAYER_X = 60;

    // ── Draw a pixel sprite ──
    function drawSprite(
      sprite: string[],
      colors: Record<string, string>,
      sx: number,
      sy: number,
      px: number = PX,
    ) {
      if (!ctx) return;
      for (let row = 0; row < sprite.length; row++) {
        for (let col = 0; col < sprite[row].length; col++) {
          const ch = sprite[row][col];
          if (ch === "." || ch === " ") continue;
          const color = colors[ch];
          if (!color) continue;
          ctx.fillStyle = color;
          ctx.fillRect(sx + col * px, sy + row * px, px, px);
        }
      }
    }

    // ── Minecraft-style cloud (white blocky) ──
    function drawCloud(cx: number, cy: number, w: number) {
      if (!ctx) return;
      const bk = 8;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      // Bottom row (wider)
      const cols = Math.floor(w / bk);
      for (let i = 0; i < cols; i++) {
        ctx.fillRect(cx + i * bk, cy, bk - 1, bk - 1);
      }
      // Top row (narrower, centered)
      const topCols = Math.max(1, cols - 2);
      const topOff = Math.floor((cols - topCols) / 2) * bk;
      for (let i = 0; i < topCols; i++) {
        ctx.fillRect(cx + topOff + i * bk, cy - bk, bk - 1, bk - 1);
      }
    }

    // ── Moon ──
    function drawMoon() {
      if (!ctx || !canvas) return;
      const mx = canvas.width - 80;
      const my = 30;
      // Blocky moon (8x8 pixel blocks)
      ctx.fillStyle = "#e8e0c8";
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          const dist = Math.sqrt((r - 1.5) ** 2 + (c - 1.5) ** 2);
          if (dist < 2.2) {
            ctx.fillRect(mx + c * 6, my + r * 6, 5, 5);
          }
        }
      }
      // Craters
      ctx.fillStyle = "#c8c0a8";
      ctx.fillRect(mx + 6, my + 6, 5, 5);
      ctx.fillRect(mx + 12, my + 12, 5, 5);
    }

    // ── Background ──
    function drawBackground() {
      if (!ctx || !canvas) return;
      // Sky gradient (dark navy)
      const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      grad.addColorStop(0, "#0c0c1e");
      grad.addColorStop(1, "#0f1a2e");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, GROUND_Y);

      // Stars
      for (const star of g.stars) {
        star.twinkle += 0.015;
        const alpha = 0.2 + Math.sin(star.twinkle) * 0.3;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(Math.floor(star.x), Math.floor(star.y), star.size, star.size);
      }

      // Moon
      drawMoon();

      // Clouds (scroll slowly)
      for (const cloud of g.clouds) {
        drawCloud(cloud.x, cloud.y, cloud.w);
        if (g.started && !g.gameOver) {
          cloud.x -= g.gameSpeed * 0.15;
          if (cloud.x + cloud.w < -10) {
            cloud.x = canvas.width + 20;
            cloud.y = 20 + Math.random() * 50;
          }
        }
      }

      // ── Ground: Grass block layer + dirt ──
      const blockW = 16;
      const offset = Math.floor(g.groundOffset) % blockW;

      // Grass top (2px bright green line)
      ctx.fillStyle = GRASS_TOP;
      ctx.fillRect(0, GROUND_Y, canvas.width, 4);
      // Grass highlight pixels
      ctx.fillStyle = GRASS_TOP_LIGHT;
      for (let x = -offset; x < canvas.width + blockW; x += blockW) {
        ctx.fillRect(x + 2, GROUND_Y, 4, 2);
        ctx.fillRect(x + 10, GROUND_Y, 3, 2);
        // Grass overhang
        ctx.fillStyle = GRASS_TOP;
        if (Math.floor(x / blockW) % 3 === 0) {
          ctx.fillRect(x + 4, GROUND_Y - 2, 2, 2);
        }
        ctx.fillStyle = GRASS_TOP_LIGHT;
      }

      // Dirt body
      ctx.fillStyle = DIRT;
      ctx.fillRect(0, GROUND_Y + 4, canvas.width, CANVAS_HEIGHT - GROUND_Y - 4);

      // Dirt texture pattern
      for (let x = -offset; x < canvas.width + blockW; x += blockW) {
        // Grid lines (darker)
        ctx.fillStyle = DIRT_DARK;
        ctx.fillRect(x, GROUND_Y + 4, 1, CANVAS_HEIGHT - GROUND_Y - 4);
        // Specks
        ctx.fillStyle = DIRT_SPEC;
        ctx.fillRect(x + 4, GROUND_Y + 8, 2, 2);
        ctx.fillRect(x + 10, GROUND_Y + 14, 2, 2);
        ctx.fillRect(x + 7, GROUND_Y + 22, 2, 1);
        // Darker specks
        ctx.fillStyle = DIRT_DARK;
        ctx.fillRect(x + 2, GROUND_Y + 18, 2, 2);
        ctx.fillRect(x + 12, GROUND_Y + 10, 1, 2);
      }
    }

    // ── Player (Steve) ──
    function drawPlayer() {
      if (!ctx) return;
      const x = PLAYER_X;
      const y = g.playerY;

      drawSprite(STEVE_SPRITE, STEVE_COLORS, x, y, PX);

      // Walking animation: slight leg swap
      if (g.started && !g.gameOver && !g.isJumping) {
        g.walkFrame++;
        if (Math.floor(g.walkFrame / 6) % 2 === 0) {
          // Swap leg colors slightly
          ctx.fillStyle = "#3a3a9b";
          ctx.fillRect(x + 6, y + 28, 4, 4);
        }
      }
    }

    // ── Obstacles ──
    function drawObstacle(obs: Obstacle) {
      if (!ctx) return;

      if (obs.type === "tnt") {
        // TNT: draw the sprite scaled to fit the obstacle
        const bx = Math.floor(obs.x);
        const by = GROUND_Y - obs.height;
        // Red base
        ctx.fillStyle = "#cc2200";
        ctx.fillRect(bx, by, obs.width, obs.height);
        // Dark border
        ctx.fillStyle = "#8b0000";
        ctx.fillRect(bx, by, obs.width, 2);
        ctx.fillRect(bx, by + obs.height - 2, obs.width, 2);
        ctx.fillRect(bx, by, 2, obs.height);
        ctx.fillRect(bx + obs.width - 2, by, 2, obs.height);
        // White band
        const bandY = by + Math.floor(obs.height * 0.3);
        const bandH = Math.floor(obs.height * 0.4);
        ctx.fillStyle = "#e8e8e8";
        ctx.fillRect(bx + 3, bandY, obs.width - 6, bandH);
        // TNT text
        ctx.fillStyle = "#222222";
        ctx.font = `bold ${Math.max(8, Math.floor(obs.width * 0.35))}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText("TNT", bx + obs.width / 2, bandY + bandH - 2);

      } else if (obs.type === "creeper") {
        // Creeper enemy
        const bx = Math.floor(obs.x);
        const by = GROUND_Y - obs.height;
        // Green body
        ctx.fillStyle = "#46a832";
        ctx.fillRect(bx, by, obs.width, obs.height);
        // Darker border
        ctx.fillStyle = "#2d7a1e";
        ctx.fillRect(bx, by, obs.width, 2);
        ctx.fillRect(bx, by, 2, obs.height);
        ctx.fillRect(bx + obs.width - 2, by, 2, obs.height);

        // Face
        const faceOff = Math.floor(obs.width * 0.15);
        const eyeSize = Math.max(2, Math.floor(obs.width * 0.2));
        ctx.fillStyle = "#1a1a1a";
        // Eyes
        ctx.fillRect(bx + faceOff, by + 4, eyeSize, eyeSize);
        ctx.fillRect(bx + obs.width - faceOff - eyeSize, by + 4, eyeSize, eyeSize);
        // Mouth
        const mouthW = Math.max(2, Math.floor(obs.width * 0.25));
        const mouthX = bx + Math.floor((obs.width - mouthW) / 2);
        ctx.fillRect(mouthX, by + 4 + eyeSize + 1, mouthW, 3);
        ctx.fillRect(mouthX - Math.floor(mouthW * 0.3), by + 4 + eyeSize + 4, Math.floor(mouthW * 0.5), 4);
        ctx.fillRect(mouthX + Math.floor(mouthW * 0.8), by + 4 + eyeSize + 4, Math.floor(mouthW * 0.5), 4);

        // Feet
        ctx.fillStyle = "#3a9428";
        ctx.fillRect(bx + 2, by + obs.height - 6, obs.width / 2 - 3, 6);
        ctx.fillRect(bx + obs.width / 2 + 1, by + obs.height - 6, obs.width / 2 - 3, 6);

      } else {
        // Cactus
        const bx = Math.floor(obs.x);
        const by = GROUND_Y - obs.height;
        const stemW = Math.max(6, obs.width - 8);
        const stemX = bx + Math.floor((obs.width - stemW) / 2);

        // Main stem
        ctx.fillStyle = "#1a7a2e";
        ctx.fillRect(stemX, by, stemW, obs.height);
        // Lighter stripe
        ctx.fillStyle = "#22a038";
        ctx.fillRect(stemX + 2, by, 2, obs.height);
        // Dark stripe
        ctx.fillStyle = "#0f5e1f";
        ctx.fillRect(stemX + stemW - 2, by, 2, obs.height);

        // Arms
        const armW = 4;
        const armH = 10;
        // Left arm
        ctx.fillStyle = "#1a7a2e";
        ctx.fillRect(bx, by + 8, armW, armH);
        ctx.fillStyle = "#22a038";
        ctx.fillRect(bx, by + 8, 2, armH);
        ctx.fillRect(bx, by + 8, armW, 2);
        // Right arm
        ctx.fillStyle = "#1a7a2e";
        ctx.fillRect(bx + obs.width - armW, by + 18, armW, armH);
        ctx.fillStyle = "#22a038";
        ctx.fillRect(bx + obs.width - armW, by + 18, 2, armH);
        ctx.fillRect(bx + obs.width - armW, by + 18, armW, 2);

        // Spines (dark dots)
        ctx.fillStyle = "#0f5e1f";
        for (let sy = by + 4; sy < by + obs.height - 4; sy += 6) {
          ctx.fillRect(stemX - 1, sy, 1, 1);
          ctx.fillRect(stemX + stemW, sy + 3, 1, 1);
        }
        // Top
        ctx.fillStyle = "#22a038";
        ctx.fillRect(stemX + 1, by, stemW - 2, 2);
      }
    }

    // ── Score ──
    function drawScore() {
      if (!ctx || !canvas) return;
      ctx.fillStyle = "#6ee7b7";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.floor(g.score).toString().padStart(5, "0")}`, canvas.width - 12, 20);
      if (highScore > 0) {
        ctx.fillStyle = "#6b7280";
        ctx.font = "11px monospace";
        ctx.fillText(`HI ${highScore.toString().padStart(5, "0")}`, canvas.width - 12, 36);
      }
    }

    // ── UI text ──
    function drawUI() {
      if (!ctx || !canvas) return;
      if (!g.started) {
        ctx.fillStyle = "#6ee7b7";
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("PRESS SPACE OR TAP TO START", canvas.width / 2, GROUND_Y / 2 - 5);
        ctx.fillStyle = "#6b7280";
        ctx.font = "11px monospace";
        ctx.fillText("jump over obstacles while the server loads", canvas.width / 2, GROUND_Y / 2 + 15);
      }
      if (g.gameOver) {
        // Dark overlay
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, canvas.width, GROUND_Y);

        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, GROUND_Y / 2 - 5);
        ctx.fillStyle = "#6b7280";
        ctx.font = "11px monospace";
        ctx.fillText("tap or press space to retry", canvas.width / 2, GROUND_Y / 2 + 15);
      }
    }

    // ── Update ──
    function update() {
      if (!g.started || g.gameOver) return;

      g.velocityY += GRAVITY;
      g.playerY += g.velocityY;
      if (g.playerY >= GROUND_Y - PLAYER_H) {
        g.playerY = GROUND_Y - PLAYER_H;
        g.velocityY = 0;
        g.isJumping = false;
      }

      g.groundOffset += g.gameSpeed;

      // Spawn obstacles
      g.nextObstacleIn--;
      if (g.nextObstacleIn <= 0) {
        const roll = Math.random();
        const type = roll < 0.35 ? "tnt" : roll < 0.65 ? "cactus" : "creeper";
        let h: number, w: number;
        if (type === "tnt") {
          w = 28; h = 28;
        } else if (type === "creeper") {
          w = 20; h = 32;
        } else {
          w = 18; h = 30 + Math.random() * 15;
        }
        g.obstacles.push({ x: canvas!.width + 10, width: w, height: h, type });
        g.nextObstacleIn = OBSTACLE_GAP_MIN + Math.random() * OBSTACLE_GAP_MAX;
      }

      for (const obs of g.obstacles) {
        obs.x -= g.gameSpeed;
      }
      g.obstacles = g.obstacles.filter((o) => o.x + o.width > -20);

      // Collision
      for (const obs of g.obstacles) {
        const px = PLAYER_X;
        const py = g.playerY;
        const ox = obs.x;
        const oy = GROUND_Y - obs.height;
        if (
          px + PLAYER_W - 4 > ox + 2 &&
          px + 4 < ox + obs.width - 2 &&
          py + PLAYER_H - 2 > oy + 2
        ) {
          g.gameOver = true;
          setHighScore((prev) => Math.max(prev, Math.floor(g.score)));
          return;
        }
      }

      g.score += 0.15;
      g.gameSpeed += GAME_SPEED_INC;
      g.frameCount++;
    }

    // ── Game loop ──
    function gameLoop() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground();
      for (const obs of g.obstacles) drawObstacle(obs);
      drawPlayer();
      drawScore();
      drawUI();
      update();
      animRef.current = requestAnimationFrame(gameLoop);
    }

    const resizeCanvas = () => {
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || 600;
      canvas.height = CANVAS_HEIGHT;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    animRef.current = requestAnimationFrame(gameLoop);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [jump, highScore]);

  return (
    <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-[#0a0a14]">
      <canvas
        ref={canvasRef}
        height={CANVAS_HEIGHT}
        onClick={jump}
        className="w-full cursor-pointer"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}
