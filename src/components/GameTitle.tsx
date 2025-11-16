import { useState } from "react";
import { Button } from "./ui/button";

interface HighScoreEntry {
  name: string;
  score: number;
}

interface GameTitleProps {
  onStart: (level: number) => void;
  highScores: HighScoreEntry[];
}

export const GameTitle = ({ onStart, highScores }: GameTitleProps) => {
  const [selectedLevel, setSelectedLevel] = useState(1);

  const handleStart = () => {
    onStart(selectedLevel);
  };

  return (
    <div className="absolute inset-0 backdrop-blur-md bg-background/80 flex items-center justify-center z-20">
      <div className="text-center space-y-6 p-8 border-4 border-primary rounded-3xl bg-card glossy shadow-[0_8px_60px_rgba(255,105,180,0.6)] max-w-lg mx-auto">
        <h1 className="text-4xl font-extrabold text-primary text-shadow-neon tracking-[0.2em] uppercase">
          Woman vs. Workplace
        </h1>

        <div className="space-y-4">
          <Button
            onClick={handleStart}
            className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-lg px-8 py-6 rounded-full shadow-[0_0_30px_rgba(255,105,180,0.6)] glossy"
          >
            START GAME
          </Button>

          <div className="space-y-3">
            <h2 className="text-arcade-cyan font-bold text-shadow-neon text-sm uppercase tracking-wide">
              Level Select
            </h2>
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((level) => (
                <Button
                  key={level}
                  variant={selectedLevel === level ? "default" : "outline"}
                  size="sm"
                  className={
                    selectedLevel === level
                      ? "bg-arcade-pink text-white text-shadow-neon"
                      : "border-arcade-pink text-arcade-pink"
                  }
                  onClick={() => setSelectedLevel(level)}
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-3 border-t border-border">
            <h2 className="text-arcade-cyan font-bold text-shadow-neon text-sm uppercase tracking-wide">
              High Scores
            </h2>
            <div className="space-y-1 text-left">
              {highScores.map((entry, index) => (
                <div
                  key={`${entry.name}-${entry.score}-${index}`}
                  className="flex justify-between text-sm font-bold text-shadow-neon"
                >
                  <span className="text-arcade-cyan mr-2">
                    {index + 1}. {entry.name}
                  </span>
                  <span className="text-arcade-pink">{entry.score}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground italic">
              HR can't touch this
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Press <span className="font-bold">W/A/S/D</span> to move,{" "}
          <span className="font-bold">P</span> to cause chaos,{" "}
          <span className="font-bold">Space</span> to pause.
        </p>
      </div>
    </div>
  );
};
