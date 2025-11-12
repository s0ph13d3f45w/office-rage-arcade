import { useCallback, useEffect, useRef, useState } from "react";
import { GameCanvas } from "./GameCanvas";
import { GameHUD } from "./GameHUD";
import { GameInstructions } from "./GameInstructions";
import { GameOver } from "./GameOver";
import newspaperHeader from "@/assets/newspaper-header.jpeg";

export interface GameState {
  score: number;
  lives: number;
  level: number;
  isGameOver: boolean;
  isPaused: boolean;
}

export const Game = () => {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    lives: 3,
    level: 1,
    isGameOver: false,
    isPaused: false,
  });

  const updateScore = (points: number) => {
    setGameState((prev) => {
      const newScore = prev.score + points;
      const newLevel = Math.floor(newScore / 100) + 1;
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
    setGameState({
      score: 0,
      lives: 3,
      level: 1,
      isGameOver: false,
      isPaused: false,
    });
  };

  const togglePause = useCallback(() => {
    setGameState((prev) => {
      console.log("togglePause called, current isPaused:", prev.isPaused);
      return { ...prev, isPaused: !prev.isPaused };
    });
  }, []); // Empty deps - uses functional update so doesn't need isPaused in deps

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
            />
            <div className="relative border-4 border-primary rounded-3xl overflow-hidden shadow-[0_8px_40px_rgba(255,105,180,0.5)] glossy">
              <GameCanvas
                gameState={gameState}
                updateScore={updateScore}
                loseLife={loseLife}
                togglePause={togglePause}
              />
              {gameState.isGameOver && (
                <GameOver score={gameState.score} onRestart={resetGame} />
              )}
            </div>
          </div>
          <GameInstructions />
        </div>
      </div>
    </div>
  );
};
