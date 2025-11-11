import { Button } from "./ui/button";

interface GameOverProps {
  score: number;
  onRestart: () => void;
}

export const GameOver = ({ score, onRestart }: GameOverProps) => {
  return (
    <div className="absolute inset-0 backdrop-blur-md bg-background/80 flex items-center justify-center">
      <div className="text-center space-y-6 p-8 border-4 border-primary rounded-3xl bg-card glossy shadow-[0_8px_60px_rgba(255,105,180,0.6)]">
        <h2 className="text-4xl font-bold text-primary holographic bg-clip-text text-transparent animate-pulse">
          YOU'RE FIRED!
        </h2>
        <div className="space-y-2">
          <p className="text-xl text-y2k-cyan text-shadow-chrome font-bold">Final Workplace Damage:</p>
          <p className="text-5xl font-bold text-y2k-bubblegum text-shadow-chrome">{score}</p>
        </div>
        <div className="space-y-2 text-muted-foreground text-sm font-medium">
          <p className="italic">"Women are ruining the workplace!"</p>
          <p className="text-xs">- Some executive, probably</p>
        </div>
        <Button
          onClick={onRestart}
          className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-lg px-8 py-6 rounded-full shadow-[0_0_30px_rgba(255,105,180,0.6)] glossy"
        >
          APPLY AGAIN
        </Button>
      </div>
    </div>
  );
};
