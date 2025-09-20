import { Button } from "@/components/ui/button";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";

interface GamesEmptyStateProps {
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export function GamesEmptyState({ loading = false, error = null, onRefresh }: GamesEmptyStateProps) {
  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <h3 className="text-xl font-semibold text-white mb-2">Loading games...</h3>
        <p className="text-gray-400">Fetching kind:31985 events from relays</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-600/20 rounded-full flex items-center justify-center">
          <WifiOff className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-2">Connection Error</h3>
        <p className="text-gray-400 mb-6 max-w-md mx-auto">{error}</p>
        {onRefresh && (
          <Button
            onClick={onRefresh}
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  // If loading, show loading state
  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <h3 className="text-2xl font-semibold text-white mb-3">Loading games...</h3>
        <p className="text-gray-400 max-w-md mx-auto">
          Fetching kind:31985 events from relays
        </p>
      </div>
    );
  }

  // If error, show error state
  if (error) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-600/20 rounded-full flex items-center justify-center">
          <WifiOff className="w-8 h-8 text-red-400" />
        </div>
        <h3 className="text-2xl font-semibold text-white mb-3">Connection Error</h3>
        <p className="text-gray-400 mb-6 max-w-md mx-auto">{error}</p>
        {onRefresh && (
          <Button
            onClick={onRefresh}
            variant="outline"
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  // If no games found (not loading, no error), show empty state
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 mx-auto mb-4 bg-purple-600/20 rounded-full flex items-center justify-center">
        <Wifi className="w-8 h-8 text-purple-400" />
      </div>
      <h3 className="text-2xl font-semibold text-white mb-3">No games found</h3>
      <p className="text-gray-400 mb-6 max-w-md mx-auto">
        No kind:31985 entries were found on the connected relay(s).
      </p>
      {onRefresh && (
        <Button
          onClick={onRefresh}
          variant="outline"
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      )}
    </div>
  );
}