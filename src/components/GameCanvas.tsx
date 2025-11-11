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

const CELL_SIZE = 40;
const MAZE_WIDTH = 20;
const MAZE_HEIGHT = 16;
const VISION_DISTANCE = 4;
const SPEED_BOOST_DURATION = 180; // 3 seconds at 60fps
const SCARED_DURATION = 180; // 3 seconds at 60fps
const PLAYER_SPEED = 0.15; // Much slower movement
const EXECUTIVE_BASE_SPEED = 0.08; // Much slower executives

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

  // Maze walls
  const [maze] = useState<boolean[][]>(() => {
    const m = Array(MAZE_HEIGHT).fill(0).map(() => Array(MAZE_WIDTH).fill(false));
    
    // Outer walls
    for (let x = 0; x < MAZE_WIDTH; x++) {
      m[0][x] = true;
      m[MAZE_HEIGHT - 1][x] = true;
    }
    for (let y = 0; y < MAZE_HEIGHT; y++) {
      m[y][0] = true;
      m[y][MAZE_WIDTH - 1] = true;
    }
    
    // Internal maze walls
    // Vertical walls
    for (let y = 2; y < MAZE_HEIGHT - 2; y += 3) {
      for (let x = 3; x < MAZE_WIDTH - 3; x += 4) {
        m[y][x] = true;
        if (Math.random() > 0.3) m[y + 1][x] = true;
      }
    }
    
    // Horizontal walls
    for (let x = 2; x < MAZE_WIDTH - 2; x += 3) {
      for (let y = 4; y < MAZE_HEIGHT - 4; y += 4) {
        m[y][x] = true;
        if (Math.random() > 0.3) m[y][x + 1] = true;
      }
    }
    
    // Add some room-like structures
    const rooms = [
      { x: 5, y: 5, w: 3, h: 3 },
      { x: 13, y: 3, w: 4, h: 3 },
      { x: 3, y: 10, w: 3, h: 4 },
      { x: 14, y: 10, w: 4, h: 4 },
    ];
    
    rooms.forEach(room => {
      for (let x = room.x; x < room.x + room.w; x++) {
        m[room.y][x] = true;
        m[room.y + room.h - 1][x] = true;
      }
      for (let y = room.y; y < room.y + room.h; y++) {
        m[y][room.x] = true;
        m[y][room.x + room.w - 1] = true;
      }
      // Add door
      m[room.y + Math.floor(room.h / 2)][room.x] = false;
    });
    
    return m;
  });

  const [collectibles, setCollectibles] = useState<Collectible[]>(() => {
    const items: Collectible[] = [];
    const isWalkable = (x: number, y: number) => {
      return x >= 0 && x < MAZE_WIDTH && y >= 0 && y < MAZE_HEIGHT && !maze[y][x];
    };
    
    // Add computers
    for (let i = 0; i < 12; i++) {
      let x, y;
      do {
        x = 2 + Math.floor(Math.random() * (MAZE_WIDTH - 4));
        y = 2 + Math.floor(Math.random() * (MAZE_HEIGHT - 4));
      } while (!isWalkable(x, y));
      
      items.push({
        position: { x, y },
        type: "computer",
        collected: false,
      });
    }
    
    // Add walls
    for (let i = 0; i < 8; i++) {
      let x, y;
      do {
        x = 2 + Math.floor(Math.random() * (MAZE_WIDTH - 4));
        y = 2 + Math.floor(Math.random() * (MAZE_HEIGHT - 4));
      } while (!isWalkable(x, y));
      
      items.push({
        position: { x, y },
        type: "wall",
        collected: false,
      });
    }
    
    // Add coworkers
    for (let i = 0; i < 6; i++) {
      let x, y;
      do {
        x = 2 + Math.floor(Math.random() * (MAZE_WIDTH - 4));
        y = 2 + Math.floor(Math.random() * (MAZE_HEIGHT - 4));
      } while (!isWalkable(x, y));
      
      items.push({
        position: { x, y },
        type: "coworker",
        collected: false,
      });
    }
    
    // Add coffee machines
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
      const speed = speedBoost > 0 ? PLAYER_SPEED * 2 : PLAYER_SPEED;

      if (keysPressed.current.has("arrowup")) dy = -speed;
      if (keysPressed.current.has("arrowdown")) dy = speed;
      if (keysPressed.current.has("arrowleft")) dx = -speed;
      if (keysPressed.current.has("arrowright")) dx = speed;

      if (dx !== 0 || dy !== 0) {
        setPlayerDirection({ x: dx, y: dy });
        setPlayer((prev) => {
          const newX = Math.max(0, Math.min(MAZE_WIDTH - 1, prev.x + dx));
          const newY = Math.max(0, Math.min(MAZE_HEIGHT - 1, prev.y + dy));
          
          // Check wall collision
          const gridX = Math.floor(newX);
          const gridY = Math.floor(newY);
          
          if (maze[gridY] && maze[gridY][gridX]) {
            return prev; // Hit a wall, don't move
          }
          
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
          const baseSpeed = EXECUTIVE_BASE_SPEED + gameState.level * 0.02;
          
          if (Math.random() < baseSpeed) {
            // Simple AI: occasionally change direction
            if (Math.random() < 0.05) {
              const directions = [
                { x: 1, y: 0 },
                { x: -1, y: 0 },
                { x: 0, y: 1 },
                { x: 0, y: -1 },
              ];
              exec.direction = directions[Math.floor(Math.random() * directions.length)];
            }

            const newX = exec.position.x + exec.direction.x * 0.5;
            const newY = exec.position.y + exec.direction.y * 0.5;
            
            const gridX = Math.floor(newX);
            const gridY = Math.floor(newY);

            if (
              newX >= 0 && newX < MAZE_WIDTH && 
              newY >= 0 && newY < MAZE_HEIGHT &&
              !maze[gridY][gridX]
            ) {
              return {
                ...exec,
                position: { x: newX, y: newY },
              };
            } else {
              // Hit wall, change direction
              const directions = [
                { x: 1, y: 0 },
                { x: -1, y: 0 },
                { x: 0, y: 1 },
                { x: 0, y: -1 },
              ];
              return {
                ...exec,
                direction: directions[Math.floor(Math.random() * directions.length)],
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

    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#1a0a2e");
    gradient.addColorStop(1, "#0f0520");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw maze walls with 3D effect
    for (let y = 0; y < MAZE_HEIGHT; y++) {
      for (let x = 0; x < MAZE_WIDTH; x++) {
        if (maze[y][x]) {
          const posX = x * CELL_SIZE;
          const posY = y * CELL_SIZE;
          
          // Wall shadow
          ctx.fillStyle = "#000";
          ctx.fillRect(posX + 2, posY + 2, CELL_SIZE - 2, CELL_SIZE - 2);
          
          // Wall base
          const wallGradient = ctx.createLinearGradient(posX, posY, posX + CELL_SIZE, posY + CELL_SIZE);
          wallGradient.addColorStop(0, "#4a4a6a");
          wallGradient.addColorStop(1, "#2a2a3a");
          ctx.fillStyle = wallGradient;
          ctx.fillRect(posX, posY, CELL_SIZE - 2, CELL_SIZE - 2);
          
          // Wall highlight
          ctx.fillStyle = "#5a5a7a";
          ctx.fillRect(posX, posY, CELL_SIZE - 2, 2);
          ctx.fillRect(posX, posY, 2, CELL_SIZE - 2);
        }
      }
    }
    
    // Draw grid on walkable spaces
    ctx.strokeStyle = "#2d1b4e";
    ctx.lineWidth = 0.5;
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
    ctx.lineWidth = 1;

    // Draw collectibles
    collectibles.forEach((c) => {
      if (c.collected) return;

      ctx.save();
      ctx.translate(
        c.position.x * CELL_SIZE + CELL_SIZE / 2,
        c.position.y * CELL_SIZE + CELL_SIZE / 2
      );

      if (c.type === "computer") {
        // Monitor
        ctx.fillStyle = "#2a2a2a";
        ctx.fillRect(-12, -10, 24, 18);
        ctx.fillStyle = "#1a1a1a";
        ctx.fillRect(-11, -9, 22, 16);
        
        // Screen
        const screenGrad = ctx.createLinearGradient(-10, -8, 10, 8);
        screenGrad.addColorStop(0, "#4a9eff");
        screenGrad.addColorStop(1, "#2a6fbb");
        ctx.fillStyle = screenGrad;
        ctx.fillRect(-10, -8, 20, 14);
        
        // Screen details
        ctx.fillStyle = "#fff";
        ctx.fillRect(-8, -6, 7, 1);
        ctx.fillRect(-8, -4, 10, 1);
        ctx.fillRect(-8, -2, 6, 1);
        
        // Base
        ctx.fillStyle = "#3a3a3a";
        ctx.fillRect(-6, 8, 12, 4);
        ctx.fillRect(-3, 12, 6, 2);
        
      } else if (c.type === "wall") {
        // Whiteboard
        ctx.fillStyle = "#e0e0e0";
        ctx.fillRect(-14, -12, 28, 20);
        
        // Frame
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 2;
        ctx.strokeRect(-14, -12, 28, 20);
        
        // Graffiti placeholder
        ctx.fillStyle = "#ff6b9d";
        ctx.font = "bold 10px Arial";
        ctx.fillText("GRAFFITI", -13, -2);
        ctx.fillText("HERE!", -10, 5);
        
        // Markers at bottom
        ctx.fillStyle = "#333";
        ctx.fillRect(-10, 10, 3, 8);
        ctx.fillStyle = "#ff1493";
        ctx.fillRect(-6, 10, 3, 8);
        ctx.fillStyle = "#00ffff";
        ctx.fillRect(-2, 10, 3, 8);
        
      } else if (c.type === "coworker") {
        // Head
        ctx.fillStyle = "#f0c674";
        ctx.beginPath();
        ctx.arc(0, -8, 7, 0, Math.PI * 2);
        ctx.fill();
        
        // Hair
        ctx.fillStyle = "#4a2511";
        ctx.beginPath();
        ctx.arc(-2, -12, 4, 0, Math.PI);
        ctx.arc(2, -12, 4, 0, Math.PI);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = "#000";
        ctx.fillRect(-4, -9, 2, 2);
        ctx.fillRect(2, -9, 2, 2);
        
        // Smile
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, -6, 3, 0, Math.PI);
        ctx.stroke();
        
        // Body - shirt
        const shirtGrad = ctx.createLinearGradient(-8, 0, 8, 14);
        shirtGrad.addColorStop(0, "#6a9eff");
        shirtGrad.addColorStop(1, "#4a6fbb");
        ctx.fillStyle = shirtGrad;
        ctx.fillRect(-8, 0, 16, 14);
        
        // Tie
        ctx.fillStyle = "#333";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-2, 8);
        ctx.lineTo(0, 12);
        ctx.lineTo(2, 8);
        ctx.closePath();
        ctx.fill();
        
      } else if (c.type === "coffee") {
        // Machine body
        const machineGrad = ctx.createLinearGradient(-12, -14, 12, 14);
        machineGrad.addColorStop(0, "#8b4513");
        machineGrad.addColorStop(1, "#5a2a0a");
        ctx.fillStyle = machineGrad;
        ctx.fillRect(-12, -14, 24, 28);
        
        // Display panel
        ctx.fillStyle = "#000";
        ctx.fillRect(-8, -10, 16, 8);
        ctx.fillStyle = "#0f0";
        ctx.font = "8px Arial";
        ctx.fillText("COFFEE", -6, -4);
        
        // Dispenser
        ctx.fillStyle = "#333";
        ctx.fillRect(-6, 2, 12, 6);
        ctx.fillStyle = "#222";
        ctx.fillRect(-4, 4, 8, 3);
        
        // Cup
        ctx.fillStyle = "#fff";
        ctx.fillRect(-3, 8, 6, 6);
        
        // Steam
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-1, 6);
        ctx.bezierCurveTo(-2, 2, 0, 0, 1, -2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(1, 6);
        ctx.bezierCurveTo(2, 2, 0, 0, -1, -2);
        ctx.stroke();
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

      // Body - suit
      const suitGrad = ctx.createLinearGradient(-10, 0, 10, 16);
      if (exec.isScared) {
        suitGrad.addColorStop(0, "#b0d4e8");
        suitGrad.addColorStop(1, "#87CEEB");
      } else {
        suitGrad.addColorStop(0, "#444");
        suitGrad.addColorStop(1, "#222");
      }
      ctx.fillStyle = suitGrad;
      ctx.fillRect(-10, 4, 20, 16);
      
      // Tie
      ctx.fillStyle = exec.isScared ? "#5a8fb0" : "#8b0000";
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(-3, 12);
      ctx.lineTo(0, 18);
      ctx.lineTo(3, 12);
      ctx.closePath();
      ctx.fill();
      
      // Arms
      ctx.fillStyle = exec.isScared ? "#b0d4e8" : "#333";
      ctx.fillRect(-14, 8, 4, 10);
      ctx.fillRect(10, 8, 4, 10);

      // Head (bald with ponytail)
      ctx.fillStyle = "#f0c674";
      ctx.beginPath();
      ctx.arc(0, -6, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Bald spot on top
      ctx.fillStyle = "#e0b664";
      ctx.beginPath();
      ctx.ellipse(0, -10, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Glasses
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-4, -6, 3, 0, Math.PI * 2);
      ctx.arc(4, -6, 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-1, -6);
      ctx.lineTo(1, -6);
      ctx.stroke();
      
      // Eyes behind glasses
      ctx.fillStyle = "#000";
      ctx.fillRect(-5, -7, 2, 2);
      ctx.fillRect(3, -7, 2, 2);
      
      // Grumpy mouth
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, -2, 3, Math.PI, Math.PI * 2);
      ctx.stroke();

      if (!exec.isScared) {
        // Ponytail
        ctx.fillStyle = "#8b4513";
        ctx.beginPath();
        ctx.ellipse(-12, 0, 3, 8, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Ponytail tie
        ctx.fillStyle = "#333";
        ctx.fillRect(-13, -2, 4, 3);
      } else {
        // Ponytail flies off when scared
        ctx.fillStyle = "#8b4513";
        ctx.save();
        ctx.translate(-15, -12);
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.ellipse(0, 0, 3, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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

    // Head
    ctx.fillStyle = "#f0c674";
    ctx.beginPath();
    ctx.arc(0, -8, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Hair - long flowing
    ctx.fillStyle = "#4a2511";
    ctx.beginPath();
    ctx.arc(-3, -12, 6, 0, Math.PI);
    ctx.arc(3, -12, 6, 0, Math.PI);
    ctx.fill();
    
    // Hair strands
    ctx.strokeStyle = "#4a2511";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.bezierCurveTo(-10, -6, -10, 0, -9, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, -10);
    ctx.bezierCurveTo(10, -6, 10, 0, 9, 4);
    ctx.stroke();
    
    // Eyes
    ctx.fillStyle = "#000";
    ctx.fillRect(-5, -9, 2, 3);
    ctx.fillRect(3, -9, 2, 3);
    
    // Determined smile
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -5, 4, 0.2, Math.PI - 0.2);
    ctx.stroke();
    
    // Body - bright outfit with glow
    if (speedBoost > 0) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#FFD700";
    }
    
    const outfitGrad = ctx.createLinearGradient(-10, 0, 10, 18);
    if (speedBoost > 0) {
      outfitGrad.addColorStop(0, "#FFD700");
      outfitGrad.addColorStop(1, "#FFA500");
    } else {
      outfitGrad.addColorStop(0, "#FF1493");
      outfitGrad.addColorStop(1, "#C71585");
    }
    ctx.fillStyle = outfitGrad;
    ctx.fillRect(-10, 0, 20, 18);
    
    ctx.shadowBlur = 0;
    
    // Blazer details
    ctx.fillStyle = speedBoost > 0 ? "#FFB700" : "#FF69B4";
    ctx.fillRect(-10, 0, 4, 18);
    ctx.fillRect(6, 0, 4, 18);
    
    // Belt
    ctx.fillStyle = "#333";
    ctx.fillRect(-10, 10, 20, 3);
    
    // Arms
    ctx.fillStyle = speedBoost > 0 ? "#FFD700" : "#FF1493";
    ctx.fillRect(-14, 4, 4, 12);
    ctx.fillRect(10, 4, 4, 12);
    
    // Hands
    ctx.fillStyle = "#f0c674";
    ctx.beginPath();
    ctx.arc(-12, 16, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(12, 16, 3, 0, Math.PI * 2);
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
