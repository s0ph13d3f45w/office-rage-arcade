import { Card } from "./ui/card";

export const GameInstructions = () => {
  return (
    <Card className="w-full lg:w-80 bg-card glossy border-4 border-secondary p-6 shadow-[0_8px_32px_rgba(0,255,255,0.3)] rounded-3xl">
      <h2 className="text-xl font-bold text-arcade-pink mb-4 text-center text-shadow-neon">
        WOMEN VS. WORKPLACE
      </h2>
      
      <div className="space-y-4 text-sm">
        <div>
          <h3 className="text-arcade-cyan font-bold mb-2 text-shadow-neon">🎮 CONTROLS</h3>
          <ul className="space-y-1 text-muted-foreground font-semibold">
            <li>W/A/S/D: Move</li>
            <li>P: Destroy/Action</li>
            <li>Space: Emergency HR Call</li>
          </ul>
        </div>

        <div>
          <h3 className="text-arcade-cyan font-bold mb-2 text-shadow-neon">💰 EARN POINTS</h3>
          <ul className="space-y-1 text-muted-foreground font-semibold">
            <li>🖥️ Smash Computer: 8 pts</li>
            <li>🎨 Graffiti Wall: 5 pts</li>
            <li>🎂 Cake in Face: 10 pts</li>
          </ul>
        </div>

        <div>
          <h3 className="text-arcade-cyan font-bold mb-2 text-shadow-neon">⚡ POWER-UPS</h3>
          <ul className="space-y-1 text-muted-foreground font-semibold">
            <li>📝 Kick-Me Sign: Scare executives (3s)</li>
            <li>☕ Coffee Boost: Speed up (3s)</li>
          </ul>
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground italic font-medium">
            Avoid their vision cones! Sneak behind them to stick a kick-me sign!
          </p>
        </div>

        <div className="pt-2">
          <p className="text-xs text-arcade-pink font-bold text-center text-shadow-neon">
            Every 100 points = Level Up = Faster Executives!
          </p>
        </div>
      </div>
    </Card>
  );
};
