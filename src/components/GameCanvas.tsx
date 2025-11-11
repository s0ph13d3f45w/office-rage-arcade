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
  type: "computer" | "wall" | "coworker" | "coffee" | "coin";
  collected: boolean;
  damaged?: boolean; // For computers, walls, coworkers - shows modified state
  value?: number;
}

const CELL_SIZE = 40;
const MAZE_WIDTH = 20;
const MAZE_HEIGHT = 16;
const VISION_DISTANCE = 3; // Reduced vision range
const SPEED_BOOST_DURATION = 180; // 3 seconds at 60fps
const SCARED_DURATION = 180; // 3 seconds at 60fps
const PLAYER_SPEED = 0.15; // Much slower movement
const EXECUTIVE_BASE_SPEED = 0.05; // Much slower executives
const INVINCIBILITY_DURATION = 120; // 2 seconds at 60fps
const CATCH_COOLDOWN = 30; // 0.5 seconds at 60fps

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
  const [player, setPlayer] = useState<Position>({ x: 10, y: 8 }); // Start in center
  const [playerDirection, setPlayerDirection] = useState<Position>({ x: 0, y: 0 });
  const [speedBoost, setSpeedBoost] = useState(0);
  const [invincibilityTimer, setInvincibilityTimer] = useState(0);
  const [catchCooldown, setCatchCooldown] = useState(0);
  const keysPressed = useRef<Set<string>>(new Set());
  
  const [executives, setExecutives] = useState<Executive[]>([
    {
      position: { x: 2, y: 2 },
      direction: { x: 1, y: 0 },
      isScared: false,
      scaredTimer: 0,
      color: "#FF1493",
      name: "Boomer Bob",
      speech: "Back in MY day!",
      scaredSpeech: "We need training!",
    },
    {
      position: { x: 17, y: 2 },
      direction: { x: 0, y: 1 },
      isScared: false,
      scaredTimer: 0,
      color: "#FFD700",
      name: "Nostalgic Ned",
      speech: "Good old days...",
      scaredSpeech: "Everything better!",
    },
    {
      position: { x: 2, y: 13 },
      direction: { x: 0, y: -1 },
      isScared: false,
      scaredTimer: 0,
      color: "#00FF00",
      name: "Traditional Tom",
      speech: "Very disruptive!",
      scaredSpeech: "Diversity workshop!",
    },
    {
      position: { x: 17, y: 13 },
      direction: { x: -1, y: 0 },
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
      
      if (e.key === "p" || e.key === "P") {
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

  // Ensure player starts on a walkable tile (avoid spawning inside walls)
  useEffect(() => {
    const gx = Math.floor(player.x);
    const gy = Math.floor(player.y);
    if (maze[gy]?.[gx]) {
      const cx = Math.floor(MAZE_WIDTH / 2);
      const cy = Math.floor(MAZE_HEIGHT / 2);
      outer: for (let r = 0; r < Math.max(MAZE_WIDTH, MAZE_HEIGHT); r++) {
        for (let y = cy - r; y <= cy + r; y++) {
          for (let x = cx - r; x <= cx + r; x++) {
            if (x >= 0 && x < MAZE_WIDTH && y >= 0 && y < MAZE_HEIGHT && !maze[y][x]) {
              setPlayer({ x, y });
              break outer;
            }
          }
        }
      }
    }
  }, []);

const handleAction = () => {
    // Check for nearby collectibles (damage/modify instead of destroy -> spawn a coin)
    const nearby = collectibles.find(
      (c) =>
        !c.collected &&
        !c.damaged &&
        c.type !== "coin" &&
        Math.abs(c.position.x - player.x) <= 1 &&
        Math.abs(c.position.y - player.y) <= 1
    );

    if (nearby) {
      let coinValue = 5;
      let sound: string | null = null;

      if (nearby.type === "computer") {
        coinValue = 8;
        sound = "destroy";
      } else if (nearby.type === "wall") {
        coinValue = 5;
        sound = "graffiti";
      } else if (nearby.type === "coworker") {
        coinValue = 10;
        sound = "cake";
      } else if (nearby.type === "coffee") {
        // Power-up: collect it entirely (it disappears)
        setSpeedBoost(SPEED_BOOST_DURATION);
        sound = "powerup";
        setCollectibles((prev) =>
          prev.map((c) => (c === nearby ? { ...c, collected: true } : c))
        );
        return;
      }

      if (sound) playSound(sound);

      // Damage the item (keep it visible but modified) and spawn a coin
      setCollectibles((prev) => {
        const updated = prev.map((c) => (c === nearby ? { ...c, damaged: true } : c));
        return [
          ...updated,
          {
            position: { ...nearby.position },
            type: "coin" as const,
            collected: false,
            value: coinValue,
          },
        ];
      });
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

      if (keysPressed.current.has("w")) dy = -speed;
      if (keysPressed.current.has("s")) dy = speed;
      if (keysPressed.current.has("a")) dx = -speed;
      if (keysPressed.current.has("d")) dx = speed;

      if (dx !== 0 || dy !== 0) {
        setPlayerDirection({ x: dx, y: dy });
          setPlayer((prev) => {
            const isOpen = (x: number, y: number) =>
              x >= 0 && x < MAZE_WIDTH && y >= 0 && y < MAZE_HEIGHT && !maze[y][x];

            let nx = prev.x;
            let ny = prev.y;

            // Attempt horizontal move first with solid wall collision
            if (dx !== 0) {
              const tx = prev.x + dx;
              const gx = Math.floor(tx);
              const gy = Math.floor(prev.y);
              if (isOpen(gx, gy)) {
                nx = Math.min(MAZE_WIDTH - 0.001, Math.max(0, tx));
              }
            }

            // Then vertical move with solid wall collision
            if (dy !== 0) {
              const ty = prev.y + dy;
              const gx = Math.floor(nx);
              const gy = Math.floor(ty);
              if (isOpen(gx, gy)) {
                ny = Math.min(MAZE_HEIGHT - 0.001, Math.max(0, ty));
              }
            }

            return { x: nx, y: ny };
          });
      }

      // Update speed boost
      if (speedBoost > 0) {
        setSpeedBoost((prev) => prev - 1);
      }

      // Update invincibility timer
      if (invincibilityTimer > 0) {
        setInvincibilityTimer((prev) => prev - 1);
      }

      // Update catch cooldown
      if (catchCooldown > 0) {
        setCatchCooldown((prev) => prev - 1);
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
          const baseSpeed = EXECUTIVE_BASE_SPEED + gameState.level * 0.01; // Reduced level scaling
          
          if (Math.random() < baseSpeed) {
            // Less erratic movement
            if (Math.random() < 0.02) {
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
              // Hit wall - try to navigate around it smartly
              const perpDirections = exec.direction.x !== 0 
                ? [{ x: 0, y: 1 }, { x: 0, y: -1 }] 
                : [{ x: 1, y: 0 }, { x: -1, y: 0 }];
              
              // Try perpendicular directions first
              for (const dir of perpDirections) {
                const testX = Math.floor(exec.position.x + dir.x);
                const testY = Math.floor(exec.position.y + dir.y);
                if (testX >= 0 && testX < MAZE_WIDTH && testY >= 0 && testY < MAZE_HEIGHT && !maze[testY][testX]) {
                  return { ...exec, direction: dir };
                }
              }
              
              // If blocked on all sides, try opposite direction
              return {
                ...exec,
                direction: { x: -exec.direction.x, y: -exec.direction.y },
              };
            }
          }

          return exec;
        })
      );

      // Collect coins by walking over them
      const playerGX = Math.floor(player.x);
      const playerGY = Math.floor(player.y);
      setCollectibles((prev) =>
        prev.map((c) => {
          if (c.type === "coin" && !c.collected && c.position.x === playerGX && c.position.y === playerGY) {
            updateScore(c.value ?? 5);
            playSound("coin");
            return { ...c, collected: true };
          }
          return c;
        })
      );

      // Check collisions with executives (only if not invincible and cooldown is 0)
      if (invincibilityTimer === 0 && catchCooldown === 0) {
        executives.forEach((exec) => {
          if (exec.isScared) return;

          const dx = player.x - exec.position.x;
          const dy = player.y - exec.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Blind spot: can't see if too close
          if (distance < 1) return;

          // Check if in vision range
          if (distance > VISION_DISTANCE) return;

          // Calculate angle between executive direction and player
          const angleToPlayer = Math.atan2(dy, dx);
          const execAngle = Math.atan2(exec.direction.y, exec.direction.x);
          let angleDiff = angleToPlayer - execAngle;

          // Normalize angle difference to -PI to PI
          while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
          while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

          // Narrower vision cone (30 degrees on each side = 60 degrees total)
          const coneAngle = Math.PI / 6;
          if (Math.abs(angleDiff) > coneAngle) return;

          // Line-of-sight check: trace path to player
          const steps = Math.ceil(distance);
          let lineOfSight = true;
          for (let i = 1; i <= steps; i++) {
            const checkX = Math.floor(exec.position.x + (dx / distance) * i);
            const checkY = Math.floor(exec.position.y + (dy / distance) * i);
            if (checkX >= 0 && checkX < MAZE_WIDTH && checkY >= 0 && checkY < MAZE_HEIGHT) {
              if (maze[checkY][checkX]) {
                lineOfSight = false;
                break;
              }
            }
          }

          if (lineOfSight) {
            loseLife();
            playSound("caught");
            setCatchCooldown(CATCH_COOLDOWN);
            setInvincibilityTimer(INVINCIBILITY_DURATION);
            
            // Smart respawn: find safe location
            const findSafeSpawn = () => {
              const attempts = 50;
              for (let i = 0; i < attempts; i++) {
                const x = 2 + Math.floor(Math.random() * (MAZE_WIDTH - 4));
                const y = 2 + Math.floor(Math.random() * (MAZE_HEIGHT - 4));
                
                // Check if walkable
                if (maze[y][x]) continue;
                
                // Check distance from all executives
                let safe = true;
                for (const e of executives) {
                  const dist = Math.sqrt((e.position.x - x) ** 2 + (e.position.y - y) ** 2);
                  if (dist < 6) {
                    safe = false;
                    break;
                  }
                }
                
                if (safe) return { x, y };
              }
              
              // Fallback: spawn in farthest corner from all executives
              const corners = [
                { x: 2, y: 2 },
                { x: MAZE_WIDTH - 3, y: 2 },
                { x: 2, y: MAZE_HEIGHT - 3 },
                { x: MAZE_WIDTH - 3, y: MAZE_HEIGHT - 3 },
              ];
              
              let farthest = corners[0];
              let maxDist = 0;
              
              for (const corner of corners) {
                let totalDist = 0;
                for (const e of executives) {
                  totalDist += Math.sqrt((e.position.x - corner.x) ** 2 + (e.position.y - corner.y) ** 2);
                }
                if (totalDist > maxDist) {
                  maxDist = totalDist;
                  farthest = corner;
                }
              }
              
              return farthest;
            };
            
            setPlayer(findSafeSpawn());
          }
        });
      }
    }, 1000 / 60); // 60 FPS

    return () => clearInterval(gameLoop);
  }, [gameState, player, executives, speedBoost, invincibilityTimer, catchCooldown]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas with Y2K gradient background
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#e8d5ff");
    gradient.addColorStop(0.5, "#d5e8ff");
    gradient.addColorStop(1, "#ffe8f5");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw maze walls with 3D effect (thinner walls)
    const WALL_THICKNESS = 8; // Thin walls
    const WALL_OFFSET = (CELL_SIZE - WALL_THICKNESS) / 2;
    
    for (let y = 0; y < MAZE_HEIGHT; y++) {
      for (let x = 0; x < MAZE_WIDTH; x++) {
        if (maze[y][x]) {
          const posX = x * CELL_SIZE + WALL_OFFSET;
          const posY = y * CELL_SIZE + WALL_OFFSET;
          
          // Wall with glossy Y2K effect
          const wallGradient = ctx.createLinearGradient(posX, posY, posX + WALL_THICKNESS, posY + WALL_THICKNESS);
          wallGradient.addColorStop(0, "#b8a8ff");
          wallGradient.addColorStop(0.5, "#9a8aef");
          wallGradient.addColorStop(1, "#7a6adf");
          ctx.fillStyle = wallGradient;
          ctx.fillRect(posX, posY, WALL_THICKNESS, WALL_THICKNESS);
          
          // Glossy highlight
          ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
          ctx.fillRect(posX, posY, WALL_THICKNESS, WALL_THICKNESS / 3);
          
          // Chrome edge
          ctx.strokeStyle = "#d0c0ff";
          ctx.lineWidth = 1;
          ctx.strokeRect(posX, posY, WALL_THICKNESS, WALL_THICKNESS);
        }
      }
    }
    
    // Draw subtle grid on walkable spaces
    ctx.strokeStyle = "rgba(200, 180, 255, 0.2)";
    ctx.lineWidth = 1;
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
        
        if (c.damaged) {
          // Damaged screen - cracked and glitching
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(-10, -8, 20, 14);
          
          // Crack lines
          ctx.strokeStyle = "#ff4444";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-8, -6);
          ctx.lineTo(6, 4);
          ctx.moveTo(8, -4);
          ctx.lineTo(-6, 6);
          ctx.stroke();
          
          // Sparks
          ctx.fillStyle = "#ffff00";
          ctx.fillRect(4, 2, 2, 3);
          ctx.fillRect(-7, -3, 2, 3);
        } else {
          // Normal screen
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
        }
        
        // Base
        ctx.fillStyle = "#3a3a3a";
        ctx.fillRect(-6, 8, 12, 4);
        ctx.fillRect(-3, 12, 6, 2);
        
      } else if (c.type === "wall") {
        // Whiteboard - painted pink if damaged
        ctx.fillStyle = c.damaged ? "#ff69b4" : "#e0e0e0";
        ctx.fillRect(-14, -12, 28, 20);
        
        // Frame
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 2;
        ctx.strokeRect(-14, -12, 28, 20);
        
        if (c.damaged) {
          // Pink graffiti art
          ctx.fillStyle = "#ff1493";
          ctx.font = "bold 12px Arial";
          ctx.fillText("♥ Y2K ♥", -12, -2);
          ctx.fillStyle = "#ff69b4";
          ctx.font = "bold 10px Arial";
          ctx.fillText("REBEL!", -10, 6);
        } else {
          // Original graffiti placeholder
          ctx.fillStyle = "#ff6b9d";
          ctx.font = "bold 10px Arial";
          ctx.fillText("GRAFFITI", -13, -2);
          ctx.fillText("HERE!", -10, 5);
        }
        
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
        
        if (c.damaged) {
          // Pie on face!
          ctx.fillStyle = "#f5deb3";
          ctx.beginPath();
          ctx.arc(0, -7, 9, 0, Math.PI * 2);
          ctx.fill();
          
          // Whipped cream
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(-3, -8, 3, 0, Math.PI * 2);
          ctx.arc(3, -8, 3, 0, Math.PI * 2);
          ctx.arc(0, -10, 3, 0, Math.PI * 2);
          ctx.fill();
          
          // Eyes peeking through
          ctx.fillStyle = "#000";
          ctx.fillRect(-4, -9, 2, 1);
          ctx.fillRect(2, -9, 2, 1);
        } else {
          // Normal face
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
        }
        
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
      } else if (c.type === "coin") {
        // Shiny Y2K coin
        const coinGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 12);
        coinGrad.addColorStop(0, "#fff7b3");
        coinGrad.addColorStop(0.6, "#ffe066");
        coinGrad.addColorStop(1, "#ffc107");
        ctx.fillStyle = coinGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        // Sparkle
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.beginPath();
        ctx.moveTo(-2, -4);
        ctx.lineTo(0, -8);
        ctx.lineTo(2, -4);
        ctx.closePath();
        ctx.fill();
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
        const coneAngle = Math.PI / 6; // Narrower 30-degree cone
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

    // Invincibility effect - flashing
    if (invincibilityTimer > 0) {
      if (Math.floor(invincibilityTimer / 10) % 2 === 0) {
        ctx.globalAlpha = 0.5;
      }
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#00ffff";
    }

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

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }, [player, executives, collectibles, speedBoost, invincibilityTimer]);

  return (
    <canvas
      ref={canvasRef}
      width={MAZE_WIDTH * CELL_SIZE}
      height={MAZE_HEIGHT * CELL_SIZE}
      className="w-full h-auto"
      style={{ background: "linear-gradient(135deg, #e8d5ff, #d5e8ff, #ffe8f5)" }}
    />
  );
};
