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
    <div className="bg-card glossy border-4 border-primary rounded-3xl p-4 shadow-[0_8px_32px_rgba(255,105,180,0.3)]">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-y2k-cyan font-bold text-sm text-shadow-chrome">DAMAGE TO WORKPLACE:</span>
          <span className="text-y2k-bubblegum text-2xl font-bold text-shadow-chrome">{score}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-y2k-cyan font-bold text-sm text-shadow-chrome">HR VIOLATIONS:</span>
          <div className="flex gap-1">
            {Array.from({ length: lives }).map((_, i) => (
              <Heart key={i} className="w-6 h-6 fill-primary text-primary drop-shadow-[0_0_8px_rgba(255,105,180,0.8)]" />
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-y2k-cyan font-bold text-sm text-shadow-chrome">SENIORITY LEVEL:</span>
          <span className="text-y2k-lime text-2xl font-bold text-shadow-chrome">{level}</span>
        </div>

        <Button
          onClick={onPause}
          variant="outline"
          size="sm"
          className="glossy hover:bg-primary/20 border-2 border-primary text-primary font-bold rounded-full"
        >
          {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};
