"use client";

import { useEffect, useRef, useCallback, useState } from "react";

const CANVAS_HEIGHT = 200;
const GROUND_Y = 165;
const GRAVITY = 0.7;
const JUMP_FORCE = -11.5;
const GAME_SPEED_INIT = 5;
const GAME_SPEED_INC = 0.002;
const OBSTACLE_GAP_MIN = 60;
const OBSTACLE_GAP_MAX = 160;

const PLAYER_SIZE = 26;
const PLAYER_X = 80;

interface Obstacle {
  x: number;
  width: number;
  height: number;
  type: "spike" | "pillar" | "double_spike";
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export function MineRunner() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef({
    playerY: GROUND_Y - PLAYER_SIZE,
    velocityY: 0,
    isJumping: false,
    rotation: 0,
    targetRotation: 0,
    obstacles: [] as Obstacle[],
    particles: [] as Particle[],
    score: 0,
    gameSpeed: GAME_SPEED_INIT,
    frameCount: 0,
    nextObstacleIn: 80,
    gameOver: false,
    started: false,
    groundOffset: 0,
    bgShapes: [] as { x: number; y: number; size: number; speed: number; rot: number }[],
    pulse: 0,
  });
  const animRef = useRef<number>(0);
  const [highScore, setHighScore] = useState(0);

