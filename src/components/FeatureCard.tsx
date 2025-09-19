import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

export function FeatureCard({ title, description, icon }: FeatureCardProps) {
  return (
    <Card className="h-full border-purple-900/20 bg-card/50 backdrop-blur-sm hover:border-purple-500/50 transition-all duration-300 hover:scale-105 group">
      <CardContent className="p-6 h-full flex flex-col">
        <div className="mb-4 p-3 w-fit rounded-lg bg-gradient-to-br from-purple-600/20 to-cyan-600/20 group-hover:from-purple-600/30 group-hover:to-cyan-600/30 transition-all duration-300">
          {icon}
        </div>
        <h3 className="font-semibold text-xl text-foreground mb-3">{title}</h3>
        <p className="text-muted-foreground text-sm flex-grow">{description}</p>
        <div className="mt-4 flex items-center text-purple-400 group-hover:text-purple-300 transition-colors">
          <span className="text-sm font-medium">Explore</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      </CardContent>
    </Card>
  );
}