import coffeeSprite from "@/assets/coffee-sprite.png";
import coinSprite from "@/assets/coin-sprite.png";
import computerDamagedSprite from "@/assets/computer-damaged-sprite.png";
import computerSprite from "@/assets/computer-sprite.png";
import coworkerPiedSprite from "@/assets/coworker-pied-sprite.png";
import coworkerSprite from "@/assets/coworker-sprite.png";
import executiveScaredSprite from "@/assets/executive-scared-sprite.png";
import executiveSprite from "@/assets/executive-sprite.png";
import playerSprite from "@/assets/player-sprite.png";
import whiteboardPaintedSprite from "@/assets/whiteboard-painted-sprite.png";
import whiteboardSprite from "@/assets/whiteboard-sprite.png";
import { useCallback, useEffect, useRef, useState } from "react";
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
}

interface Collectible {
  position: Position;
  type: "computer" | "wall" | "coworker" | "coffee" | "coin";
  collected: boolean;
  damaged?: boolean; // For computers, walls, coworkers - shows modified state
  value?: number;
  expireTimer?: number; // For coins: timer until they disappear (in frames, 60fps)
  animationStartPos?: Position; // For coins: starting position for bounce animation
  animationProgress?: number; // For coins: animation progress 0-1
  damageTimer?: number; // For damaged items: timer until they disappear (in frames, 60fps)
  collectAnimationProgress?: number; // For coins: pop-up animation after collection
}

