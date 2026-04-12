"use client";

import { useState } from "react";
import { MineRunner } from "@/components/ui/MineRunner";

export function CreeperButton() {
  const [showGame, setShowGame] = useState(false);

  return (
    <>
      {/* Game popup */}
      {showGame && (
        <div
          style={{
            position: "fixed",
            bottom: "82px",
            left: "20px",
            zIndex: 9998,
            width: "min(420px, calc(100vw - 40px))",
          }}
        >
          <MineRunner />
        </div>
      )}

      {/* Corner icon */}
      <button
        onClick={() => setShowGame((v) => !v)}
        style={{
          position: "fixed",
          bottom: "20px",
          left: "20px",
          zIndex: 9999,
          width: "52px",
          height: "52px",
          borderRadius: "12px",
          backgroundColor: "#4aba3b",
          border: "2px solid #5cd64d",
          boxShadow: showGame
            ? "0 0 24px rgba(74,186,59,0.6), 0 4px 12px rgba(0,0,0,0.5)"
            : "0 0 16px rgba(74,186,59,0.4), 0 4px 12px rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          transition: "transform 0.15s, box-shadow 0.15s",
          transform: showGame ? "scale(1.08)" : "scale(1)",
          padding: 0,
        }}
        title="Play MineRunner!"
      >
        <svg width="32" height="32" viewBox="0 0 8 8">
          <rect x="0" y="0" width="8" height="8" fill="#4aba3b" />
          <rect x="1" y="1" width="2" height="2" fill="#1a1a1a" />
          <rect x="5" y="1" width="2" height="2" fill="#1a1a1a" />
          <rect x="3" y="3" width="2" height="1" fill="#1a1a1a" />
          <rect x="2" y="4" width="4" height="1" fill="#1a1a1a" />
          <rect x="2" y="5" width="1" height="2" fill="#1a1a1a" />
          <rect x="5" y="5" width="1" height="2" fill="#1a1a1a" />
        </svg>
      </button>
    </>
  );
}
