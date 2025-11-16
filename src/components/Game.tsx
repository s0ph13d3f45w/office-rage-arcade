import { useCallback, useEffect, useRef, useState } from "react";
import { GameCanvas } from "./GameCanvas";
import { GameHUD } from "./GameHUD";
import { GameInstructions } from "./GameInstructions";
import { GameOver } from "./GameOver";
import { GameTitle } from "./GameTitle";
import { Button } from "./ui/button";
import newspaperHeader from "@/assets/newspaper-header.jpeg";

export interface GameState {
  score: number;
  lives: number;
  level: number;
  isGameOver: boolean;
  isPaused: boolean;
}

interface HighScoreEntry {
  name: string;
  score: number;
}

export const Game = () => {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    lives: 3,
    level: 1,
    isGameOver: false,
    isPaused: true, // start paused behind the title screen
  });
  // Base seniority level chosen from the title screen; score adds on top of this.
  const [baseLevel, setBaseLevel] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showTitle, setShowTitle] = useState(true);
  const [highScores, setHighScores] = useState<HighScoreEntry[]>(() => {
    const defaults: HighScoreEntry[] = [
      { name: "---", score: 250 },
      { name: "---", score: 200 },
      { name: "---", score: 150 },
      { name: "---", score: 100 },
      { name: "---", score: 50 },
    ];

    if (typeof window === "undefined") return defaults;
    try {
      const stored = window.localStorage.getItem("officeRageHighScores");
      if (!stored) return defaults;
      const parsed = JSON.parse(stored) as HighScoreEntry[];
      if (!Array.isArray(parsed)) return defaults;
      return parsed
        .filter(
          (e) =>
            typeof e?.name === "string" &&
            typeof e?.score === "number" &&
            Number.isFinite(e.score)
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);
    } catch {
      return defaults;
    }
  });

  const updateScore = (points: number) => {
    setGameState((prev) => {
      const newScore = prev.score + points;
      // Increase level by 1 every 25 points, starting from the chosen base level.
      const newLevel = baseLevel + Math.floor(newScore / 25);
      return { ...prev, score: newScore, level: newLevel };
    });
  };

  const loseLife = () => {
    setGameState((prev) => {
      const newLives = prev.lives - 1;
      return {
        ...prev,
        lives: newLives,
        isGameOver: newLives <= 0,
      };
    });
  };

  const resetGame = () => {
    // Reset core state but return to the title screen so the player can
    // choose a new starting level before jumping back in.
    setGameState({
      score: 0,
      lives: 3,
      level: 1,
      isGameOver: false,
      isPaused: true,
    });
    setBaseLevel(1);
    setShowTitle(true);
  };

  const togglePause = useCallback(() => {
    setGameState((prev) => {
      console.log("togglePause called, current isPaused:", prev.isPaused);
      return { ...prev, isPaused: !prev.isPaused };
    });
  }, []); // Empty deps - uses functional update so doesn't need isPaused in deps

  const [pendingHighScore, setPendingHighScore] =
    useState<HighScoreEntry | null>(null);
  const [pendingInitials, setPendingInitials] = useState("YOU");

  // When game ends, decide if we should show the "New High Score" banner
  useEffect(() => {
    if (!gameState.isGameOver) return;
    const currentScore = gameState.score;
    const hasDefault = highScores.some((e) => e.name === "---");
    const playerOnly = highScores.filter((e) => e.name !== "---");
    const minPlayerScore =
      playerOnly.length > 0
        ? Math.min(...playerOnly.map((e) => e.score))
        : -Infinity;

    // If we already have 5 real player scores and this one doesn't beat the
    // lowest of those, don't show the banner. Otherwise, allow it and replace
    // defaults first.
    if (
      highScores.length >= 5 &&
      !hasDefault &&
      currentScore <= minPlayerScore
    ) {
      return;
    }
    setPendingHighScore({ name: "YOU", score: currentScore });
    setPendingInitials("YOU");
  }, [gameState.isGameOver, gameState.score, highScores]);

  const commitHighScore = () => {
    if (!pendingHighScore) return;
    const cleaned = pendingInitials
      .toUpperCase()
      .replace(/[^A-Z]/g, "")
      .slice(0, 3)
      .padEnd(3, "_");

    const entry: HighScoreEntry = {
      name: cleaned,
      score: pendingHighScore.score,
    };

    setHighScores((prev) => {
      // 1) Sort all entries purely by score (descending)
      let next = [...prev, entry].sort((a, b) => b.score - a.score);

      // 2) If we have more than 5 entries, drop the lowest scores – but when
      //    trimming, try to drop defaults ("---") first so real player scores
      //    don't replace each other.
      while (next.length > 5) {
        // Look from the end (lowest scores) for a default entry to drop
        let dropIndex = -1;
        for (let i = next.length - 1; i >= 0; i--) {
          if (next[i].name === "---") {
            dropIndex = i;
            break;
          }
        }
        // If we found a default, drop it; otherwise drop the true lowest score
        if (dropIndex !== -1) {
          next.splice(dropIndex, 1);
        } else {
          next.pop();
        }
      }

      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(
            "officeRageHighScores",
            JSON.stringify(next)
          );
        }
      } catch {
        // ignore storage errors
      }

      return next;
    });

    // After saving the high score, reset back to the title screen
    setPendingHighScore(null);
    resetGame();
  };

  const handleStartGame = (level: number) => {
    setBaseLevel(level);
    setGameState({
      score: 0,
      lives: 3,
      level,
      isGameOver: false,
      isPaused: false,
    });
    setShowTitle(false);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="w-full px-4 py-4">
        <img
          src={newspaperHeader}
          alt="Did Women Ruin the Workplace? - Interesting Times Opinion"
          className="w-full h-auto rounded-lg shadow-lg max-w-7xl mx-auto"
        />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 pb-4">
        <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-4">
          <div className="flex-1 flex flex-col gap-4">
            <GameHUD
              score={gameState.score}
              lives={gameState.lives}
              level={gameState.level}
              onPause={togglePause}
              isPaused={gameState.isPaused}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled((prev) => !prev)}
            />
            <div className="relative border-4 border-primary rounded-3xl overflow-hidden shadow-[0_8px_40px_rgba(255,105,180,0.5)] glossy">
              <GameCanvas
                gameState={gameState}
                updateScore={updateScore}
                loseLife={loseLife}
                togglePause={togglePause}
                soundEnabled={soundEnabled}
              />
              {showTitle && !gameState.isGameOver && (
                <GameTitle highScores={highScores} onStart={handleStartGame} />
              )}
              {gameState.isGameOver && !pendingHighScore && (
                <GameOver score={gameState.score} onRestart={resetGame} />
              )}
              {pendingHighScore && (
                <div className="absolute inset-0 backdrop-blur-md bg-background/80 flex items-center justify-center z-30">
                  <div className="text-center space-y-4 p-6 border-4 border-primary rounded-3xl bg-card glossy shadow-[0_8px_60px_rgba(255,105,180,0.6)] max-w-md mx-auto">
                    <h2 className="text-3xl font-bold text-primary text-shadow-neon">
                      NEW HIGH SCORE!
                    </h2>
                    <p className="text-arcade-pink text-2xl font-bold text-shadow-neon">
                      {pendingHighScore.score}
                    </p>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-arcade-cyan text-shadow-neon uppercase tracking-wide">
                        Enter Initials
                      </label>
                      <input
                        type="text"
                        maxLength={3}
                        value={pendingInitials}
                        onChange={(e) => setPendingInitials(e.target.value)}
                        className="w-full text-center text-xl font-mono font-bold border-2 border-primary rounded-xl px-3 py-2 bg-background/80 text-primary outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <Button
                      onClick={commitHighScore}
                      className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-lg px-6 py-3 rounded-full shadow-[0_0_24px_rgba(255,105,180,0.6)] glossy"
                    >
                      SAVE SCORE
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <GameInstructions />
        </div>
      </div>
    </div>
  );
};
