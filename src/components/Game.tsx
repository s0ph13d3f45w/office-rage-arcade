import { useEffect, useRef, useState } from "react";
import { GameCanvas } from "./GameCanvas";
import { GameHUD } from "./GameHUD";
import { GameInstructions } from "./GameInstructions";
import { GameOver } from "./GameOver";

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

  const togglePause = () => {
    setGameState((prev) => ({ ...prev, isPaused: !prev.isPaused }));
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-7xl flex flex-col lg:flex-row gap-4">
        <div className="flex-1 flex flex-col gap-4">
          <GameHUD
            score={gameState.score}
            lives={gameState.lives}
            level={gameState.level}
            onPause={togglePause}
            isPaused={gameState.isPaused}
          />
          <div className="relative border-4 border-primary rounded-lg overflow-hidden shadow-[0_0_20px_rgba(255,20,147,0.5)]">
            <GameCanvas
              gameState={gameState}
              updateScore={updateScore}
              loseLife={loseLife}
            />
            {gameState.isGameOver && (
              <GameOver score={gameState.score} onRestart={resetGame} />
            )}
          </div>
        </div>
        <GameInstructions />
      </div>
    </div>
  );
};
