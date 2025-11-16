import { Heart, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "./ui/button";

interface GameHUDProps {
  score: number;
  lives: number;
  level: number;
  onPause: () => void;
  isPaused: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const GameHUD = ({
  score,
  lives,
  level,
  onPause,
  isPaused,
  soundEnabled,
  onToggleSound,
}: GameHUDProps) => {
  return (
    <div className="bg-card glossy border-4 border-primary rounded-3xl p-4 shadow-[0_8px_32px_rgba(255,105,180,0.3)]">
      <div className="flex flex-col gap-3">
        {/* Top row: damage (left) and HR violations (right) */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-arcade-cyan font-bold text-sm text-shadow-neon">
              DAMAGE TO WORKPLACE:
            </span>
            <span className="text-arcade-pink text-2xl font-bold text-shadow-neon">
              {score}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-arcade-cyan font-bold text-sm text-shadow-neon">
              HR VIOLATIONS:
            </span>
            <div className="flex gap-1">
              {Array.from({ length: lives }).map((_, i) => (
                <Heart
                  key={i}
                  className="w-6 h-6 fill-primary text-primary drop-shadow-[0_0_8px_rgba(255,105,180,0.8)]"
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom row: seniority level (left) and controls (right) */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-arcade-cyan font-bold text-sm text-shadow-neon">
              SENIORITY LEVEL:
            </span>
            <span className="text-arcade-yellow text-2xl font-bold text-shadow-neon">
              {level}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={onToggleSound}
              variant="outline"
              size="sm"
              className="glossy hover:bg-primary/20 border-2 border-primary text-primary font-bold rounded-full"
              aria-label={soundEnabled ? "Mute sound" : "Unmute sound"}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </Button>
            <Button
              onClick={onPause}
              variant="outline"
              size="sm"
              className="glossy hover:bg-primary/20 border-2 border-primary text-primary font-bold rounded-full"
              aria-label={isPaused ? "Resume game" : "Pause game"}
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
