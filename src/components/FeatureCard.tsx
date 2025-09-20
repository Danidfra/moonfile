import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  accentColor?: 'purple' | 'cyan' | 'blue';
}

export function FeatureCard({ title, description, icon, accentColor = 'purple' }: FeatureCardProps) {
  const getAccentClasses = () => {
    switch (accentColor) {
      case 'cyan':
        return 'from-cyan-500 to-blue-500 group-hover:from-cyan-600 group-hover:to-blue-600 text-cyan-400 group-hover:text-cyan-300';
      case 'blue':
        return 'from-blue-500 to-purple-500 group-hover:from-blue-600 group-hover:to-purple-600 text-blue-400 group-hover:text-blue-300';
      default:
        return 'from-purple-500 to-cyan-500 group-hover:from-purple-600 group-hover:to-cyan-600 text-purple-400 group-hover:text-purple-300';
    }
  };

  return (
    <Card className="h-full border-gray-800 bg-gray-900 hover:border-purple-500 transition-all duration-300 hover:scale-105 group">
      <CardContent className="p-6 h-full flex flex-col">
        <div className={`mb-4 p-3 w-fit rounded-lg bg-gradient-to-br ${getAccentClasses()} transition-all duration-300`}>
          {icon}
        </div>
        <h3 className="font-semibold text-xl text-white mb-3">{title}</h3>
        <p className="text-gray-400 text-sm flex-grow">{description}</p>
        <div className={`mt-4 flex items-center ${getAccentClasses()} transition-colors`}>
          <span className="text-sm font-medium">Explore</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      </CardContent>
    </Card>
  );
}