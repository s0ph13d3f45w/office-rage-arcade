import { Button } from "./ui/button";

interface GameOverProps {
  score: number;
  onRestart: () => void;
}

export const GameOver = ({ score, onRestart }: GameOverProps) => {
  return (
    <div className="absolute inset-0 bg-background/95 flex items-center justify-center">
      <div className="text-center space-y-6 p-8 border-4 border-primary rounded-lg bg-card shadow-[0_0_30px_rgba(255,20,147,0.6)]">
        <h2 className="text-4xl font-bold text-primary animate-pulse">
          YOU'RE FIRED!
        </h2>
        <div className="space-y-2">
          <p className="text-xl text-arcade-cyan">Final Workplace Damage:</p>
          <p className="text-5xl font-bold text-arcade-yellow">{score}</p>
        </div>
        <div className="space-y-2 text-muted-foreground text-sm">
          <p className="italic">"Women are ruining the workplace!"</p>
          <p className="text-xs">- Some executive, probably</p>
        </div>
        <Button
          onClick={onRestart}
          className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold text-lg px-8 py-6 shadow-[0_0_20px_rgba(255,20,147,0.5)]"
        >
          APPLY AGAIN
        </Button>
      </div>
    </div>
  );
};
