import { useEffect, useRef, useState, useCallback } from "react";
import { GameState } from "./Game";
import playerSprite from "@/assets/player-sprite.png";
import executiveSprite from "@/assets/executive-sprite.png";
import executiveScaredSprite from "@/assets/executive-scared-sprite.png";
import computerSprite from "@/assets/computer-sprite.png";
import computerDamagedSprite from "@/assets/computer-damaged-sprite.png";
import whiteboardSprite from "@/assets/whiteboard-sprite.png";
import whiteboardPaintedSprite from "@/assets/whiteboard-painted-sprite.png";
import coworkerSprite from "@/assets/coworker-sprite.png";
import coworkerPiedSprite from "@/assets/coworker-pied-sprite.png";
import coffeeSprite from "@/assets/coffee-sprite.png";
import coinSprite from "@/assets/coin-sprite.png";

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
  
  // Preload all sprite images
  const [sprites, setSprites] = useState<Record<string, HTMLImageElement>>({});
  
  useEffect(() => {
    const loadSprites = async () => {
      const spriteMap: Record<string, HTMLImageElement> = {};
      const loadImage = (src: string): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      };

      const [
        player,
        executive,
        executiveScared,
        computer,
        computerDamaged,
        whiteboard,
        whiteboardPainted,
        coworker,
        coworkerPied,
        coffee,
        coin,
      ] = await Promise.all([
        loadImage(playerSprite),
        loadImage(executiveSprite),
        loadImage(executiveScaredSprite),
        loadImage(computerSprite),
        loadImage(computerDamagedSprite),
        loadImage(whiteboardSprite),
        loadImage(whiteboardPaintedSprite),
        loadImage(coworkerSprite),
        loadImage(coworkerPiedSprite),
        loadImage(coffeeSprite),
        loadImage(coinSprite),
      ]);

      spriteMap.player = player;
      spriteMap.executive = executive;
      spriteMap.executiveScared = executiveScared;
      spriteMap.computer = computer;
      spriteMap.computerDamaged = computerDamaged;
      spriteMap.whiteboard = whiteboard;
      spriteMap.whiteboardPainted = whiteboardPainted;
      spriteMap.coworker = coworker;
      spriteMap.coworkerPied = coworkerPied;
      spriteMap.coffee = coffee;
      spriteMap.coin = coin;

      setSprites(spriteMap);
    };

    loadSprites();
  }, []);
  
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

  const handleAction = useCallback(() => {
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
  }, [collectibles, player]);

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
  }, [handleAction]);

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
          const PLAYER_RADIUS = 0.3; // Player collision box radius
          
          // Helper to check if a position is valid (not in a wall)
          const isWalkable = (x: number, y: number) => {
            const gridX = Math.floor(x);
            const gridY = Math.floor(y);
            return gridX >= 0 && gridX < MAZE_WIDTH && 
                   gridY >= 0 && gridY < MAZE_HEIGHT && 
                   !maze[gridY][gridX];
          };
          
          // Check if all corners of the player's collision box are walkable
          const canMoveTo = (x: number, y: number) => {
            // Check four corners of the collision box
            return isWalkable(x - PLAYER_RADIUS, y - PLAYER_RADIUS) &&
                   isWalkable(x + PLAYER_RADIUS, y - PLAYER_RADIUS) &&
                   isWalkable(x - PLAYER_RADIUS, y + PLAYER_RADIUS) &&
                   isWalkable(x + PLAYER_RADIUS, y + PLAYER_RADIUS);
          };

          let newX = prev.x;
          let newY = prev.y;

          // Try horizontal movement
          if (dx !== 0) {
            const testX = prev.x + dx;
            if (testX >= PLAYER_RADIUS && testX < MAZE_WIDTH - PLAYER_RADIUS && canMoveTo(testX, prev.y)) {
              newX = testX;
            }
          }

          // Try vertical movement
          if (dy !== 0) {
            const testY = prev.y + dy;
            if (testY >= PLAYER_RADIUS && testY < MAZE_HEIGHT - PLAYER_RADIUS && canMoveTo(newX, testY)) {
              newY = testY;
            }
          }

          return { x: newX, y: newY };
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
    if (!canvas || Object.keys(sprites).length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas with 1980s arcade dark background
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add grid effect for retro arcade feel
    ctx.strokeStyle = "rgba(255, 0, 255, 0.1)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw maze walls with neon 1980s effect (thinner walls)
    const WALL_THICKNESS = 8; // Thin walls
    const WALL_OFFSET = (CELL_SIZE - WALL_THICKNESS) / 2;
    
    for (let y = 0; y < MAZE_HEIGHT; y++) {
      for (let x = 0; x < MAZE_WIDTH; x++) {
        if (maze[y][x]) {
          const posX = x * CELL_SIZE + WALL_OFFSET;
          const posY = y * CELL_SIZE + WALL_OFFSET;
          
          // Neon wall with glow
          ctx.fillStyle = "#ff00ff";
          ctx.shadowBlur = 15;
          ctx.shadowColor = "#ff00ff";
          ctx.fillRect(posX, posY, WALL_THICKNESS, WALL_THICKNESS);
          
          // Inner glow
          ctx.fillStyle = "#ff66ff";
          ctx.shadowBlur = 5;
          ctx.fillRect(posX + 1, posY + 1, WALL_THICKNESS - 2, WALL_THICKNESS - 2);
          
          // Reset shadow
          ctx.shadowBlur = 0;
        }
      }
    }
    
    // Draw subtle neon grid on walkable spaces
    ctx.strokeStyle = "rgba(0, 255, 255, 0.15)";
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

    // Draw collectibles using sprites
    collectibles.forEach((c) => {
      if (c.collected) return;

      const posX = c.position.x * CELL_SIZE;
      const posY = c.position.y * CELL_SIZE;
      const spriteSize = CELL_SIZE * 1.2; // Slightly larger than cell
      const offsetX = posX - (spriteSize - CELL_SIZE) / 2;
      const offsetY = posY - (spriteSize - CELL_SIZE) / 2;

      if (c.type === "computer") {
        const img = c.damaged ? sprites.computerDamaged : sprites.computer;
        if (img) ctx.drawImage(img, offsetX, offsetY, spriteSize, spriteSize);
      } else if (c.type === "wall") {
        const img = c.damaged ? sprites.whiteboardPainted : sprites.whiteboard;
        if (img) ctx.drawImage(img, offsetX, offsetY, spriteSize, spriteSize);
      } else if (c.type === "coworker") {
        const img = c.damaged ? sprites.coworkerPied : sprites.coworker;
        if (img) ctx.drawImage(img, offsetX, offsetY, spriteSize, spriteSize);
      } else if (c.type === "coffee") {
        if (sprites.coffee) ctx.drawImage(sprites.coffee, offsetX, offsetY, spriteSize, spriteSize);
      } else if (c.type === "coin") {
        if (sprites.coin) {
          // Make coin slightly smaller and animated
          const coinSize = CELL_SIZE * 0.8;
          const coinOffset = (CELL_SIZE - coinSize) / 2;
          ctx.drawImage(sprites.coin, posX + coinOffset, posY + coinOffset, coinSize, coinSize);
        }
      }
    });

    // Draw executives with vision cones using sprites
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

      // Draw executive sprite
      const posX = exec.position.x * CELL_SIZE;
      const posY = exec.position.y * CELL_SIZE;
      const spriteSize = CELL_SIZE * 1.4;
      const offsetX = posX - (spriteSize - CELL_SIZE) / 2;
      const offsetY = posY - (spriteSize - CELL_SIZE) / 2;

      const img = exec.isScared ? sprites.executiveScared : sprites.executive;
      if (img) ctx.drawImage(img, offsetX, offsetY, spriteSize, spriteSize);

      // Speech bubble with neon arcade style
      if (!exec.isScared) {
        ctx.save();
        // Dark background with neon border
        ctx.fillStyle = "rgba(10, 10, 26, 0.95)";
        ctx.fillRect(posX - 20, posY - 35, 80, 20);
        ctx.strokeStyle = exec.color;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = exec.color;
        ctx.strokeRect(posX - 20, posY - 35, 80, 20);
        ctx.shadowBlur = 0;
        // Neon text
        ctx.fillStyle = exec.color;
        ctx.font = "8px 'Press Start 2P'";
        ctx.textAlign = "center";
        ctx.fillText(exec.speech, posX + 20, posY - 22);
        ctx.restore();
      }
    });

    // Draw player sprite
    const posX = player.x * CELL_SIZE;
    const posY = player.y * CELL_SIZE;
    const spriteSize = CELL_SIZE * 1.4;
    const offsetX = posX - (spriteSize - CELL_SIZE) / 2;
    const offsetY = posY - (spriteSize - CELL_SIZE) / 2;

    ctx.save();

    // Invincibility effect - flashing
    if (invincibilityTimer > 0) {
      if (Math.floor(invincibilityTimer / 10) % 2 === 0) {
        ctx.globalAlpha = 0.5;
      }
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#00ffff";
    }

    // Speed boost glow
    if (speedBoost > 0) {
      ctx.shadowBlur = 25;
      ctx.shadowColor = "#FFD700";
    }

    if (sprites.player) {
      ctx.drawImage(sprites.player, offsetX, offsetY, spriteSize, spriteSize);
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }, [player, executives, collectibles, speedBoost, invincibilityTimer, sprites]);

  return (
    <canvas
      ref={canvasRef}
      width={MAZE_WIDTH * CELL_SIZE}
      height={MAZE_HEIGHT * CELL_SIZE}
      className="w-full h-auto arcade-glow"
      style={{ background: "#0a0a1a", border: "3px solid #ff00ff", boxShadow: "0 0 20px #ff00ff" }}
    />
  );
};
