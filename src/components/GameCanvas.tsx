import { useEffect, useRef, useState } from "react";
import { GameState } from "./Game";

interface Position {
  x: number;
  y: number;
}

interface Executive {
  position: Position;
  direction: Position;
  isScared: boolean;
  scaredTimer: number;
  color: string;
  name: string;
  speech: string;
  scaredSpeech: string;
}

interface Collectible {
  position: Position;
  type: "computer" | "wall" | "coworker" | "coffee";
  collected: boolean;
}

const CELL_SIZE = 30;
const MAZE_WIDTH = 20;
const MAZE_HEIGHT = 16;
const VISION_DISTANCE = 5;
const SPEED_BOOST_DURATION = 180; // 3 seconds at 60fps
const SCARED_DURATION = 180; // 3 seconds at 60fps

export const GameCanvas = ({
  gameState,
  updateScore,
  loseLife,
}: {
  gameState: GameState;
  updateScore: (points: number) => void;
  loseLife: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [player, setPlayer] = useState<Position>({ x: 1, y: 1 });
  const [playerDirection, setPlayerDirection] = useState<Position>({ x: 0, y: 0 });
  const [speedBoost, setSpeedBoost] = useState(0);
  const keysPressed = useRef<Set<string>>(new Set());
  
  const [executives, setExecutives] = useState<Executive[]>([
    {
      position: { x: 18, y: 1 },
      direction: { x: -1, y: 0 },
      isScared: false,
      scaredTimer: 0,
      color: "#FF1493",
      name: "Boomer Bob",
      speech: "Back in MY day!",
      scaredSpeech: "We need training!",
    },
    {
      position: { x: 1, y: 14 },
      direction: { x: 1, y: 0 },
      isScared: false,
      scaredTimer: 0,
      color: "#FFD700",
      name: "Nostalgic Ned",
      speech: "Good old days...",
      scaredSpeech: "Everything better!",
    },
    {
      position: { x: 18, y: 14 },
      direction: { x: 0, y: -1 },
      isScared: false,
      scaredTimer: 0,
      color: "#00FF00",
      name: "Traditional Tom",
      speech: "Very disruptive!",
      scaredSpeech: "Diversity workshop!",
    },
    {
      position: { x: 10, y: 8 },
      direction: { x: 1, y: 0 },
      isScared: false,
      scaredTimer: 0,
      color: "#00FFFF",
      name: "Grumpy Greg",
      speech: "PC gone mad!",
      scaredSpeech: "HR is calling!",
    },
  ]);

  const [collectibles, setCollectibles] = useState<Collectible[]>(() => {
    const items: Collectible[] = [];
    // Add computers
    for (let i = 0; i < 15; i++) {
      items.push({
        position: {
          x: 2 + Math.floor(Math.random() * (MAZE_WIDTH - 4)),
          y: 2 + Math.floor(Math.random() * (MAZE_HEIGHT - 4)),
        },
        type: "computer",
        collected: false,
      });
    }
    // Add walls
    for (let i = 0; i < 10; i++) {
      items.push({
        position: {
          x: 2 + Math.floor(Math.random() * (MAZE_WIDTH - 4)),
          y: 2 + Math.floor(Math.random() * (MAZE_HEIGHT - 4)),
        },
        type: "wall",
        collected: false,
      });
    }
    // Add coworkers
    for (let i = 0; i < 8; i++) {
      items.push({
        position: {
          x: 2 + Math.floor(Math.random() * (MAZE_WIDTH - 4)),
          y: 2 + Math.floor(Math.random() * (MAZE_HEIGHT - 4)),
        },
        type: "coworker",
        collected: false,
      });
    }
    // Add coffee
    items.push({
      position: { x: 10, y: 3 },
      type: "coffee",
      collected: false,
    });
    return items;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key.toLowerCase());
      
      if (e.key === "x" || e.key === "X") {
        handleAction();
      }
      
      if (e.key === " ") {
        e.preventDefault();
        // Emergency HR call - could clear executives briefly
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [player, collectibles, executives]);

  const handleAction = () => {
    // Check for nearby collectibles
    const nearby = collectibles.find(
      (c) =>
        !c.collected &&
        Math.abs(c.position.x - player.x) <= 1 &&
        Math.abs(c.position.y - player.y) <= 1
    );

    if (nearby) {
      if (nearby.type === "computer") {
        updateScore(8);
        playSound("destroy");
      } else if (nearby.type === "wall") {
        updateScore(5);
        playSound("graffiti");
      } else if (nearby.type === "coworker") {
        updateScore(10);
        playSound("cake");
      } else if (nearby.type === "coffee") {
        setSpeedBoost(SPEED_BOOST_DURATION);
        playSound("powerup");
      }

      setCollectibles((prev) =>
        prev.map((c) =>
          c === nearby ? { ...c, collected: true } : c
        )
      );
    }

    // Check for nearby executives to put kick-me sign
    setExecutives((prev) =>
      prev.map((exec) => {
        if (
          !exec.isScared &&
          Math.abs(exec.position.x - player.x) <= 1 &&
          Math.abs(exec.position.y - player.y) <= 1
        ) {
          playSound("kickme");
          return { ...exec, isScared: true, scaredTimer: SCARED_DURATION };
        }
        return exec;
      })
    );
  };

  const playSound = (type: string) => {
    // Placeholder for sound effects
    console.log(`Playing sound: ${type}`);
  };

  useEffect(() => {
    if (gameState.isGameOver || gameState.isPaused) return;

    const gameLoop = setInterval(() => {
      // Update player position
      let dx = 0;
      let dy = 0;
      const speed = speedBoost > 0 ? 2 : 1;

      if (keysPressed.current.has("arrowup")) dy = -speed;
      if (keysPressed.current.has("arrowdown")) dy = speed;
      if (keysPressed.current.has("arrowleft")) dx = -speed;
      if (keysPressed.current.has("arrowright")) dx = speed;

      if (dx !== 0 || dy !== 0) {
        setPlayerDirection({ x: dx, y: dy });
        setPlayer((prev) => {
          const newX = Math.max(0, Math.min(MAZE_WIDTH - 1, prev.x + dx));
          const newY = Math.max(0, Math.min(MAZE_HEIGHT - 1, prev.y + dy));
          return { x: newX, y: newY };
        });
      }

      // Update speed boost
      if (speedBoost > 0) {
        setSpeedBoost((prev) => prev - 1);
      }

      // Update executives
      setExecutives((prev) =>
        prev.map((exec) => {
          if (exec.scaredTimer > 0) {
            // Move away from player when scared
            const dx = exec.position.x - player.x;
            const dy = exec.position.y - player.y;
            const moveX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
            const moveY = dy > 0 ? 1 : dy < 0 ? -1 : 0;

            return {
              ...exec,
              position: {
                x: Math.max(0, Math.min(MAZE_WIDTH - 1, exec.position.x + moveX)),
                y: Math.max(0, Math.min(MAZE_HEIGHT - 1, exec.position.y + moveY)),
              },
              scaredTimer: exec.scaredTimer - 1,
              isScared: exec.scaredTimer - 1 > 0,
            };
          }

          // Normal AI movement with vision cone
          const baseSpeed = 0.5 + gameState.level * 0.1;
          
          if (Math.random() < baseSpeed) {
            // Simple AI: occasionally change direction
            if (Math.random() < 0.1) {
              const directions = [
                { x: 1, y: 0 },
                { x: -1, y: 0 },
                { x: 0, y: 1 },
                { x: 0, y: -1 },
              ];
              exec.direction = directions[Math.floor(Math.random() * directions.length)];
            }

            const newX = exec.position.x + exec.direction.x;
            const newY = exec.position.y + exec.direction.y;

            if (newX >= 0 && newX < MAZE_WIDTH && newY >= 0 && newY < MAZE_HEIGHT) {
              return {
                ...exec,
                position: { x: newX, y: newY },
              };
            }
          }

          return exec;
        })
      );

      // Check collisions with executives
      executives.forEach((exec) => {
        if (exec.isScared) return;

        // Vision cone detection
        const inVisionCone =
          Math.abs(exec.position.x - player.x) <= VISION_DISTANCE &&
          Math.abs(exec.position.y - player.y) <= VISION_DISTANCE &&
          ((exec.direction.x > 0 && player.x > exec.position.x) ||
            (exec.direction.x < 0 && player.x < exec.position.x) ||
            (exec.direction.y > 0 && player.y > exec.position.y) ||
            (exec.direction.y < 0 && player.y < exec.position.y));

        if (inVisionCone) {
          loseLife();
          playSound("caught");
          // Reset player position
          setPlayer({ x: 1, y: 1 });
        }
      });
    }, 1000 / 60); // 60 FPS

    return () => clearInterval(gameLoop);
  }, [gameState, player, executives, speedBoost]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = "#1a0a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "#2d1b4e";
    for (let x = 0; x <= MAZE_WIDTH; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL_SIZE, 0);
      ctx.lineTo(x * CELL_SIZE, MAZE_HEIGHT * CELL_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= MAZE_HEIGHT; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL_SIZE);
      ctx.lineTo(MAZE_WIDTH * CELL_SIZE, y * CELL_SIZE);
      ctx.stroke();
    }

    // Draw collectibles
    collectibles.forEach((c) => {
      if (c.collected) return;

      ctx.save();
      ctx.translate(
        c.position.x * CELL_SIZE + CELL_SIZE / 2,
        c.position.y * CELL_SIZE + CELL_SIZE / 2
      );

      if (c.type === "computer") {
        ctx.fillStyle = "#888";
        ctx.fillRect(-8, -6, 16, 12);
        ctx.fillStyle = "#4a9eff";
        ctx.fillRect(-6, -4, 12, 8);
      } else if (c.type === "wall") {
        ctx.fillStyle = "#666";
        ctx.fillRect(-10, -8, 20, 16);
        ctx.fillStyle = "#ff6b9d";
        ctx.font = "12px Arial";
        ctx.fillText("✏️", -6, 4);
      } else if (c.type === "coworker") {
        ctx.fillStyle = "#f0c674";
        ctx.beginPath();
        ctx.arc(0, -4, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#4a9eff";
        ctx.fillRect(-6, 2, 12, 10);
      } else if (c.type === "coffee") {
        ctx.fillStyle = "#8b4513";
        ctx.fillRect(-6, -4, 12, 8);
        ctx.fillStyle = "#fff";
        ctx.font = "16px Arial";
        ctx.fillText("☕", -8, 4);
      }

      ctx.restore();
    });

    // Draw executives with vision cones
    executives.forEach((exec) => {
      if (!exec.isScared) {
        // Draw vision cone
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = exec.color;
        ctx.beginPath();
        const startX = exec.position.x * CELL_SIZE + CELL_SIZE / 2;
        const startY = exec.position.y * CELL_SIZE + CELL_SIZE / 2;
        ctx.moveTo(startX, startY);

        const angle = Math.atan2(exec.direction.y, exec.direction.x);
        const coneAngle = Math.PI / 4;
        const coneLength = VISION_DISTANCE * CELL_SIZE;

        ctx.lineTo(
          startX + Math.cos(angle - coneAngle) * coneLength,
          startY + Math.sin(angle - coneAngle) * coneLength
        );
        ctx.lineTo(
          startX + Math.cos(angle + coneAngle) * coneLength,
          startY + Math.sin(angle + coneAngle) * coneLength
        );
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Draw executive
      ctx.save();
      ctx.translate(
        exec.position.x * CELL_SIZE + CELL_SIZE / 2,
        exec.position.y * CELL_SIZE + CELL_SIZE / 2
      );

      // Body
      ctx.fillStyle = exec.isScared ? "#87CEEB" : "#333";
      ctx.fillRect(-8, 2, 16, 12);

      // Head (bald with ponytail)
      ctx.fillStyle = "#f0c674";
      ctx.beginPath();
      ctx.arc(0, -4, 8, 0, Math.PI * 2);
      ctx.fill();

      if (!exec.isScared) {
        // Ponytail
        ctx.fillStyle = "#8b4513";
        ctx.fillRect(-10, -2, 4, 8);
      }

      // Speech bubble
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(-20, -28, 40, 16);
      ctx.fillStyle = "#000";
      ctx.font = "8px Arial";
      ctx.textAlign = "center";
      const speech = exec.isScared ? exec.scaredSpeech : exec.speech;
      ctx.fillText(speech, 0, -18);

      ctx.restore();
    });

    // Draw player
    ctx.save();
    ctx.translate(
      player.x * CELL_SIZE + CELL_SIZE / 2,
      player.y * CELL_SIZE + CELL_SIZE / 2
    );

    // Body (bright colored clothes)
    ctx.fillStyle = speedBoost > 0 ? "#FFD700" : "#FF1493";
    ctx.fillRect(-6, 4, 12, 10);

    // Head
    ctx.fillStyle = "#f0c674";
    ctx.beginPath();
    ctx.arc(0, -2, 6, 0, Math.PI * 2);
    ctx.fill();

    // Hair
    ctx.fillStyle = "#4a2511";
    ctx.beginPath();
    ctx.arc(0, -6, 7, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, [player, executives, collectibles, speedBoost]);

  return (
    <canvas
      ref={canvasRef}
      width={MAZE_WIDTH * CELL_SIZE}
      height={MAZE_HEIGHT * CELL_SIZE}
      className="w-full h-auto bg-arcade-dark"
    />
  );
};