const CELL_SIZE = 20;
const MAZE_WIDTH = 40;
const MAZE_HEIGHT = 24;
const VISION_DISTANCE = 6; // Reduced vision range
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
  togglePause,
}: {
  gameState: GameState;
  updateScore: (points: number) => void;
  loseLife: () => void;
  togglePause: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Define player spawn position first - this will be excluded from wall generation
  const PLAYER_SPAWN_X = MAZE_WIDTH / 2; // center of the maze
  const PLAYER_SPAWN_Y = MAZE_HEIGHT / 2; // center of the maze
  const [player, setPlayer] = useState<Position>({
    x: PLAYER_SPAWN_X,
    y: PLAYER_SPAWN_Y,
  }); // Start in center
  const [playerDirection, setPlayerDirection] = useState<Position>({
    x: 0,
    y: 0,
  });
  const [speedBoost, setSpeedBoost] = useState(0);
  const [invincibilityTimer, setInvincibilityTimer] = useState(0);
  const [catchCooldown, setCatchCooldown] = useState(0);
  const [executiveDropTimer, setExecutiveDropTimer] = useState(180); // 3 seconds at 60fps
  const MAX_DROPPED_ITEMS = 15; // Maximum number of items (coffee, wall, computer) that can exist at once
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

  // Helper function to check if a position should be excluded (player spawn row/column)
  const isPlayerSpawnArea = (x: number, y: number) => {
    return x === PLAYER_SPAWN_X || y === PLAYER_SPAWN_Y;
  };

  // Maze walls - generated after player spawn is defined
  const [maze] = useState<boolean[][]>(() => {
    const m = Array(MAZE_HEIGHT)
      .fill(0)
      .map(() => Array(MAZE_WIDTH).fill(false));

    // Outer walls (but exclude player spawn row/column)
    for (let x = 0; x < MAZE_WIDTH; x++) {
      if (!isPlayerSpawnArea(x, 0)) {
        m[0][x] = true;
      }
      if (!isPlayerSpawnArea(x, MAZE_HEIGHT - 1)) {
        m[MAZE_HEIGHT - 1][x] = true;
      }
    }
    for (let y = 0; y < MAZE_HEIGHT; y++) {
      if (!isPlayerSpawnArea(0, y)) {
        m[y][0] = true;
      }
      if (!isPlayerSpawnArea(MAZE_WIDTH - 1, y)) {
        m[y][MAZE_WIDTH - 1] = true;
      }
    }

    // Internal maze walls
    // To keep the maze less dense while using a higher-resolution grid,
    // we generate a "coarse" maze at half resolution and then scale it up.
    // This guarantees that all corridors are at least 2 blocks wide.
    const COARSE_WIDTH = MAZE_WIDTH / 2;
    const COARSE_HEIGHT = MAZE_HEIGHT / 2;
    const coarse: boolean[][] = Array(COARSE_HEIGHT)
      .fill(0)
      .map(() => Array(COARSE_WIDTH).fill(false));

    const spawnCoarseX = PLAYER_SPAWN_X / 2;
    const spawnCoarseY = PLAYER_SPAWN_Y / 2;
    const isSpawnAreaCoarse = (x: number, y: number) => {
      return x === spawnCoarseX || y === spawnCoarseY;
    };

    // Outer walls on coarse grid
    for (let x = 0; x < COARSE_WIDTH; x++) {
      if (!isSpawnAreaCoarse(x, 0)) {
        coarse[0][x] = true;
      }
      if (!isSpawnAreaCoarse(x, COARSE_HEIGHT - 1)) {
        coarse[COARSE_HEIGHT - 1][x] = true;
      }
    }
    for (let y = 0; y < COARSE_HEIGHT; y++) {
      if (!isSpawnAreaCoarse(0, y)) {
        coarse[y][0] = true;
      }
      if (!isSpawnAreaCoarse(COARSE_WIDTH - 1, y)) {
        coarse[y][COARSE_WIDTH - 1] = true;
      }
    }

    // Coarse internal walls (same pattern as original smaller maze, but sparser)
    // Vertical walls on coarse grid
    for (let y = 2; y < COARSE_HEIGHT - 2; y += 3) {
      for (let x = 3; x < COARSE_WIDTH - 3; x += 4) {
        if (!isSpawnAreaCoarse(x, y)) {
          coarse[y][x] = true;
        }
        if (!isSpawnAreaCoarse(x, y + 1) && Math.random() > 0.3) {
          coarse[y + 1][x] = true;
        }
      }
    }

    // Horizontal walls on coarse grid
    for (let x = 2; x < COARSE_WIDTH - 2; x += 3) {
      for (let y = 4; y < COARSE_HEIGHT - 4; y += 4) {
        if (!isSpawnAreaCoarse(x, y)) {
          coarse[y][x] = true;
        }
        if (!isSpawnAreaCoarse(x + 1, y) && Math.random() > 0.3) {
          coarse[y][x + 1] = true;
        }
      }
    }

    // Coarse room-like structures
    const rooms = [
      { x: 5, y: 4, w: 3, h: 2 },
      { x: 13, y: 2, w: 4, h: 2 },
      { x: 3, y: 9, w: 3, h: 2 },
      { x: 14, y: 9, w: 4, h: 2 },
    ];

    rooms.forEach((room) => {
      const overlapsSpawnRow =
        room.y <= spawnCoarseY && room.y + room.h > spawnCoarseY;
      const overlapsSpawnCol =
        room.x <= spawnCoarseX && room.x + room.w > spawnCoarseX;

      if (!overlapsSpawnRow && !overlapsSpawnCol) {
        for (let x = room.x; x < room.x + room.w; x++) {
          coarse[room.y][x] = true;
          coarse[room.y + room.h - 1][x] = true;
        }
        for (let y = room.y; y < room.y + room.h; y++) {
          coarse[y][room.x] = true;
          coarse[y][room.x + room.w - 1] = true;
        }
        // Add door
        coarse[room.y + Math.floor(room.h / 2)][room.x] = false;
      }
    });

    // Scale coarse maze to fine grid: each coarse wall becomes a 2x2 block.
    for (let cy = 0; cy < COARSE_HEIGHT; cy++) {
      for (let cx = 0; cx < COARSE_WIDTH; cx++) {
        if (!coarse[cy][cx]) continue;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const fx = cx * 2 + dx;
            const fy = cy * 2 + dy;
            if (
              fx >= 0 &&
              fx < MAZE_WIDTH &&
              fy >= 0 &&
              fy < MAZE_HEIGHT &&
              !isPlayerSpawnArea(fx, fy)
            ) {
              m[fy][fx] = true;
            }
          }
        }
      }
    }

    // Ensure player spawn position itself is never a wall
    m[PLAYER_SPAWN_Y][PLAYER_SPAWN_X] = false;

    return m;
  });

  const [executives, setExecutives] = useState<Executive[]>(() => {
    // Helper to check if an executive sprite (2x2 blocks) is walkable
    const isWalkable = (x: number, y: number) => {
      const SPRITE_LEFT_OFFSET = 0.5;
      const SPRITE_RIGHT_OFFSET = 1.5;
      const SPRITE_TOP_OFFSET = 0.5;
      const SPRITE_BOTTOM_OFFSET = 1.5;

      const leftBound = x - SPRITE_LEFT_OFFSET;
      const rightBound = x + SPRITE_RIGHT_OFFSET;
      const topBound = y - SPRITE_TOP_OFFSET;
      const bottomBound = y + SPRITE_BOTTOM_OFFSET;

      const minGridX = Math.max(0, Math.floor(leftBound));
      const maxGridX = Math.min(MAZE_WIDTH - 1, Math.floor(rightBound));
      const minGridY = Math.max(0, Math.floor(topBound));
      const maxGridY = Math.min(MAZE_HEIGHT - 1, Math.floor(bottomBound));

      for (let gy = minGridY; gy <= maxGridY; gy++) {
        for (let gx = minGridX; gx <= maxGridX; gx++) {
          if (maze[gy][gx] || isPlayerSpawnArea(gx, gy)) {
            return false;
          }
        }
      }
      return true;
    };

    // Find safe positions in corners/edges for executives
    const findSafePosition = (
      preferredX: number,
      preferredY: number
    ): Position => {
      // Try preferred position first
      if (isWalkable(preferredX, preferredY)) {
        return { x: preferredX, y: preferredY };
      }

      // Try nearby positions in a spiral pattern
      for (let radius = 1; radius < 5; radius++) {
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dy = -radius; dy <= radius; dy++) {
            if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
              const x = preferredX + dx;
              const y = preferredY + dy;
              if (isWalkable(x, y)) {
                return { x, y };
              }
            }
          }
        }
      }

      // Fallback: find any walkable position
      for (let y = 1; y < MAZE_HEIGHT - 1; y++) {
        for (let x = 1; x < MAZE_WIDTH - 1; x++) {
          if (isWalkable(x, y)) {
            return { x, y };
          }
        }
      }

      // Last resort: return preferred position (shouldn't happen)
      return { x: preferredX, y: preferredY };
    };

    return [
      {
        position: findSafePosition(2, 2),
        direction: { x: 1, y: 0 },
        isScared: false,
        scaredTimer: 0,
        color: "#FF1493",
        name: "Boomer Bob",
      },
      {
        position: findSafePosition(MAZE_WIDTH - 3, 2),
        direction: { x: 0, y: 1 },
        isScared: false,
        scaredTimer: 0,
        color: "#FFD700",
        name: "Nostalgic Ned",
      },
      {
        position: findSafePosition(2, MAZE_HEIGHT - 3),
        direction: { x: 0, y: -1 },
        isScared: false,
        scaredTimer: 0,
        color: "#00FF00",
        name: "Traditional Tom",
      },
      {
        position: findSafePosition(MAZE_WIDTH - 3, MAZE_HEIGHT - 3),
        direction: { x: -1, y: 0 },
        isScared: false,
        scaredTimer: 0,
        color: "#00FFFF",
        name: "Grumpy Greg",
      },
    ];
  });

  const [collectibles, setCollectibles] = useState<Collectible[]>(() => {
    const items: Collectible[] = [];
    // Helper to check if a static collectible sprite (2x2 blocks) is clear of walls
    // AND does not overlap any existing non-coin collectibles.
    const isWalkable = (x: number, y: number) => {
      const SPRITE_LEFT_OFFSET = 0.5;
      const SPRITE_RIGHT_OFFSET = 1.5;
      const SPRITE_TOP_OFFSET = 0.5;
      const SPRITE_BOTTOM_OFFSET = 1.5;

      const leftA = x - SPRITE_LEFT_OFFSET;
      const rightA = x + SPRITE_RIGHT_OFFSET;
      const topA = y - SPRITE_TOP_OFFSET;
      const bottomA = y + SPRITE_BOTTOM_OFFSET;

      const minGridX = Math.max(0, Math.floor(leftA));
      const maxGridX = Math.min(MAZE_WIDTH - 1, Math.floor(rightA));
      const minGridY = Math.max(0, Math.floor(topA));
      const maxGridY = Math.min(MAZE_HEIGHT - 1, Math.floor(bottomA));

      // Check walls
      for (let gy = minGridY; gy <= maxGridY; gy++) {
        for (let gx = minGridX; gx <= maxGridX; gx++) {
          if (maze[gy][gx]) {
            return false;
          }
        }
      }

      // Check overlap with already-placed non-coin collectibles
      for (const other of items) {
        if (
          other.type === "coin" ||
          other.type === "coffee" ||
          other.collected
        ) {
          continue;
        }
        const ox = other.position.x;
        const oy = other.position.y;
        const leftB = ox - SPRITE_LEFT_OFFSET;
        const rightB = ox + SPRITE_RIGHT_OFFSET;
        const topB = oy - SPRITE_TOP_OFFSET;
        const bottomB = oy + SPRITE_BOTTOM_OFFSET;

        const overlapX = leftA < rightB && rightA > leftB;
        const overlapY = topA < bottomB && bottomA > topB;
        if (overlapX && overlapY) {
          return false;
        }
      }

      return true;
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

  const collectiblesRef = useRef<Collectible[]>([]);
  const executivesRef = useRef<Executive[]>([]);
  const playerRef = useRef<Position>({ x: PLAYER_SPAWN_X, y: PLAYER_SPAWN_Y });
  const togglePauseRef = useRef(togglePause);
  const handleActionRef = useRef<() => void>();

  // Keep refs in sync with state and props
  useEffect(() => {
    collectiblesRef.current = collectibles;
  }, [collectibles]);

  useEffect(() => {
    executivesRef.current = executives;
  }, [executives]);

  useEffect(() => {
    playerRef.current = player;
  }, [player]);

  useEffect(() => {
    togglePauseRef.current = togglePause;
    console.log(
      "togglePauseRef updated, function exists:",
      typeof togglePause === "function"
    );
  }, [togglePause]);

  const handleAction = useCallback(() => {
    // Check for nearby collectibles (damage/modify instead of destroy -> spawn a coin)
    const currentCollectibles = collectiblesRef.current;
    const currentPlayer = playerRef.current;

    const nearby = currentCollectibles.find(
      (c) =>
        !c.collected &&
        !c.damaged &&
        c.type !== "coin" &&
        Math.abs(c.position.x - currentPlayer.x) <= 1 &&
        Math.abs(c.position.y - currentPlayer.y) <= 1
    );

    if (nearby) {
      let coinValue = 1;
      let sound: string | null = null;

      if (nearby.type === "computer") {
        coinValue = 1;
        sound = "destroy";
      } else if (nearby.type === "wall") {
        coinValue = 1;
        sound = "graffiti";
      } else if (nearby.type === "coworker") {
        coinValue = 1;
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

      // Damage the item (keep it visible but modified) and spawn 3 coins on nearby tiles
      setCollectibles((prev) => {
        // Set different timers: computers and whiteboards disappear after 3 seconds, coworkers revert after 5 seconds
        const timer = nearby.type === "coworker" ? 300 : 180; // 5 seconds for coworkers, 3 seconds for others
        const updated = prev.map((c) =>
          c === nearby ? { ...c, damaged: true, damageTimer: timer } : c
        );

        // Find 3 random nearby walkable positions (coins jump away from the item)
        const findNearbyWalkablePositions = (
          centerX: number,
          centerY: number,
          count: number
        ): Position[] => {
          const positions: Position[] = [];
          const checked = new Set<string>();
          const isWalkable = (x: number, y: number) => {
            const gridX = Math.floor(x);
            const gridY = Math.floor(y);
            const key = `${gridX},${gridY}`;
            if (checked.has(key)) return false;
            checked.add(key);
            return (
              gridX >= 0 &&
              gridX < MAZE_WIDTH &&
              gridY >= 0 &&
              gridY < MAZE_HEIGHT &&
              !maze[gridY]?.[gridX] &&
              // Check that no other collectible is already at this position
              !prev.some(
                (c) =>
                  !c.collected &&
                  c.position.x === gridX &&
                  c.position.y === gridY
              )
            );
          };

          // Try positions in a wider 5x5 area around the center (jump twice as far)
          const candidates: Position[] = [];
          for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
              const x = Math.floor(centerX) + dx;
              const y = Math.floor(centerY) + dy;
              if (isWalkable(x, y)) {
                candidates.push({ x, y });
              }
            }
          }

          // Shuffle and take up to count positions
          const shuffled = candidates.sort(() => Math.random() - 0.5);
          return shuffled.slice(0, Math.min(count, shuffled.length));
        };

        const coinPositions = findNearbyWalkablePositions(
          nearby.position.x,
          nearby.position.y,
          3
        );

        // Create 3 coins with expire timers and bounce animation
        const startPos = { x: nearby.position.x, y: nearby.position.y };
        const newCoins = coinPositions.map((pos) => ({
          position: pos, // Final position
          type: "coin" as const,
          collected: false,
          value: coinValue,
          expireTimer: 180, // 3 seconds at 60fps
          animationStartPos: startPos, // Start animation from destroyed item position
          animationProgress: 0, // Start at 0, will animate to 1
        }));

        return [...updated, ...newCoins];
      });
    }

    // Check for nearby executives to put kick-me sign
    setExecutives((prev) => {
      const scaredExecutives: Executive[] = [];
      const updated = prev.map((exec) => {
        if (
          !exec.isScared &&
          Math.abs(exec.position.x - currentPlayer.x) <= 1 &&
          Math.abs(exec.position.y - currentPlayer.y) <= 1
        ) {
          playSound("kickme");
          scaredExecutives.push(exec); // Track which executives just got scared
          return { ...exec, isScared: true, scaredTimer: SCARED_DURATION };
        }
        return exec;
      });

      // Spawn 10 coins for each executive that just got scared
      if (scaredExecutives.length > 0) {
        scaredExecutives.forEach((exec) => {
          // Find nearby walkable positions for coins
          const findNearbyWalkablePositions = (
            centerX: number,
            centerY: number,
            count: number
          ): Position[] => {
            const positions: Position[] = [];
            const checked = new Set<string>();
            const isWalkable = (x: number, y: number) => {
              const gridX = Math.floor(x);
              const gridY = Math.floor(y);
              const key = `${gridX},${gridY}`;
              if (checked.has(key)) return false;
              checked.add(key);
              return (
                gridX >= 0 &&
                gridX < MAZE_WIDTH &&
                gridY >= 0 &&
                gridY < MAZE_HEIGHT &&
                !maze[gridY]?.[gridX] &&
                // Check that no other collectible is already at this position
                !currentCollectibles.some(
                  (c) =>
                    !c.collected &&
                    c.position.x === gridX &&
                    c.position.y === gridY
                )
              );
            };

            // Try positions in a larger area (5x5) around the executive for 10 coins
            const candidates: Position[] = [];
            for (let dy = -2; dy <= 2; dy++) {
              for (let dx = -2; dx <= 2; dx++) {
                const x = Math.floor(centerX) + dx;
                const y = Math.floor(centerY) + dy;
                if (isWalkable(x, y)) {
                  candidates.push({ x, y });
                }
              }
            }

            // Shuffle and take up to count positions
            const shuffled = candidates.sort(() => Math.random() - 0.5);
            return shuffled.slice(0, Math.min(count, shuffled.length));
          };

          const coinPositions = findNearbyWalkablePositions(
            exec.position.x,
            exec.position.y,
            10
          );

          // Create 10 coins with expire timers and bounce animation
          const startPos = { x: exec.position.x, y: exec.position.y };
          const newCoins = coinPositions.map((pos) => ({
            position: pos, // Final position
            type: "coin" as const,
            collected: false,
            value: 1,
            expireTimer: 180, // 3 seconds at 60fps
            animationStartPos: startPos, // Start animation from executive position
            animationProgress: 0, // Start at 0, will animate to 1
          }));

          // Add the coins to collectibles
          setCollectibles((prev) => [...prev, ...newCoins]);
        });
      }

      return updated;
    });
  }, []);

  // Store handleAction in ref
  useEffect(() => {
    handleActionRef.current = handleAction;
  }, [handleAction]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Handle space bar separately (before adding to keysPressed)
      if (e.key === " " || key === " ") {
        e.preventDefault();
        e.stopPropagation();
        console.log(
          "Space bar pressed, togglePauseRef.current:",
          togglePauseRef.current
        );
        if (togglePauseRef.current) {
          console.log("Calling togglePause");
          togglePauseRef.current();
        } else {
          console.error("togglePauseRef.current is null/undefined!");
        }
        return; // Don't add space to keysPressed
      }

      keysPressed.current.add(key);

      if (key === "p") {
        handleActionRef.current?.();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysPressed.current.delete(key);
    };

    // Try both window and document to ensure we capture events
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("keyup", handleKeyUp, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("keyup", handleKeyUp, true);
    };
  }, []); // Empty dependency array - listener never re-registers

  // Safety check: ensure player starts on a walkable tile (shouldn't be needed now, but kept as safety)
  useEffect(() => {
    const gx = Math.floor(player.x);
    const gy = Math.floor(player.y);
    if (maze[gy]?.[gx]) {
      // If somehow player is in a wall, reset to spawn position
      setPlayer({ x: PLAYER_SPAWN_X, y: PLAYER_SPAWN_Y });
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
          // Match collision box to the drawn player sprite (green debug rectangle).
          // Sprite is 2x2 blocks and centered on the player position:
          // it extends 0.5 blocks to the left/top and 1.5 blocks to the right/bottom.
          const SPRITE_LEFT_OFFSET = 0.5;
          const SPRITE_RIGHT_OFFSET = 1.5;
          const SPRITE_TOP_OFFSET = 0.5;
          const SPRITE_BOTTOM_OFFSET = 1.5;

          // Check if the sprite at this position would overlap any walls
          const canMoveTo = (x: number, y: number) => {
            const leftBound = x - SPRITE_LEFT_OFFSET;
            const rightBound = x + SPRITE_RIGHT_OFFSET;
            const topBound = y - SPRITE_TOP_OFFSET;
            const bottomBound = y + SPRITE_BOTTOM_OFFSET;

            const minGridX = Math.max(0, Math.floor(leftBound));
            const maxGridX = Math.min(MAZE_WIDTH - 1, Math.floor(rightBound));
            const minGridY = Math.max(0, Math.floor(topBound));
            const maxGridY = Math.min(MAZE_HEIGHT - 1, Math.floor(bottomBound));

            for (let gy = minGridY; gy <= maxGridY; gy++) {
              for (let gx = minGridX; gx <= maxGridX; gx++) {
                if (maze[gy]?.[gx]) {
                  // Would overlap a wall tile (yellow boundary)
                  return false;
                }
              }
            }

            return true;
          };

          let newX = prev.x;
          let newY = prev.y;

          // Try horizontal movement
          if (dx !== 0) {
            const testX = prev.x + dx;
            // Keep sprite fully inside maze bounds
            if (
              testX >= SPRITE_LEFT_OFFSET &&
              testX <= MAZE_WIDTH - SPRITE_RIGHT_OFFSET &&
              canMoveTo(testX, prev.y)
            ) {
              newX = testX;
            }
          }

          // Try vertical movement
          if (dy !== 0) {
            const testY = prev.y + dy;
            // Keep sprite fully inside maze bounds
            if (
              testY >= SPRITE_TOP_OFFSET &&
              testY <= MAZE_HEIGHT - SPRITE_BOTTOM_OFFSET &&
              canMoveTo(newX, testY)
            ) {
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
          // Collision helper: match executive sprite (2x2 blocks, centered)
          const SPRITE_LEFT_OFFSET = 0.5;
          const SPRITE_RIGHT_OFFSET = 1.5;
          const SPRITE_TOP_OFFSET = 0.5;
          const SPRITE_BOTTOM_OFFSET = 1.5;

          const canExecMoveTo = (x: number, y: number) => {
            const leftBound = x - SPRITE_LEFT_OFFSET;
            const rightBound = x + SPRITE_RIGHT_OFFSET;
            const topBound = y - SPRITE_TOP_OFFSET;
            const bottomBound = y + SPRITE_BOTTOM_OFFSET;

            const minGridX = Math.max(0, Math.floor(leftBound));
            const maxGridX = Math.min(MAZE_WIDTH - 1, Math.floor(rightBound));
            const minGridY = Math.max(0, Math.floor(topBound));
            const maxGridY = Math.min(MAZE_HEIGHT - 1, Math.floor(bottomBound));

            for (let gy = minGridY; gy <= maxGridY; gy++) {
              for (let gx = minGridX; gx <= maxGridX; gx++) {
                if (maze[gy]?.[gx]) {
                  return false;
                }
              }
            }
            return true;
          };

          if (exec.scaredTimer > 0) {
            // Move away from player when scared
            const dx = exec.position.x - player.x;
            const dy = exec.position.y - player.y;
            const moveX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
            const moveY = dy > 0 ? 1 : dy < 0 ? -1 : 0;

            const targetX = exec.position.x + moveX;
            const targetY = exec.position.y + moveY;

            const newPos = canExecMoveTo(targetX, targetY)
              ? {
                  x: Math.max(
                    SPRITE_LEFT_OFFSET,
                    Math.min(MAZE_WIDTH - SPRITE_RIGHT_OFFSET, targetX)
                  ),
                  y: Math.max(
                    SPRITE_TOP_OFFSET,
                    Math.min(MAZE_HEIGHT - SPRITE_BOTTOM_OFFSET, targetY)
                  ),
                }
              : exec.position;

            return {
              ...exec,
              position: newPos,
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
              exec.direction =
                directions[Math.floor(Math.random() * directions.length)];
            }

            const step = 0.5;
            const candidateDirs = [
              exec.direction,
              // Perpendicular alternatives
              exec.direction.x !== 0 ? { x: 0, y: 1 } : { x: 1, y: 0 },
              exec.direction.x !== 0 ? { x: 0, y: -1 } : { x: -1, y: 0 },
              // Opposite direction as last resort
              { x: -exec.direction.x, y: -exec.direction.y },
            ];

            for (const dir of candidateDirs) {
              const newX = exec.position.x + dir.x * step;
              const newY = exec.position.y + dir.y * step;
              if (
                newX >= SPRITE_LEFT_OFFSET &&
                newX <= MAZE_WIDTH - SPRITE_RIGHT_OFFSET &&
                newY >= SPRITE_TOP_OFFSET &&
                newY <= MAZE_HEIGHT - SPRITE_BOTTOM_OFFSET &&
                canExecMoveTo(newX, newY)
              ) {
                return {
                  ...exec,
                  position: { x: newX, y: newY },
                  direction: dir,
                };
              }
            }
          }

          return exec;
        })
      );

      // Update coin expiration timers and bounce / collect animations
      setCollectibles((prev) => {
        return prev.map((c) => {
          if (c.type !== "coin") return c;

          let updated = { ...c };

          // Handle coins that have not been collected yet
          if (!c.collected) {
            // Update expiration timer
            if (c.expireTimer !== undefined) {
              const newTimer = c.expireTimer - 1;
              if (newTimer <= 0) {
                // Coin expired, mark as collected to remove it
                return { ...updated, collected: true };
              }
              updated = { ...updated, expireTimer: newTimer };
            }

            // Update bounce animation progress (animate over 30 frames = 0.5 seconds)
            if (c.animationProgress !== undefined && c.animationProgress < 1) {
              const newProgress = Math.min(1, c.animationProgress + 1 / 30);
              updated = { ...updated, animationProgress: newProgress };
              // Remove bounce properties once complete
              if (newProgress >= 1) {
                const { animationStartPos, animationProgress, ...rest } =
                  updated;
                updated = { ...rest };
              }
            }

            return updated;
          }

          // Handle collected coins with pop-up animation
          if (
            c.collectAnimationProgress !== undefined &&
            c.collectAnimationProgress < 1
          ) {
            const newProgress = Math.min(
              1,
              c.collectAnimationProgress + 1 / 10
            ); // ~0.5s pop
            updated = { ...updated, collectAnimationProgress: newProgress };
            if (newProgress >= 1) {
              // Remove pop animation properties; coin will no longer be drawn
              const { collectAnimationProgress, ...rest } = updated;
              return rest;
            }
            return updated;
          }

          return updated;
        });
      });

      // Update damaged item timers and remove expired items
      setCollectibles((prev) => {
        return prev.map((c) => {
          if (c.damaged && !c.collected && c.damageTimer !== undefined) {
            const newTimer = c.damageTimer - 1;
            if (newTimer <= 0) {
              // Item expired
              if (c.type === "coworker") {
                // Coworkers revert back to normal instead of disappearing
                const { damaged, damageTimer, ...rest } = c;
                return rest;
              } else {
                // Computers and whiteboards disappear
                return { ...c, collected: true };
              }
            }
            return { ...c, damageTimer: newTimer };
          }
          return c;
        });
      });

      // Executive drop timer - spawn items every 3 seconds
      setExecutiveDropTimer((prev) => {
        if (prev <= 0) {
          // Time to drop an item - select random executive
          const currentExecutives = executivesRef.current;
          const currentCollectibles = collectiblesRef.current;
          const activeExecutives = currentExecutives.filter(
            (exec) => !exec.isScared
          );

          // Count existing dropped items (coffee, wall, computer) - exclude coins and damaged items that will disappear
          const droppedItemCount = currentCollectibles.filter(
            (c) =>
              !c.collected &&
              (c.type === "coffee" ||
                c.type === "wall" ||
                c.type === "computer")
          ).length;

          // Only spawn if we're under the maximum limit
          if (
            activeExecutives.length > 0 &&
            droppedItemCount < MAX_DROPPED_ITEMS
          ) {
            const randomExecutive =
              activeExecutives[
                Math.floor(Math.random() * activeExecutives.length)
              ];

            // Find a walkable position near the executive
            const findNearbyWalkablePosition = (
              centerX: number,
              centerY: number
            ): Position | null => {
              const checked = new Set<string>();
              const isWalkable = (x: number, y: number) => {
                const SPRITE_LEFT_OFFSET = 0.5;
                const SPRITE_RIGHT_OFFSET = 1.5;
                const SPRITE_TOP_OFFSET = 0.5;
                const SPRITE_BOTTOM_OFFSET = 1.5;

                const gridX = Math.floor(x);
                const gridY = Math.floor(y);
                const key = `${gridX},${gridY}`;
                if (checked.has(key)) return false;
                checked.add(key);

                // First, must be inside bounds and not a wall
                if (
                  gridX < 0 ||
                  gridX >= MAZE_WIDTH ||
                  gridY < 0 ||
                  gridY >= MAZE_HEIGHT ||
                  maze[gridY]?.[gridX]
                ) {
                  return false;
                }

                // Now ensure the 2x2 sprite at this position doesn't overlap
                // any existing non-coin collectibles
                const leftA = x - SPRITE_LEFT_OFFSET;
                const rightA = x + SPRITE_RIGHT_OFFSET;
                const topA = y - SPRITE_TOP_OFFSET;
                const bottomA = y + SPRITE_BOTTOM_OFFSET;

                for (const c of currentCollectibles) {
                  if (c.collected || c.type === "coin" || c.type === "coffee") {
                    continue;
                  }
                  const ox = c.position.x;
                  const oy = c.position.y;
                  const leftB = ox - SPRITE_LEFT_OFFSET;
                  const rightB = ox + SPRITE_RIGHT_OFFSET;
                  const topB = oy - SPRITE_TOP_OFFSET;
                  const bottomB = oy + SPRITE_BOTTOM_OFFSET;

                  const overlapX = leftA < rightB && rightA > leftB;
                  const overlapY = topA < bottomB && bottomA > topB;
                  if (overlapX && overlapY) {
                    return false;
                  }
                }

                return true;
              };

              // Try positions in a 3x3 area around the executive
              const candidates: Position[] = [];
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  const x = Math.floor(centerX) + dx;
                  const y = Math.floor(centerY) + dy;
                  if (isWalkable(x, y)) {
                    candidates.push({ x, y });
                  }
                }
              }

              // Check that no other collectible is already at this position
              const availablePositions = candidates.filter((pos) => {
                return !currentCollectibles.some(
                  (c) =>
                    !c.collected &&
                    c.position.x === pos.x &&
                    c.position.y === pos.y
                );
              });

              if (availablePositions.length > 0) {
                // Return a random available position
                return availablePositions[
                  Math.floor(Math.random() * availablePositions.length)
                ];
              }
              return null;
            };

            const dropPosition = findNearbyWalkablePosition(
              randomExecutive.position.x,
              randomExecutive.position.y
            );

            if (dropPosition) {
              // Randomly select item type: coffee, whiteboard, or computer
              const itemTypes: ("coffee" | "wall" | "computer")[] = [
                "coffee",
                "wall",
                "computer",
              ];
              const randomItemType =
                itemTypes[Math.floor(Math.random() * itemTypes.length)];

              // Add the new collectible
              setCollectibles((prev) => [
                ...prev,
                {
                  position: dropPosition,
                  type: randomItemType,
                  collected: false,
                },
              ]);
            }
          }
          // Reset timer to 180 frames (3 seconds)
          return 180;
        }
        return prev - 1;
      });

      // Collect coins when they touch the player's bounding box (green rectangle)
      // but only after they have finished their bounce animation (landed).
      setCollectibles((prev) =>
        prev.map((c) => {
          if (c.type !== "coin" || c.collected) return c;

          // Skip coins that are still bouncing toward their landing tile
          if (c.animationProgress !== undefined && c.animationProgress < 1) {
            return c;
          }

          // Player sprite: 2x2 blocks, centered on player position
          const PLAYER_LEFT_OFFSET = 0.5;
          const PLAYER_RIGHT_OFFSET = 1.5;
          const PLAYER_TOP_OFFSET = 0.5;
          const PLAYER_BOTTOM_OFFSET = 1.5;

          const playerLeft = player.x - PLAYER_LEFT_OFFSET;
          const playerRight = player.x + PLAYER_RIGHT_OFFSET;
          const playerTop = player.y - PLAYER_TOP_OFFSET;
          const playerBottom = player.y + PLAYER_BOTTOM_OFFSET;

          // Coin sprite: ~1.6x1.6 blocks, centered on its cell
          const COIN_HALF_SIZE = 0.8; // 1.6 / 2
          const coinCenterX = c.position.x + 0.5;
          const coinCenterY = c.position.y + 0.5;
          const coinLeft = coinCenterX - COIN_HALF_SIZE;
          const coinRight = coinCenterX + COIN_HALF_SIZE;
          const coinTop = coinCenterY - COIN_HALF_SIZE;
          const coinBottom = coinCenterY + COIN_HALF_SIZE;

          const overlapX = playerLeft < coinRight && playerRight > coinLeft;
          const overlapY = playerTop < coinBottom && playerBottom > coinTop;

          if (overlapX && overlapY) {
            updateScore(c.value ?? 1);
            playSound("coin");
            return {
              ...c,
              collected: true,
              collectAnimationProgress: 0, // start pop-up animation
              expireTimer: undefined,
            };
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
            if (
              checkX >= 0 &&
              checkX < MAZE_WIDTH &&
              checkY >= 0 &&
              checkY < MAZE_HEIGHT
            ) {
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
              // Helper to check if a position is safe (walkable and far from executives)
              const isSafePosition = (x: number, y: number) => {
                // Check if walkable (not a wall)
                if (maze[y]?.[x]) return false;

                // Check distance from all executives
                for (const e of executives) {
                  const dist = Math.sqrt(
                    (e.position.x - x) ** 2 + (e.position.y - y) ** 2
                  );
                  if (dist < 6) {
                    return false;
                  }
                }
                return true;
              };

              // First, try the original spawn position
              if (isSafePosition(PLAYER_SPAWN_X, PLAYER_SPAWN_Y)) {
                return { x: PLAYER_SPAWN_X, y: PLAYER_SPAWN_Y };
              }

              // If original spawn isn't safe, try random positions
              const attempts = 50;
              for (let i = 0; i < attempts; i++) {
                const x = 2 + Math.floor(Math.random() * (MAZE_WIDTH - 4));
                const y = 2 + Math.floor(Math.random() * (MAZE_HEIGHT - 4));

                if (isSafePosition(x, y)) {
                  return { x, y };
                }
              }

              // Fallback: try corners (check if walkable, prioritize distance from executives)
              const corners = [
                { x: 2, y: 2 },
                { x: MAZE_WIDTH - 3, y: 2 },
                { x: 2, y: MAZE_HEIGHT - 3 },
                { x: MAZE_WIDTH - 3, y: MAZE_HEIGHT - 3 },
              ];

              // Filter to only walkable corners
              const walkableCorners = corners.filter(
                (corner) => !maze[corner.y]?.[corner.x]
              );

              if (walkableCorners.length > 0) {
                // Find farthest corner from all executives
                let farthest = walkableCorners[0];
                let maxDist = 0;

                for (const corner of walkableCorners) {
                  let totalDist = 0;
                  for (const e of executives) {
                    totalDist += Math.sqrt(
                      (e.position.x - corner.x) ** 2 +
                        (e.position.y - corner.y) ** 2
                    );
                  }
                  if (totalDist > maxDist) {
                    maxDist = totalDist;
                    farthest = corner;
                  }
                }
                return farthest;
              }

              // Last resort: find any walkable position
              for (let y = 1; y < MAZE_HEIGHT - 1; y++) {
                for (let x = 1; x < MAZE_WIDTH - 1; x++) {
                  if (!maze[y][x]) {
                    return { x, y };
                  }
                }
              }

              // Should never reach here, but return original spawn as fallback
              return { x: PLAYER_SPAWN_X, y: PLAYER_SPAWN_Y };
            };

            setPlayer(findSafeSpawn());
          }
        });
      }
    }, 1000 / 60); // 60 FPS

    return () => clearInterval(gameLoop);
  }, [
    gameState,
    player,
    executives,
    speedBoost,
    invincibilityTimer,
    catchCooldown,
    maze,
  ]);

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

    // Draw maze walls with neon 1980s effect (solid walls)
    for (let y = 0; y < MAZE_HEIGHT; y++) {
      for (let x = 0; x < MAZE_WIDTH; x++) {
        if (maze[y][x]) {
          const posX = x * CELL_SIZE;
          const posY = y * CELL_SIZE;

          // Outer glow for neon effect
          ctx.shadowBlur = 20;
          ctx.shadowColor = "#ff00ff";

          // Main wall fill
          ctx.fillStyle = "#ff00ff";
          ctx.fillRect(posX, posY, CELL_SIZE, CELL_SIZE);

          // Inner highlight for depth
          ctx.fillStyle = "#ff66ff";
          ctx.shadowBlur = 10;
          ctx.fillRect(posX + 2, posY + 2, CELL_SIZE - 4, CELL_SIZE - 4);

          // Bright center highlight
          ctx.fillStyle = "#ff99ff";
          ctx.shadowBlur = 5;
          ctx.fillRect(posX + 4, posY + 4, CELL_SIZE - 8, CELL_SIZE - 8);

          // Debug: bright yellow boundary around wall tile
          ctx.save();
          ctx.shadowBlur = 0;
          ctx.strokeStyle = "#ffff00";
          ctx.lineWidth = 2;
          ctx.strokeRect(posX, posY, CELL_SIZE, CELL_SIZE);
          ctx.restore();

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
      // For most collectibles, skip if collected.
      // For coins, we still draw them while their collect pop-up animation is running.
      if (
        c.collected &&
        !(
          c.type === "coin" &&
          c.collectAnimationProgress !== undefined &&
          c.collectAnimationProgress < 1
        )
      ) {
        return;
      }

      const posX = c.position.x * CELL_SIZE;
      const posY = c.position.y * CELL_SIZE;
      const spriteSize = CELL_SIZE * 2; // Width equivalent to two blocks
      const offsetX = posX - (spriteSize - CELL_SIZE) / 2;
      const offsetY = posY - (spriteSize - CELL_SIZE) / 2;

      if (c.type === "computer") {
        const img = c.damaged ? sprites.computerDamaged : sprites.computer;
        if (img) {
          // Flash effect when damaged item is about to expire (after 2 seconds, 60 frames remaining)
          let flashed = false;
          if (c.damaged && c.damageTimer !== undefined && c.damageTimer < 60) {
            // Flash every 10 frames (fast blinking)
            const flashAlpha =
              Math.floor(c.damageTimer / 10) % 2 === 0 ? 0.3 : 1.0;
            ctx.save();
            ctx.globalAlpha = flashAlpha;
            flashed = true;
          }
          ctx.drawImage(img, offsetX, offsetY, spriteSize, spriteSize);

          // Purple debug boundary around computer
          ctx.save();
          ctx.strokeStyle = "#bf5fff"; // bright purple
          ctx.lineWidth = 2;
          ctx.strokeRect(offsetX, offsetY, spriteSize, spriteSize);
          ctx.restore();

          if (flashed) {
            ctx.restore();
          }
        }
      } else if (c.type === "wall") {
        const img = c.damaged ? sprites.whiteboardPainted : sprites.whiteboard;
        if (img) {
          // Flash effect when damaged item is about to expire (after 2 seconds, 60 frames remaining)
          let flashed = false;
          if (c.damaged && c.damageTimer !== undefined && c.damageTimer < 60) {
            // Flash every 10 frames (fast blinking)
            const flashAlpha =
              Math.floor(c.damageTimer / 10) % 2 === 0 ? 0.3 : 1.0;
            ctx.save();
            ctx.globalAlpha = flashAlpha;
            flashed = true;
          }
          ctx.drawImage(img, offsetX, offsetY, spriteSize, spriteSize);

          // Purple debug boundary around whiteboard
          ctx.save();
          ctx.strokeStyle = "#bf5fff";
          ctx.lineWidth = 2;
          ctx.strokeRect(offsetX, offsetY, spriteSize, spriteSize);
          ctx.restore();

          if (flashed) {
            ctx.restore();
          }
        }
      } else if (c.type === "coworker") {
        const img = c.damaged ? sprites.coworkerPied : sprites.coworker;
        if (img) {
          // Flash effect when damaged item is about to expire (after 2 seconds, 60 frames remaining)
          let flashed = false;
          if (c.damaged && c.damageTimer !== undefined && c.damageTimer < 60) {
            // Flash every 10 frames (fast blinking)
            const flashAlpha =
              Math.floor(c.damageTimer / 10) % 2 === 0 ? 0.3 : 1.0;
            ctx.save();
            ctx.globalAlpha = flashAlpha;
            flashed = true;
          }
          ctx.drawImage(img, offsetX, offsetY, spriteSize, spriteSize);

          // Purple debug boundary around coworker
          ctx.save();
          ctx.strokeStyle = "#bf5fff";
          ctx.lineWidth = 2;
          ctx.strokeRect(offsetX, offsetY, spriteSize, spriteSize);
          ctx.restore();

          if (flashed) {
            ctx.restore();
          }
        }
      } else if (c.type === "coffee") {
        if (sprites.coffee) {
          ctx.drawImage(
            sprites.coffee,
            offsetX,
            offsetY,
            spriteSize,
            spriteSize
          );

          // Purple debug boundary around coffee machine
          ctx.save();
          ctx.strokeStyle = "#bf5fff";
          ctx.lineWidth = 2;
          ctx.strokeRect(offsetX, offsetY, spriteSize, spriteSize);
          ctx.restore();
        }
      } else if (c.type === "coin") {
        if (sprites.coin) {
          // Calculate animated position if coin is still bouncing (spawn animation)
          let drawX = posX;
          let drawY = posY;

          if (
            c.animationStartPos !== undefined &&
            c.animationProgress !== undefined &&
            c.animationProgress < 1
          ) {
            // Ease-out function for smooth deceleration
            const easeOut = (t: number): number => {
              return 1 - Math.pow(1 - t, 3);
            };

            const progress = easeOut(c.animationProgress);
            const startX = c.animationStartPos.x * CELL_SIZE;
            const startY = c.animationStartPos.y * CELL_SIZE;
            const endX = c.position.x * CELL_SIZE;
            const endY = c.position.y * CELL_SIZE;

            // Calculate horizontal position (straight line interpolation)
            drawX = startX + (endX - startX) * progress;

            // Calculate vertical position with arc (parabolic trajectory)
            // Arc height: goes up to 1.5 cells at the peak (middle of animation)
            const arcHeight = CELL_SIZE * 1.5;
            // Parabolic arc: y = -4h * t * (t - 1) where h is height and t is progress
            // This creates an arc that starts at 0, peaks at 0.5, and ends at 0
            const verticalOffset = -4 * arcHeight * progress * (progress - 1);

            // Apply arc to vertical position
            drawY = startY + (endY - startY) * progress - verticalOffset;
          }

          // If coin is in "collected" pop-up animation, lift it upward
          if (
            c.collectAnimationProgress !== undefined &&
            c.collectAnimationProgress < 1
          ) {
            // Exponential ease-out: very fast at the start, then slows as it rises
            const easeOutPop = (t: number): number => {
              return 1 - Math.pow(2, -8 * t);
            };
            const popProgress = easeOutPop(c.collectAnimationProgress);
            const popHeight = CELL_SIZE * 2; // higher pop so it's clearly visible
            drawY -= popHeight * popProgress;
          }

          // Make coin slightly smaller and animated (but still roughly two blocks wide)
          const coinSize = CELL_SIZE * 1.6;
          const coinOffset = (CELL_SIZE - coinSize) / 2;

          // Flash effect when coin is about to expire (after 2 seconds, 60 frames remaining)
          let flashed = false;
          if (
            c.expireTimer !== undefined &&
            c.expireTimer < 60 &&
            !c.collected
          ) {
            // Flash every 10 frames (fast blinking)
            const flashAlpha =
              Math.floor(c.expireTimer / 10) % 2 === 0 ? 0.3 : 1.0;
            ctx.save();
            ctx.globalAlpha = flashAlpha;
            flashed = true;
          }

          // Apply a horizontal squash to fake a rotation while bouncing / popping
          ctx.save();
          const centerX = drawX + coinOffset + coinSize / 2;
          const centerY = drawY + coinOffset + coinSize / 2;
          ctx.translate(centerX, centerY);

          // Use whichever animation is active (bounce or collect pop) to drive the "spin"
          const tBounce =
            c.animationProgress !== undefined ? c.animationProgress : 0;
          const tPop =
            c.collectAnimationProgress !== undefined
              ? c.collectAnimationProgress
              : 0;
          const t = Math.min(1, Math.max(tBounce, tPop));

          // 1.5 full "flips" over the course of the animation
          const spins = 1.5;
          const angle = t * Math.PI * 2 * spins;
          const scaleX = Math.abs(Math.cos(angle)); // 1 → 0 → 1 fake rotation
          ctx.scale(scaleX, 1);

          ctx.drawImage(
            sprites.coin,
            -coinSize / 2,
            -coinSize / 2,
            coinSize,
            coinSize
          );
          ctx.restore();

          if (flashed) {
            ctx.restore();
          }
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

      // Draw executive sprite (width equivalent to two blocks)
      const posX = exec.position.x * CELL_SIZE;
      const posY = exec.position.y * CELL_SIZE;
      const spriteSize = CELL_SIZE * 2;
      const offsetX = posX - (spriteSize - CELL_SIZE) / 2;
      const offsetY = posY - (spriteSize - CELL_SIZE) / 2;

      const img = exec.isScared ? sprites.executiveScared : sprites.executive;
      if (img) {
        ctx.drawImage(img, offsetX, offsetY, spriteSize, spriteSize);

        // Debug: bright green boundary around executive sprite
        ctx.save();
        ctx.strokeStyle = "#00ff00";
        ctx.lineWidth = 2;
        ctx.strokeRect(offsetX, offsetY, spriteSize, spriteSize);
        ctx.restore();
      }
    });

    // Draw player sprite (width equivalent to two blocks)
    const posX = player.x * CELL_SIZE;
    const posY = player.y * CELL_SIZE;
    const spriteSize = CELL_SIZE * 2;
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

      // Debug: bright green boundary around player sprite
      ctx.save();
      ctx.strokeStyle = "#00ff00";
      ctx.lineWidth = 2;
      ctx.strokeRect(offsetX, offsetY, spriteSize, spriteSize);
      ctx.restore();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
  }, [
    player,
    executives,
    collectibles,
    speedBoost,
    invincibilityTimer,
    sprites,
  ]);

  // Make canvas focusable and auto-focus on mount
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.focus();
    }
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={MAZE_WIDTH * CELL_SIZE}
      height={MAZE_HEIGHT * CELL_SIZE}
      className="w-full h-auto arcade-glow"
      tabIndex={0}
      style={{
        background: "#0a0a1a",
        border: "3px solid #ff00ff",
        boxShadow: "0 0 20px #ff00ff",
        outline: "none", // Remove focus outline
      }}
    />
  );
};
