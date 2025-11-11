import { Heart, Pause, Play } from "lucide-react";
import { Button } from "./ui/button";

interface GameHUDProps {
  score: number;
  lives: number;
  level: number;
  onPause: () => void;
  isPaused: boolean;
}

export const GameHUD = ({ score, lives, level, onPause, isPaused }: GameHUDProps) => {
  return (
    <div className="bg-card border-2 border-primary rounded-lg p-4 shadow-[0_0_15px_rgba(255,20,147,0.3)]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-arcade-cyan font-bold text-sm">DAMAGE TO WORKPLACE:</span>
          <span className="text-arcade-yellow text-2xl font-bold">{score}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-arcade-cyan font-bold text-sm">HR VIOLATIONS:</span>
          <div className="flex gap-1">
            {Array.from({ length: lives }).map((_, i) => (
              <Heart key={i} className="w-6 h-6 fill-primary text-primary animate-pulse" />
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-arcade-cyan font-bold text-sm">SENIORITY LEVEL:</span>
          <span className="text-arcade-green text-2xl font-bold">{level}</span>
        </div>

        <Button
          onClick={onPause}
          variant="outline"
          size="sm"
          className="bg-muted/50 hover:bg-primary/20 border-primary text-primary"
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};