  const jump = useCallback(() => {
    const g = gameRef.current;
    if (g.gameOver) {
      g.playerY = GROUND_Y - PLAYER_SIZE;
      g.velocityY = 0;
      g.isJumping = false;
      g.rotation = 0;
      g.targetRotation = 0;
      g.obstacles = [];
      g.particles = [];
      g.score = 0;
      g.gameSpeed = GAME_SPEED_INIT;
      g.frameCount = 0;
      g.nextObstacleIn = 80;
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
      g.targetRotation += Math.PI / 2; // 90° rotation per jump like GD
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const g = gameRef.current;

    // Init background geometric shapes
    if (g.bgShapes.length === 0) {
      for (let i = 0; i < 12; i++) {
        g.bgShapes.push({
          x: Math.random() * 900,
          y: 20 + Math.random() * (GROUND_Y - 60),
          size: 10 + Math.random() * 30,
          speed: 0.3 + Math.random() * 0.8,
          rot: Math.random() * Math.PI * 2,
        });
      }
    }

    // ── Colors ──
    const NEON = "#10b981";
    const NEON_BRIGHT = "#34d399";
    const NEON_DIM = "#065f46";
    const SPIKE_COLOR = "#ef4444";
    const SPIKE_BRIGHT = "#f87171";
    const PILLAR_COLOR = "#3b82f6";
    const PILLAR_BRIGHT = "#60a5fa";

    // ── Background ──
    function drawBackground() {
      if (!ctx || !canvas) return;
      // Dark gradient
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      grad.addColorStop(0, "#050510");
      grad.addColorStop(0.6, "#0a0a20");
      grad.addColorStop(1, "#0d0d1a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, CANVAS_HEIGHT);

      // Scrolling background shapes (diamonds/squares)
      g.pulse += 0.02;
      const pulseAlpha = 0.03 + Math.sin(g.pulse) * 0.015;

      for (const shape of g.bgShapes) {
        if (g.started && !g.gameOver) {
          shape.x -= g.gameSpeed * shape.speed;
          shape.rot += 0.005;
          if (shape.x + shape.size < -10) {
            shape.x = canvas.width + 20 + Math.random() * 100;
            shape.y = 20 + Math.random() * (GROUND_Y - 60);
          }
        }
        ctx.save();
        ctx.translate(shape.x + shape.size / 2, shape.y + shape.size / 2);
        ctx.rotate(shape.rot);
        ctx.strokeStyle = `rgba(16, 185, 129, ${pulseAlpha})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(-shape.size / 2, -shape.size / 2, shape.size, shape.size);
        ctx.restore();
      }

      // ── Ground ──
      const blockW = 30;
      const offset = Math.floor(g.groundOffset) % blockW;

      // Ground glow line
      ctx.shadowColor = NEON;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = NEON;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(canvas.width, GROUND_Y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Ground fill
      ctx.fillStyle = "#0a0f1a";
      ctx.fillRect(0, GROUND_Y, canvas.width, CANVAS_HEIGHT - GROUND_Y);

      // Ground grid lines
      ctx.strokeStyle = "rgba(16, 185, 129, 0.08)";
      ctx.lineWidth = 1;
      // Vertical
      for (let x = -offset; x < canvas.width + blockW; x += blockW) {
        ctx.beginPath();
        ctx.moveTo(x, GROUND_Y);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      // Horizontal
      for (let y = GROUND_Y + blockW; y < CANVAS_HEIGHT; y += blockW) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }

    // ── Particles ──
    function spawnTrailParticle() {
      if (!g.started || g.gameOver) return;
      g.particles.push({
        x: PLAYER_X + PLAYER_SIZE / 2,
        y: g.playerY + PLAYER_SIZE,
        vx: -1 - Math.random() * 2,
        vy: -0.5 + Math.random(),
        life: 1.0,
        color: NEON,
      });
    }

    function spawnDeathParticles() {
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        g.particles.push({
          x: PLAYER_X + PLAYER_SIZE / 2,
          y: g.playerY + PLAYER_SIZE / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          color: i % 2 === 0 ? NEON_BRIGHT : "#ffffff",
        });
      }
    }

    function updateParticles() {
      for (const p of g.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
      }
      g.particles = g.particles.filter((p) => p.life > 0);
    }

    function drawParticles() {
      if (!ctx) return;
      for (const p of g.particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        const size = 3 * p.life;
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      }
      ctx.globalAlpha = 1;
    }

    // ── Player (GD-style cube with creeper face) ──
    function drawPlayer() {
      if (!ctx) return;
      const cx = PLAYER_X + PLAYER_SIZE / 2;
      const cy = g.playerY + PLAYER_SIZE / 2;

      // Smooth rotation towards target
      const rotDiff = g.targetRotation - g.rotation;
      g.rotation += rotDiff * 0.15;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(g.rotation);

      const half = PLAYER_SIZE / 2;

      // Outer glow
      ctx.shadowColor = NEON;
      ctx.shadowBlur = g.gameOver ? 0 : 14;

      // Cube body
      ctx.fillStyle = NEON;
      ctx.fillRect(-half, -half, PLAYER_SIZE, PLAYER_SIZE);

      // Inner darker square
      ctx.fillStyle = NEON_DIM;
      ctx.fillRect(-half + 3, -half + 3, PLAYER_SIZE - 6, PLAYER_SIZE - 6);

      // Bright inner
      ctx.fillStyle = NEON;
      ctx.fillRect(-half + 5, -half + 5, PLAYER_SIZE - 10, PLAYER_SIZE - 10);

      ctx.shadowBlur = 0;

      // Creeper face on the cube (big and bold)
      ctx.fillStyle = "#000000";
      const s = PLAYER_SIZE;
      // Eyes (2 big squares)
      ctx.fillRect(-half + s * 0.12, -half + s * 0.15, s * 0.28, s * 0.25);
      ctx.fillRect(-half + s * 0.60, -half + s * 0.15, s * 0.28, s * 0.25);
      // Mouth center column
      ctx.fillRect(-half + s * 0.35, -half + s * 0.42, s * 0.30, s * 0.15);
      // Mouth wide bar
      ctx.fillRect(-half + s * 0.20, -half + s * 0.55, s * 0.60, s * 0.15);
      // Mouth bottom legs
      ctx.fillRect(-half + s * 0.20, -half + s * 0.68, s * 0.20, s * 0.18);
      ctx.fillRect(-half + s * 0.60, -half + s * 0.68, s * 0.20, s * 0.18);

      ctx.restore();
    }

    // ── Obstacles ──
    function drawObstacle(obs: Obstacle) {
      if (!ctx) return;
      const bx = Math.floor(obs.x);
      const by = GROUND_Y - obs.height;

      if (obs.type === "spike" || obs.type === "double_spike") {
        // GD-style spike triangles
        ctx.shadowColor = SPIKE_COLOR;
        ctx.shadowBlur = 8;

        const drawSpike = (sx: number) => {
          if (!ctx) return;
          ctx.fillStyle = SPIKE_COLOR;
          ctx.beginPath();
          ctx.moveTo(sx, GROUND_Y);
          ctx.lineTo(sx + obs.width / 2, by);
          ctx.lineTo(sx + obs.width, GROUND_Y);
          ctx.closePath();
          ctx.fill();

          // Inner triangle (brighter)
          ctx.fillStyle = SPIKE_BRIGHT;
          const inset = 4;
          ctx.beginPath();
          ctx.moveTo(sx + inset, GROUND_Y - 2);
          ctx.lineTo(sx + obs.width / 2, by + obs.height * 0.3);
          ctx.lineTo(sx + obs.width - inset, GROUND_Y - 2);
          ctx.closePath();
          ctx.fill();
        };

        drawSpike(bx);
        if (obs.type === "double_spike") {
          drawSpike(bx + obs.width - 4);
        }

        ctx.shadowBlur = 0;

      } else {
        // Pillar block
        ctx.shadowColor = PILLAR_COLOR;
        ctx.shadowBlur = 8;

        ctx.fillStyle = PILLAR_COLOR;
        ctx.fillRect(bx, by, obs.width, obs.height);

        // Inner
        ctx.fillStyle = PILLAR_BRIGHT;
        ctx.fillRect(bx + 3, by + 3, obs.width - 6, obs.height - 6);

        ctx.fillStyle = PILLAR_COLOR;
        ctx.fillRect(bx + 6, by + 6, obs.width - 12, obs.height - 12);

        ctx.shadowBlur = 0;
      }
    }

    // ── Score ──
    function drawScore() {
      if (!ctx || !canvas) return;
      ctx.fillStyle = NEON_BRIGHT;
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${Math.floor(g.score).toString().padStart(5, "0")}`, canvas.width - 12, 24);
      if (highScore > 0) {
        ctx.fillStyle = "#4b5563";
        ctx.font = "11px monospace";
        ctx.fillText(`HI ${highScore.toString().padStart(5, "0")}`, canvas.width - 12, 40);
      }

      // Progress bar at top
      const progress = Math.min(g.score / 100, 1);
      ctx.fillStyle = "rgba(16, 185, 129, 0.1)";
      ctx.fillRect(12, 14, canvas.width - 100, 4);
      ctx.fillStyle = NEON;
      ctx.fillRect(12, 14, (canvas.width - 100) * progress, 4);
      // Percentage
      ctx.fillStyle = "#6b7280";
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(`${Math.floor(progress * 100)}%`, 12, 30);
    }

    // ── UI text ──
    function drawUI() {
      if (!ctx || !canvas) return;
      if (!g.started) {
        // Pulsing text
        const alpha = 0.6 + Math.sin(Date.now() / 400) * 0.4;
        ctx.fillStyle = `rgba(52, 211, 153, ${alpha})`;
        ctx.font = "bold 15px monospace";
        ctx.textAlign = "center";
        ctx.fillText("PRESS SPACE OR TAP", canvas.width / 2, GROUND_Y / 2 - 5);
        ctx.fillStyle = "#4b5563";
        ctx.font = "11px monospace";
        ctx.fillText("play while the server wakes up", canvas.width / 2, GROUND_Y / 2 + 15);
      }
      if (g.gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, canvas.width, CANVAS_HEIGHT);

        ctx.fillStyle = SPIKE_COLOR;
        ctx.font = "bold 18px monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width / 2, GROUND_Y / 2 - 8);
        ctx.fillStyle = "#6b7280";
        ctx.font = "12px monospace";
        ctx.fillText("tap or press space to retry", canvas.width / 2, GROUND_Y / 2 + 16);
      }
    }

    // ── Update ──
    function update() {
      if (!g.started || g.gameOver) return;

      g.velocityY += GRAVITY;
      g.playerY += g.velocityY;
      if (g.playerY >= GROUND_Y - PLAYER_SIZE) {
        g.playerY = GROUND_Y - PLAYER_SIZE;
        g.velocityY = 0;
        g.isJumping = false;
        // Snap rotation
        g.rotation = g.targetRotation;
      }

      g.groundOffset += g.gameSpeed;

      // Trail particles every 3 frames
      if (g.frameCount % 3 === 0) {
        spawnTrailParticle();
      }

      // Spawn obstacles
      g.nextObstacleIn--;
      if (g.nextObstacleIn <= 0) {
        const roll = Math.random();
        let type: Obstacle["type"];
        let h: number, w: number;
        if (roll < 0.4) {
          type = "spike";
          w = 24;
          h = 28 + Math.random() * 10;
        } else if (roll < 0.7) {
          type = "double_spike";
          w = 22;
          h = 26 + Math.random() * 10;
        } else {
          type = "pillar";
          w = 28;
          h = 30 + Math.random() * 20;
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
        const px = PLAYER_X + 4;
        const py = g.playerY + 4;
        const pw = PLAYER_SIZE - 8;
        const ph = PLAYER_SIZE - 8;

        if (obs.type === "spike" || obs.type === "double_spike") {
          // Triangle collision — check if player overlaps spike area
          const spikeTop = GROUND_Y - obs.height;
          const spikeCx = obs.x + obs.width / 2;
          if (
            px + pw > obs.x + 4 &&
            px < obs.x + obs.width - 4 &&
            py + ph > spikeTop + obs.height * 0.3
          ) {
            // More precise: check if bottom of player is within the triangle width at that height
            const playerBottom = py + ph;
            const heightInSpike = GROUND_Y - playerBottom;
            const widthAtHeight = (heightInSpike / obs.height) * obs.width;
            const leftEdge = spikeCx - widthAtHeight / 2;
            const rightEdge = spikeCx + widthAtHeight / 2;
            if (px + pw > leftEdge + 2 && px < rightEdge - 2) {
              g.gameOver = true;
              spawnDeathParticles();
              setHighScore((prev) => Math.max(prev, Math.floor(g.score)));
              return;
            }
          }
        } else {
          // Box collision for pillars
          const oy = GROUND_Y - obs.height;
          if (px + pw > obs.x + 3 && px < obs.x + obs.width - 3 && py + ph > oy + 3) {
            g.gameOver = true;
            spawnDeathParticles();
            setHighScore((prev) => Math.max(prev, Math.floor(g.score)));
            return;
          }
        }
      }

      g.score += 0.15;
      g.gameSpeed += GAME_SPEED_INC;
      g.frameCount++;

      updateParticles();
    }

    // ── Game loop ──
    function gameLoop() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground();
      drawParticles();
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
    <div className="rounded-xl border border-emerald-500/20 overflow-hidden bg-[#050510]" style={{ boxShadow: "0 0 20px rgba(16,185,129,0.1)" }}>
      <canvas
        ref={canvasRef}
        height={CANVAS_HEIGHT}
        onClick={jump}
        className="w-full cursor-pointer"
      />
    </div>
  );
}
