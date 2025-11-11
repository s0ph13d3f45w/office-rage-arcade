import { Card } from "./ui/card";

export const GameInstructions = () => {
  return (
    <Card className="w-full lg:w-80 bg-card border-2 border-secondary p-6 shadow-[0_0_15px_rgba(0,255,255,0.3)]">
      <h2 className="text-xl font-bold text-arcade-pink mb-4 text-center">
        WOMEN VS. WORKPLACE
      </h2>
      
      <div className="space-y-4 text-sm">
        <div>
          <h3 className="text-arcade-cyan font-bold mb-2">🎮 CONTROLS</h3>
          <ul className="space-y-1 text-muted-foreground">
            <li>⬆️⬇️⬅️➡️ Arrow Keys: Move</li>
            <li>X: Perform Action</li>
            <li>Space: Emergency HR Call</li>
          </ul>
        </div>

        <div>
          <h3 className="text-arcade-cyan font-bold mb-2">💰 EARN POINTS</h3>
          <ul className="space-y-1 text-muted-foreground">
            <li>🖥️ Smash Computer: 8 pts</li>
            <li>🎨 Graffiti Wall: 5 pts</li>
            <li>🎂 Cake in Face: 10 pts</li>
          </ul>
        </div>

        <div>
          <h3 className="text-arcade-cyan font-bold mb-2">⚡ POWER-UPS</h3>
          <ul className="space-y-1 text-muted-foreground">
            <li>📝 Kick-Me Sign: Scare executives (3s)</li>
            <li>☕ Coffee Boost: Speed up (3s)</li>
          </ul>
        </div>

        <div>
          <h3 className="text-arcade-cyan font-bold mb-2">👨‍💼 EXECUTIVES</h3>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li className="text-arcade-pink">• Boomer Bob: "Back in MY day!"</li>
            <li className="text-arcade-yellow">• Nostalgic Ned: Erratic movement</li>
            <li className="text-arcade-green">• Traditional Tom: Blocks rooms</li>
            <li className="text-secondary">• Grumpy Greg: Fast & cranky</li>
          </ul>
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground italic">
            Avoid their vision cones! Sneak behind them to stick a kick-me sign!
          </p>
        </div>

        <div className="pt-2">
          <p className="text-xs text-arcade-yellow font-bold text-center">
            Every 100 points = Level Up = Faster Executives!
          </p>
        </div>
      </div>
    </Card>
  );
};
