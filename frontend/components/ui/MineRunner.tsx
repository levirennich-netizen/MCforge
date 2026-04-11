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

// Colors matching the app theme
const COLORS = {
  bg: "#0a0a14",
  ground: "#1a1a2e",
  groundLine: "#2a2a3e",
  stone: "#3a3a4e",
  player: "#10b981",       // emerald accent
  playerDark: "#059669",
  playerEye: "#ffffff",
  tnt: "#ef4444",
  tntDark: "#dc2626",
  tntLabel: "#ffffff",
  cactus: "#22c55e",
  cactusDark: "#16a34a",
  score: "#6ee7b7",
  text: "#6b7280",
  sky1: "#0d1117",
  sky2: "#0a1628",
  star: "#ffffff",
};

interface Obstacle {
  x: number;
  width: number;
  height: number;
  type: "tnt" | "cactus";
}

export function MineRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef({
    playerY: GROUND_Y - 24,
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
    groundOffset: 0,
  });
  const animRef = useRef<number>(0);
  const [highScore, setHighScore] = useState(0);

  const jump = useCallback(() => {
    const g = gameRef.current;
    if (g.gameOver) {
      // Reset
      g.playerY = GROUND_Y - 24;
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

    // Init stars
    const g = gameRef.current;
    if (g.stars.length === 0) {
      for (let i = 0; i < 40; i++) {
        g.stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * (GROUND_Y - 20),
          size: Math.random() * 1.5 + 0.5,
          twinkle: Math.random() * Math.PI * 2,
        });
      }
    }

    const PLAYER_W = 24;
    const PLAYER_H = 24;
    const PLAYER_X = 60;

    function drawBackground() {
      if (!ctx || !canvas) return;
      // Sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      grad.addColorStop(0, COLORS.sky1);
      grad.addColorStop(1, COLORS.sky2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, GROUND_Y);

      // Stars
      for (const star of g.stars) {
        star.twinkle += 0.02;
        const alpha = 0.3 + Math.sin(star.twinkle) * 0.3;
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
      }

      // Ground
      ctx.fillStyle = COLORS.ground;
      ctx.fillRect(0, GROUND_Y, canvas.width, CANVAS_HEIGHT - GROUND_Y);

      // Ground stone pattern
      ctx.fillStyle = COLORS.stone;
      const blockW = 32;
      const offset = g.groundOffset % blockW;
      for (let x = -offset; x < canvas.width + blockW; x += blockW) {
        ctx.fillRect(x, GROUND_Y, blockW - 1, 2);
        // Alternating brick pattern
        const row2Offset = (g.frameCount % 2 === 0) ? blockW / 2 : 0;
        ctx.fillRect(x + row2Offset - blockW / 2, GROUND_Y + 12, blockW - 1, 1);
      }
      ctx.fillStyle = COLORS.groundLine;
      ctx.fillRect(0, GROUND_Y, canvas.width, 1);
    }

    function drawPlayer() {
      if (!ctx) return;
      const x = PLAYER_X;
      const y = g.playerY;

      // Body (blocky creeper-like)
      ctx.fillStyle = COLORS.player;
      ctx.fillRect(x, y, PLAYER_W, PLAYER_H);

      // Darker edges
      ctx.fillStyle = COLORS.playerDark;
      ctx.fillRect(x, y, 2, PLAYER_H);
      ctx.fillRect(x + PLAYER_W - 2, y, 2, PLAYER_H);
      ctx.fillRect(x, y + PLAYER_H - 2, PLAYER_W, 2);

      // Face (creeper-style)
      ctx.fillStyle = COLORS.playerDark;
      // Eyes
      ctx.fillRect(x + 5, y + 6, 4, 4);
      ctx.fillRect(x + 15, y + 6, 4, 4);
      // Mouth
      ctx.fillRect(x + 9, y + 12, 6, 2);
      ctx.fillRect(x + 7, y + 14, 3, 4);
      ctx.fillRect(x + 14, y + 14, 3, 4);
    }

    function drawObstacle(obs: Obstacle) {
      if (!ctx) return;
      if (obs.type === "tnt") {
        // TNT block
        ctx.fillStyle = COLORS.tnt;
        ctx.fillRect(obs.x, GROUND_Y - obs.height, obs.width, obs.height);
        ctx.fillStyle = COLORS.tntDark;
        ctx.fillRect(obs.x, GROUND_Y - obs.height, obs.width, 3);
        ctx.fillRect(obs.x, GROUND_Y - 3, obs.width, 3);
        // TNT label
        ctx.fillStyle = COLORS.tntLabel;
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("TNT", obs.x + obs.width / 2, GROUND_Y - obs.height / 2 + 3);
      } else {
        // Cactus
        ctx.fillStyle = COLORS.cactus;
        ctx.fillRect(obs.x + 4, GROUND_Y - obs.height, obs.width - 8, obs.height);
        // Arms
        ctx.fillRect(obs.x, GROUND_Y - obs.height + 10, 4, 12);
        ctx.fillRect(obs.x + obs.width - 4, GROUND_Y - obs.height + 18, 4, 10);
        // Dark accents
        ctx.fillStyle = COLORS.cactusDark;
        ctx.fillRect(obs.x + 8, GROUND_Y - obs.height, 2, obs.height);
      }
    }

    function drawScore() {
      if (!ctx || !canvas) return;
      ctx.fillStyle = COLORS.score;
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.floor(g.score).toString().padStart(5, "0")}`, canvas.width - 12, 20);
      if (highScore > 0) {
        ctx.fillStyle = COLORS.text;
        ctx.font = "11px monospace";
        ctx.fillText(`HI ${highScore.toString().padStart(5, "0")}`, canvas.width - 12, 36);
      }
    }

    function drawUI() {
      if (!ctx || !canvas) return;
      if (!g.started) {
        ctx.fillStyle = COLORS.score;
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.fillText("PRESS SPACE OR TAP TO START", canvas.width / 2, GROUND_Y / 2 - 5);
        ctx.fillStyle = COLORS.text;
        ctx.font = "11px monospace";
        ctx.fillText("jump over obstacles while the server loads", canvas.width / 2, GROUND_Y / 2 + 15);
      }
      if (g.gameOver) {
        ctx.fillStyle = COLORS.tnt;
        ctx.font = "bold 16px monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, GROUND_Y / 2 - 5);
        ctx.fillStyle = COLORS.text;
        ctx.font = "11px monospace";
        ctx.fillText("tap or press space to retry", canvas.width / 2, GROUND_Y / 2 + 15);
      }
    }

    function update() {
      if (!g.started || g.gameOver) return;

      // Player physics
      g.velocityY += GRAVITY;
      g.playerY += g.velocityY;
      if (g.playerY >= GROUND_Y - PLAYER_H) {
        g.playerY = GROUND_Y - PLAYER_H;
        g.velocityY = 0;
        g.isJumping = false;
      }

      // Ground scroll
      g.groundOffset += g.gameSpeed;

      // Spawn obstacles
      g.nextObstacleIn--;
      if (g.nextObstacleIn <= 0) {
        const type = Math.random() > 0.5 ? "tnt" : "cactus";
        const h = type === "tnt" ? 24 : 30 + Math.random() * 15;
        const w = type === "tnt" ? 24 : 18;
        g.obstacles.push({
          x: canvas!.width + 10,
          width: w,
          height: h,
          type,
        });
        g.nextObstacleIn = OBSTACLE_GAP_MIN + Math.random() * OBSTACLE_GAP_MAX;
      }

      // Move obstacles
      for (const obs of g.obstacles) {
        obs.x -= g.gameSpeed;
      }
      g.obstacles = g.obstacles.filter((o) => o.x + o.width > -20);

      // Collision detection
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

      // Score & speed
      g.score += 0.15;
      g.gameSpeed += GAME_SPEED_INC;
      g.frameCount++;
    }

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

    // Handle resize
    const resizeCanvas = () => {
      if (!canvas) return;
      canvas.width = canvas.parentElement?.clientWidth || 600;
      canvas.height = CANVAS_HEIGHT;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Start loop
    animRef.current = requestAnimationFrame(gameLoop);

    // Keyboard
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
